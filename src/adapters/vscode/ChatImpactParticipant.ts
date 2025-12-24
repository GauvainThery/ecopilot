import * as vscode from 'vscode';
import { logger } from '../../infrastructure/Logger';

/**
 * Chat participant that provides /environmental_impact slash command
 * This sends a pre-made prompt to Copilot to calculate the environmental impact
 * using the ecopilot_calculate_impact tool
 */
export class ChatImpactParticipant implements vscode.Disposable {
  private participant: vscode.ChatParticipant;

  constructor() {
    // Create participant that handles /environmental_impact command
    this.participant = vscode.chat.createChatParticipant(
      'ecopilot.impact',
      this.handleRequest.bind(this)
    );

    this.participant.iconPath = vscode.Uri.parse(
      'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="80" font-size="80">🌱</text></svg>'
    );

    logger.info('Chat impact participant registered for /environmental_impact command');
  }

  private async handleRequest(
    request: vscode.ChatRequest,
    _context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    _token: vscode.CancellationToken
  ): Promise<vscode.ChatResult> {
    logger.info('Processing /environmental_impact command');

    // Build the pre-made prompt that will be sent to Copilot
    const prompt = this.buildImpactPrompt(request.prompt);

    // Send the prompt to Copilot by forwarding to the copilot participant
    try {
      // Display what we're doing
      stream.markdown(`🌱 Calculating environmental impact of this conversation...\n\n`);

      // Request Copilot to use the ecopilot tool
      const models = await vscode.lm.selectChatModels({
        vendor: 'copilot',
        family: 'gpt-4o',
      });

      if (models.length === 0) {
        stream.markdown(
          `❌ No language model available. Please ensure GitHub Copilot is active.\n`
        );
        return { metadata: { command: 'environmental_impact', error: true } };
      }

      const model = models[0];
      const messages = [vscode.LanguageModelChatMessage.User(prompt)];

      const chatRequest = await model.sendRequest(
        messages,
        {
          tools: [
            {
              name: 'ecopilot_calculate_impact',
              description: 'Calculate environmental impact of AI usage',
            },
          ],
        },
        _token
      );

      // Stream the response from Copilot
      for await (const fragment of chatRequest.text) {
        stream.markdown(fragment);
      }

      return { metadata: { command: 'environmental_impact' } };
    } catch (error) {
      logger.error('Failed to send impact calculation request', error);
      stream.markdown(
        `❌ Failed to calculate impact: ${error instanceof Error ? error.message : 'Unknown error'}\n`
      );
      return { metadata: { command: 'environmental_impact', error: true } };
    }
  }

  private buildImpactPrompt(additionalContext?: string): string {
    const basePrompt = `Please calculate the environmental impact of our conversation so far. 

Use the #ecopilot_calculate_impact tool to calculate the CO₂ emissions and energy consumption based on:
- The total number of tokens exchanged in this conversation (input + output tokens)
- The model being used for each message

After calculating, please present the results in a clear, user-friendly format showing:
- CO₂ emissions (in grams)
- Energy consumption (in kWh)
- Any cumulative session or weekly statistics if available

Thank you!`;

    if (additionalContext?.trim()) {
      return `${basePrompt}\n\nAdditional context: ${additionalContext}`;
    }

    return basePrompt;
  }

  dispose(): void {
    this.participant.dispose();
  }
}
