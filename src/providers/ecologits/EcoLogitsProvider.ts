import { spawn } from 'node:child_process';
import * as path from 'node:path';
import * as vscode from 'vscode';
import type { CalculationError } from '../../domain/errors/CalculationError';
import type { CalculationRequest } from '../../domain/models/CalculationRequest';
import type { ImpactCalculation } from '../../domain/models/ImpactMetrics';
import type { ImpactProvider } from '../../domain/providers/ImpactProvider';
import type { Result } from '../../domain/types/Result';
import { logger } from '../../infrastructure/Logger';

/**
 * EcoLogits implementation of environmental impact provider
 * Uses Python EcoLogits library for calculations
 */
export class EcoLogitsProvider implements ImpactProvider {
  readonly name = 'EcoLogits';
  readonly version = '1.0.0';
  private scriptPath: string;
  private pythonPath: string;

  constructor(extensionContext: vscode.ExtensionContext) {
    this.scriptPath = vscode.Uri.joinPath(
      extensionContext.extensionUri,
      'src',
      'providers',
      'ecologits',
      'calculate_impact.py'
    ).fsPath;
    this.pythonPath = path.join(extensionContext.extensionPath, '.venv', 'bin', 'python');
  }

  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const testProcess = spawn(this.pythonPath, ['-c', 'import ecologits']);
      testProcess.on('close', (code) => {
        resolve(code === 0);
      });
      testProcess.on('error', () => {
        resolve(false);
      });
    });
  }

  async calculateImpact(
    request: CalculationRequest
  ): Promise<Result<ImpactCalculation, CalculationError>> {
    return new Promise((resolve) => {
      const pythonProcess = spawn(this.pythonPath, [
        this.scriptPath,
        request.inputTokens.toString(),
        request.outputTokens.toString(),
        request.latencySeconds.toString(),
        request.modelName,
        request.electricityMixZone,
      ]);

      let output = '';
      let errorOutput = '';

      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
        // Don't log model info messages as errors
        const message = data.toString();
        if (message.includes('Using model:') || message.includes('fallback estimates')) {
          logger.info(`EcoLogits: ${message.trim()}`);
        } else {
          logger.error('EcoLogits process error', message);
        }
      });

      pythonProcess.on('close', (code) => {
        if (code === 0 && output.trim()) {
          try {
            const result = JSON.parse(output.trim());

            if (result.error) {
              resolve({
                success: false,
                error: this.createError('CALCULATION_FAILED', result.error),
              });
              return;
            }

            const impact: ImpactCalculation = {
              totalGwp: result.gwp_g,
              totalPrimaryEnergy: result.pe_mj,
              totalAdpe: result.adpe_kgsbeq,
              energyConsumption: result.energy_kwh,
              usage: {
                gwp: result.usage.gwp_g,
                primaryEnergy: result.usage.pe_mj,
                adpe: result.usage.adpe_kgsbeq,
              },
              embodied: {
                gwp: result.embodied.gwp_g,
                primaryEnergy: result.embodied.pe_mj,
                adpe: result.embodied.adpe_kgsbeq,
              },
              metadata: {
                providerName: this.name,
                providerVersion: this.version,
                modelUsed: result.model,
                calculationMethod: 'EcoLogits LLM Impact Model',
              },
            };

            resolve({ success: true, data: impact });
          } catch (error) {
            logger.error('Failed to parse EcoLogits result', error);
            resolve({
              success: false,
              error: this.createError(
                'CALCULATION_FAILED',
                'Failed to parse calculation result',
                error
              ),
            });
          }
        } else {
          const errorMsg = errorOutput || `Process exited with code ${code}`;
          resolve({
            success: false,
            error: this.createError('CALCULATION_FAILED', errorMsg),
          });
        }
      });

      pythonProcess.on('error', (error) => {
        logger.error('Failed to spawn EcoLogits process', error);
        resolve({
          success: false,
          error: this.createError(
            'PROVIDER_UNAVAILABLE',
            'Failed to start calculation process',
            error
          ),
        });
      });
    });
  }

  private createError(
    code: CalculationError['code'],
    message: string,
    details?: unknown
  ): CalculationError {
    return { code, message, details };
  }
}
