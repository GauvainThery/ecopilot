import * as vscode from 'vscode';
import type { ImpactProvider } from '../domain/providers/ImpactProvider';
import { EcoLogitsProvider } from '../providers/ecologits/EcoLogitsProvider';
import { logger } from './Logger';

/**
 * Factory for creating and managing environmental impact providers
 * Implements Singleton and Factory patterns for provider instantiation
 */
export class ImpactProviderFactory {
  private static instance: ImpactProviderFactory;
  private provider: ImpactProvider | null = null;
  private extensionContext: vscode.ExtensionContext;

  private constructor(context: vscode.ExtensionContext) {
    this.extensionContext = context;
  }

  static initialize(context: vscode.ExtensionContext): void {
    if (!ImpactProviderFactory.instance) {
      ImpactProviderFactory.instance = new ImpactProviderFactory(context);
    }
  }

  static getInstance(): ImpactProviderFactory {
    if (!ImpactProviderFactory.instance) {
      throw new Error('ImpactProviderFactory not initialized');
    }
    return ImpactProviderFactory.instance;
  }

  async getProvider(): Promise<ImpactProvider> {
    if (this.provider) {
      return this.provider;
    }

    const config = vscode.workspace.getConfiguration('ecopilot');
    const providerName = config.get<string>('impactProvider', 'ecologits');

    logger.info(`Initializing environmental impact provider: ${providerName}`);

    switch (providerName.toLowerCase()) {
      case 'ecologits':
        this.provider = new EcoLogitsProvider(this.extensionContext);
        break;
      default:
        logger.warn(`Unknown provider '${providerName}', falling back to EcoLogits`);
        this.provider = new EcoLogitsProvider(this.extensionContext);
    }

    const isAvailable = await this.provider.isAvailable();
    if (!isAvailable) {
      logger.error(`Provider '${this.provider.name}' is not available`);
      throw new Error(
        `Environmental impact provider '${this.provider.name}' is not properly configured`
      );
    }

    logger.info(`Provider '${this.provider.name}' initialized successfully`);
    return this.provider;
  }

  /**
   * Reset provider (useful for configuration changes)
   */
  reset(): void {
    this.provider = null;
  }
}
