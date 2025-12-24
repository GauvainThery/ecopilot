import * as vscode from 'vscode';

/**
 * Logger utility for EcoPilot extension
 * Logs are visible in:
 * 1. Output panel: View → Output → Select "EcoPilot" from dropdown
 * 2. Debug Console: When running in debug mode (F5)
 * 3. Developer Tools Console: Help → Toggle Developer Tools → Console tab
 */
class Logger {
  private outputChannel: vscode.OutputChannel;
  private static instance: Logger;

  private constructor() {
    this.outputChannel = vscode.window.createOutputChannel('EcoPilot');
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  info(message: string, data?: unknown): void {
    const formattedMessage = this.formatMessage('INFO', message, data);
    this.outputChannel.appendLine(formattedMessage);
    console.log(`[EcoPilot] ${formattedMessage}`);
  }

  warn(message: string, data?: unknown): void {
    const formattedMessage = this.formatMessage('WARN', message, data);
    this.outputChannel.appendLine(formattedMessage);
    console.warn(`[EcoPilot] ${formattedMessage}`);
  }

  error(message: string, error?: unknown, data?: unknown): void {
    const formattedMessage = this.formatMessage('ERROR', message, data);
    this.outputChannel.appendLine(formattedMessage);
    if (error) {
      const errorStr = error instanceof Error ? error.stack || error.message : String(error);
      this.outputChannel.appendLine(`  ${errorStr}`);
      console.error(`[EcoPilot] ${formattedMessage}`, error);
    } else {
      console.error(`[EcoPilot] ${formattedMessage}`);
    }
  }

  debug(message: string, data?: unknown): void {
    const formattedMessage = this.formatMessage('DEBUG', message, data);
    this.outputChannel.appendLine(formattedMessage);
  }

  show(): void {
    this.outputChannel.show();
  }

  private formatMessage(level: string, message: string, data?: unknown): string {
    const timestamp = new Date().toISOString().substring(11, 23); // HH:MM:SS.mmm
    const dataStr = data !== undefined ? ` ${JSON.stringify(data)}` : '';
    return `[${timestamp}] [${level}] ${message}${dataStr}`;
  }

  dispose(): void {
    this.outputChannel.dispose();
  }
}

export const logger = Logger.getInstance();
