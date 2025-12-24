import * as vscode from 'vscode';
import { ChatImpactParticipant } from './adapters/vscode/ChatImpactParticipant';
import { LanguageModelToolAdapter } from './adapters/vscode/LanguageModelToolAdapter';
import { ImpactMonitor } from './application/ImpactMonitor';
import { ImpactProviderFactory } from './infrastructure/ImpactProviderFactory';
import { ImpactTracker } from './infrastructure/ImpactTracker';
import { logger } from './infrastructure/Logger';
import { DashboardPanel } from './ui/panels/DashboardPanel';

let impactTracker: ImpactTracker;
let impactMonitor: ImpactMonitor;
let statusBarItem: vscode.StatusBarItem;
let dashboardPanel: DashboardPanel;
let chatParticipant: ChatImpactParticipant;

function updateStatusBar() {
  const sessionTotal = impactTracker.getSessionTotal();

  // Format display
  let displayValue: string;
  let unit: string;

  if (sessionTotal >= 1000) {
    displayValue = (sessionTotal / 1000).toFixed(3);
    unit = 'kg';
  } else {
    displayValue = sessionTotal.toFixed(2);
    unit = 'g';
  }

  statusBarItem.text = `${displayValue} ${unit} CO₂`;
}

export async function activate(context: vscode.ExtensionContext) {
  logger.info('EcoPilot activating...');

  // Initialize provider factory
  ImpactProviderFactory.initialize(context);

  // Initialize core services
  impactTracker = new ImpactTracker(context);

  // Create status bar
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'ecopilot.openDashboard';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Initialize monitor with callback to update status bar and code actions provider
  impactMonitor = new ImpactMonitor(impactTracker, () => updateStatusBar());

  // Register language model tool for agent mode
  const languageModelTool = new LanguageModelToolAdapter(impactMonitor, impactTracker);
  context.subscriptions.push(languageModelTool);

  // Register chat participant for /environmental_impact command
  chatParticipant = new ChatImpactParticipant();
  context.subscriptions.push(chatParticipant);

  // Initialize dashboard panel
  dashboardPanel = new DashboardPanel(impactTracker, context.extensionUri);
  context.subscriptions.push(dashboardPanel);

  // Register commands for code actions
  context.subscriptions.push(
    vscode.commands.registerCommand('ecopilot.openDashboard', () => {
      dashboardPanel.show();
    }),
    vscode.commands.registerCommand('ecopilot.showSessionStats', () => {
      const sessionTotal = impactTracker.getSessionTotal();
      vscode.window.showInformationMessage(`🌱 Session Impact: ${sessionTotal.toFixed(2)} g CO₂eq`);
    }),
    vscode.commands.registerCommand('ecopilot.showWeeklyStats', () => {
      const weeklyStats = impactTracker.getWeeklyStats();
      vscode.window.showInformationMessage(
        `📊 Weekly Impact: ${weeklyStats.totalGwp.toFixed(2)} g CO₂eq | Energy: ${weeklyStats.totalEnergy.toFixed(6)} kWh`
      );
    })
  );

  // Initial status bar update
  updateStatusBar();

  // Show welcome message
  vscode.window.showInformationMessage(
    '🌱 EcoPilot active! Tracking environmental impact of AI usage.'
  );

  logger.info('EcoPilot activated successfully');
}

export function deactivate() {
  logger.info('EcoPilot deactivating...');
}
