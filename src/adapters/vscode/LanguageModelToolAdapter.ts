import * as vscode from 'vscode';
import type { ImpactMonitor } from '../../application/ImpactMonitor';
import type { ImpactTracker } from '../../infrastructure/ImpactTracker';
import { logger } from '../../infrastructure/Logger';

/**
 * Parameters for the language model tool
 */
export interface LanguageModelToolParameters {
  inputTokens?: number; // Number of input/prompt tokens
  outputTokens?: number; // Number of output/completion tokens
  tokens?: number; // Total tokens (fallback if separate counts not provided)
  prompt?: string; // Prompt text to estimate tokens from
  model: string; // Model identifier
  electricityMixZone?: string; // Electricity mix zone (e.g., 'WOR', 'USA', 'FRA')
}

/**
 * Adapter for VS Code Language Model Tool API
 * Allows agent mode to automatically invoke environmental impact calculations
 */
export class LanguageModelToolAdapter
  implements vscode.LanguageModelTool<LanguageModelToolParameters>, vscode.Disposable
{
  private impactMonitor: ImpactMonitor;
  private impactTracker: ImpactTracker;
  private disposable: vscode.Disposable | undefined;

  constructor(impactMonitor: ImpactMonitor, impactTracker: ImpactTracker) {
    this.impactMonitor = impactMonitor;
    this.impactTracker = impactTracker;

    // Register tool only if enabled in settings
    const config = vscode.workspace.getConfiguration('ecopilot');
    const isEnabled = config.get<boolean>('enableLanguageModelTool', true);

    if (isEnabled) {
      this.disposable = vscode.lm.registerTool('ecopilot_calculate_impact', this);
      logger.info('Language Model Tool adapter registered for agent mode');
    } else {
      logger.info('Language Model Tool adapter disabled in settings');
    }
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<LanguageModelToolParameters>,
    _token: vscode.CancellationToken
  ): Promise<vscode.PreparedToolInvocation> {
    logger.info('Preparing environmental impact calculation');

    const input = options.input;

    // Validate inputs
    if (!input.model) {
      throw new Error('Model name is required to calculate environmental impact');
    }

    // Calculate total tokens for display
    let totalTokens: number;
    if (input.inputTokens !== undefined && input.outputTokens !== undefined) {
      totalTokens = input.inputTokens + input.outputTokens;
    } else if (input.tokens) {
      totalTokens = input.tokens;
    } else if (input.prompt) {
      totalTokens = Math.ceil(input.prompt.length / 4);
    } else {
      throw new Error('Either token count or prompt text is required');
    }

    const zone = input.electricityMixZone || 'world average';

    const confirmationMessages = {
      title: 'Calculate Environmental Impact',
      message: new vscode.MarkdownString(
        `Calculate CO₂ emissions and energy consumption for **${totalTokens} tokens** using model \`${input.model}\` (electricity mix: ${zone})?`
      ),
    };

    return {
      invocationMessage: `Calculating environmental impact for ${totalTokens} tokens`,
      confirmationMessages,
    };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<LanguageModelToolParameters>,
    _token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    logger.info('Agent mode invoked environmental impact tool');

    try {
      const params = options.input;

      // Validate model is provided
      if (!params.model) {
        throw new Error(
          'Model name is required. Please provide the model identifier (e.g., "gpt-4o", "claude-3-5-sonnet").'
        );
      }

      // Get or estimate token counts
      let inputTokens: number;
      let outputTokens: number;

      // If separate counts provided, use them
      if (params.inputTokens !== undefined && params.outputTokens !== undefined) {
        inputTokens = params.inputTokens;
        outputTokens = params.outputTokens;
      }
      // If total tokens provided, split it roughly (assuming ~25% input, 75% output for chat)
      else if (params.tokens !== undefined) {
        inputTokens = Math.ceil(params.tokens * 0.25);
        outputTokens = Math.ceil(params.tokens * 0.75);
      }
      // If prompt provided, estimate from it
      else if (params.prompt) {
        inputTokens = Math.ceil(params.prompt.length / 4);
        outputTokens = Math.ceil(inputTokens * 3); // Estimate output as 3x input
      } else {
        throw new Error(
          'Token information is required. Please provide either: inputTokens + outputTokens, total tokens, or prompt text to estimate tokens.'
        );
      }

      // Calculate impact
      await this.impactMonitor.calculateImpact(
        inputTokens,
        outputTokens,
        1.0,
        'chat',
        params.inputTokens !== undefined && params.outputTokens !== undefined, // isRealTokenCount
        params.model,
        params.electricityMixZone
      );

      // Get the latest impact from tracker
      const sessionTotal = this.impactTracker.getSessionTotal();
      const weeklyStats = this.impactTracker.getWeeklyStats();

      // Return structured data for the model to format
      const result = {
        request: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
          model: params.model,
          electricityMix: params.electricityMixZone || 'WOR',
        },
        impact: {
          gwp: { value: weeklyStats.totalGwp, unit: 'g CO₂eq' },
          energy: { value: weeklyStats.totalEnergy, unit: 'kWh' },
          primaryEnergy: { value: weeklyStats.totalPe, unit: 'MJ' },
          adpe: { value: weeklyStats.totalAdpe, unit: 'kg Sb eq' },
        },
        cumulative: {
          session: { value: sessionTotal, unit: 'g CO₂eq' },
          weekly: { value: weeklyStats.totalGwp, unit: 'g CO₂eq', days: weeklyStats.stats.length },
        },
      };

      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify(result, null, 2)),
      ]);
    } catch (error) {
      logger.error('Tool invocation failed', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      // Provide helpful error context to the LLM
      if (errorMessage.includes('not found') || errorMessage.includes('not supported')) {
        throw new Error(
          `${errorMessage}. The model may not be in the EcoLogits database. Supported providers include OpenAI (GPT models), Anthropic (Claude), Google (Gemini), and Mistral AI. Please verify the model name or inform the user that environmental impact data is not available for this model.`
        );
      }

      throw new Error(`Failed to calculate environmental impact: ${errorMessage}`);
    }
  }

  dispose(): void {
    this.disposable?.dispose();
  }
}
