import * as fs from 'node:fs';
import * as vscode from 'vscode';
import type { ImpactTracker } from '../../infrastructure/ImpactTracker';
import { logger } from '../../infrastructure/Logger';

/**
 * Dashboard panel for detailed environmental impact statistics
 * Shows comprehensive data with reset functionality
 */
export class DashboardPanel implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private impactTracker: ImpactTracker;
  private extensionUri: vscode.Uri;

  constructor(impactTracker: ImpactTracker, extensionUri: vscode.Uri) {
    this.impactTracker = impactTracker;
    this.extensionUri = extensionUri;
  }

  /**
   * Show the dashboard panel
   */
  show(): void {
    if (this.panel) {
      // Panel already exists, just reveal it
      this.panel.reveal(vscode.ViewColumn.One);
      this.sendDataToWebview();
      return;
    }

    // Create new panel
    this.panel = vscode.window.createWebviewPanel(
      'ecopilotDashboard',
      '🌱 EcoPilot Dashboard',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.extensionUri, 'dist'),
          vscode.Uri.joinPath(this.extensionUri, 'src', 'ui', 'panels', 'dashboard'),
        ],
      }
    );

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });

    // Handle messages from webview
    this.panel.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'resetSession':
          await this.handleResetSession();
          break;
        case 'resetAll':
          await this.handleResetAll();
          break;
        case 'refresh':
        case 'ready':
          this.sendDataToWebview();
          break;
      }
    });

    this.panel.webview.html = this.getHtmlContent(this.panel.webview);
    this.sendDataToWebview();
    logger.info('Impact dashboard panel opened');
  }

  /**
   * Send data to webview
   */
  private sendDataToWebview(): void {
    if (!this.panel) {
      return;
    }

    const sessionTotal = this.impactTracker.getSessionTotal();
    const weeklyStats = this.impactTracker.getWeeklyStats();

    const recentActivity = weeklyStats.stats
      .flatMap((day) =>
        day.totalGwp > 0
          ? day.impacts.map((impact) => ({
              timestamp: impact.timestamp,
              model: impact.model,
              tokens: impact.tokens || 0,
              energy: impact.energy,
              gwp: impact.gwp,
              pe: impact.primaryEnergy,
            }))
          : []
      )
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 20);

    // Calculate usage and embodied totals
    const usageGWP = weeklyStats.stats.reduce(
      (sum, day) => sum + day.impacts.reduce((s, i) => s + (i.usage?.gwp || 0), 0),
      0
    );
    const embodiedGWP = weeklyStats.stats.reduce(
      (sum, day) => sum + day.impacts.reduce((s, i) => s + (i.embodied?.gwp || 0), 0),
      0
    );
    const usageEnergy = weeklyStats.totalEnergy * 0.7; // Approximate 70% usage
    const embodiedADPE = weeklyStats.stats.reduce(
      (sum, day) => sum + day.impacts.reduce((s, i) => s + (i.embodied?.adpe || 0), 0),
      0
    );

    this.panel.webview.postMessage({
      command: 'updateData',
      data: {
        totalEnergy: weeklyStats.totalEnergy,
        totalEmissions: weeklyStats.totalGwp,
        totalPE: weeklyStats.totalPe,
        totalADPE: weeklyStats.totalAdpe,
        totalTokens: weeklyStats.totalTokens,
        totalRequests: weeklyStats.stats.reduce((sum, day) => sum + day.requestCount, 0),
        sessionEnergy: sessionTotal,
        sessionEmissions: sessionTotal,
        usageGWP,
        embodiedGWP,
        usageEnergy,
        embodiedADPE,
        recentActivity,
      },
    });
  }

  /**
   * Handle reset session request
   */
  private async handleResetSession(): Promise<void> {
    const response = await vscode.window.showWarningMessage(
      'Reset session counter? This will clear your current session CO₂ tracking.',
      { modal: true },
      'Reset Session'
    );

    if (response === 'Reset Session') {
      this.impactTracker.resetSession();
      this.sendDataToWebview();
      logger.info('Session counter reset by user');
      vscode.window.showInformationMessage('Session counter reset successfully');
    }
  }

  /**
   * Handle reset all data request
   */
  private async handleResetAll(): Promise<void> {
    const response = await vscode.window.showWarningMessage(
      'Reset ALL environmental impact data? This will permanently delete all historical tracking data.',
      { modal: true },
      'Reset All Data'
    );

    if (response === 'Reset All Data') {
      this.impactTracker.resetAll();
      this.sendDataToWebview();
      logger.info('All data reset by user');
      vscode.window.showInformationMessage('All impact data reset successfully');
    }
  }

  /**
   * Generate HTML content for the webview
   */
  private getHtmlContent(webview: vscode.Webview): string {
    const dashboardPath = vscode.Uri.joinPath(
      this.extensionUri,
      'src',
      'ui',
      'panels',
      'dashboard'
    );

    const htmlPath = vscode.Uri.joinPath(dashboardPath, 'dashboard.html');
    let html = fs.readFileSync(htmlPath.fsPath, 'utf8');

    // Convert resource URIs
    const stylesUri = webview.asWebviewUri(vscode.Uri.joinPath(dashboardPath, 'styles.css'));
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(dashboardPath, 'dashboard.js'));

    // Replace paths in HTML
    html = html.replace('styles.css', stylesUri.toString());
    html = html.replace('dashboard.js', scriptUri.toString());

    // Add CSP
    const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource}; img-src ${webview.cspSource} https:;">`;
    html = html.replace('<meta charset="UTF-8">', `<meta charset="UTF-8">\n  ${csp}`);

    return html;
  }

  dispose(): void {
    if (this.panel) {
      this.panel.dispose();
    }
  }
}
