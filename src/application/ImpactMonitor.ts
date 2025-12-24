import * as vscode from 'vscode';
import type { ImpactRecord } from '../domain/ImpactRecord';
import type { CalculationRequest } from '../domain/models/CalculationRequest';
import { ImpactProviderFactory } from '../infrastructure/ImpactProviderFactory';
import type { ImpactTracker } from '../infrastructure/ImpactTracker';
import { logger } from '../infrastructure/Logger';

/**
 * Application service for monitoring and calculating environmental impact
 * Coordinates between provider, tracker, and UI updates
 */
export class ImpactMonitor {
  private impactTracker: ImpactTracker;
  private onImpactCalculated: () => void;

  constructor(impactTracker: ImpactTracker, onImpactCalculated: () => void) {
    this.impactTracker = impactTracker;
    this.onImpactCalculated = onImpactCalculated;
  }

  async calculateImpact(
    inputTokens: number,
    outputTokens: number,
    latency: number,
    source: 'chat' | 'completion',
    isRealTokenCount: boolean,
    model: string,
    electricityMixZone?: string
  ): Promise<void> {
    const totalTokens = inputTokens + outputTokens;
    logger.info(
      `Calculating impact: ${inputTokens} input + ${outputTokens} output = ${totalTokens} total tokens, source: ${source}, model: ${model}`
    );

    const config = vscode.workspace.getConfiguration('ecopilot');
    const electricityMix = electricityMixZone || config.get('electricityMix', 'WOR');

    try {
      const provider = await ImpactProviderFactory.getInstance().getProvider();

      const request: CalculationRequest = {
        inputTokens,
        outputTokens,
        latencySeconds: latency,
        modelName: model,
        electricityMixZone: electricityMix,
      };

      const result = await provider.calculateImpact(request);

      if (!result.success) {
        const errorMsg = result.error.message || 'Unknown error';
        logger.error('Impact calculation failed', result.error);

        // Notify user if model is not supported
        if (errorMsg.includes('not found') || errorMsg.includes('not supported')) {
          vscode.window.showWarningMessage(
            `EcoPilot: Model '${model}' is not supported by the environmental impact provider. ` +
              `Please check the model name or update the provider.`
          );
        }
        return;
      }

      const impact: ImpactRecord = {
        gwp: result.data.totalGwp,
        primaryEnergy: result.data.totalPrimaryEnergy,
        adpe: result.data.totalAdpe,
        energy: result.data.energyConsumption,
        usage: {
          gwp: result.data.usage.gwp,
          primaryEnergy: result.data.usage.primaryEnergy,
          adpe: result.data.usage.adpe,
        },
        embodied: {
          gwp: result.data.embodied.gwp,
          primaryEnergy: result.data.embodied.primaryEnergy,
          adpe: result.data.embodied.adpe,
        },
        model: result.data.metadata.modelUsed,
        tokens: totalTokens,
        inputTokens,
        outputTokens,
        latency,
        timestamp: Date.now(),
        source,
        isRealTokenCount,
      };

      this.impactTracker.addImpact(impact);
      this.onImpactCalculated();

      logger.info(`Impact: ${impact.gwp.toFixed(4)} gCO₂eq, ${impact.energy.toFixed(6)} kWh`);
    } catch (error) {
      logger.error('Failed to calculate impact', error);
    }
  }
}
