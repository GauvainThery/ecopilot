import * as vscode from 'vscode';
import type { ImpactTracker } from '../../infrastructure/ImpactTracker';

/**
 * Hover provider for environmental impact information
 * Shows CO₂ impact details when hovering over AI-tracked code
 */
export class HoverProvider implements vscode.HoverProvider {
  private impactTracker: ImpactTracker;

  constructor(impactTracker: ImpactTracker) {
    this.impactTracker = impactTracker;
  }

  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Hover> {
    // Get diagnostics for this document
    const diagnostics = vscode.languages.getDiagnostics(document.uri);

    // Find EcoPilot diagnostic at this position
    const diagnostic = diagnostics.find(
      (d) => d.source === 'EcoPilot' && d.range.contains(position)
    );

    if (!diagnostic) {
      return undefined;
    }

    // Build hover content
    const sessionTotal = this.impactTracker.getSessionTotal();
    const weeklyStats = this.impactTracker.getWeeklyStats();

    const markdown = new vscode.MarkdownString();
    markdown.supportHtml = true;
    markdown.isTrusted = true;

    markdown.appendMarkdown('## 🌱 Environmental Impact\n\n');
    markdown.appendMarkdown(`**This Section**  \n${diagnostic.message}\n\n`);
    markdown.appendMarkdown('---\n\n');
    markdown.appendMarkdown('### Session Metrics\n\n');
    markdown.appendMarkdown(`**CO₂**: ${sessionTotal.toFixed(2)} g CO₂eq  \n`);
    markdown.appendMarkdown('\n### Weekly Totals (7 days)\n\n');
    markdown.appendMarkdown(`**GWP**: ${weeklyStats.totalGwp.toFixed(2)} g CO₂eq  \n`);
    markdown.appendMarkdown(`**Energy**: ${weeklyStats.totalEnergy.toFixed(4)} kWh  \n`);
    markdown.appendMarkdown(`**Primary Energy**: ${weeklyStats.totalPe.toFixed(2)} MJ  \n`);
    markdown.appendMarkdown(`**ADPE**: ${weeklyStats.totalAdpe.toFixed(8)} kg Sb eq  \n`);
    markdown.appendMarkdown('\n---\n\n');

    // Add clickable command link to open detailed dashboard
    const commandUri = vscode.Uri.parse(`command:ecopilot.openDashboard`);
    markdown.appendMarkdown(
      `[📊 Open Dashboard](${commandUri}) • [📈 View Analytics](${commandUri})\n\n`
    );

    markdown.appendMarkdown('_All metrics calculated using EcoLogits LLM Impact Model_\n');

    return new vscode.Hover(markdown, diagnostic.range);
  }
}
