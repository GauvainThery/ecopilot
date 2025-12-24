/**
 * Unit tests for ImpactMonitor
 * Tests application service coordination between provider and tracker
 */

import * as vscode from 'vscode';
import { ImpactMonitor } from '../../application/ImpactMonitor';
import type { CalculationError } from '../../domain/errors/CalculationError';
import type { ImpactCalculation } from '../../domain/models/ImpactMetrics';
import type { ImpactProvider } from '../../domain/providers/ImpactProvider';
import type { Result } from '../../domain/types/Result';
import { ImpactProviderFactory } from '../../infrastructure/ImpactProviderFactory';
import type { ImpactTracker } from '../../infrastructure/ImpactTracker';

// Mock dependencies
jest.mock('../../infrastructure/ImpactProviderFactory');
jest.mock('../../infrastructure/ImpactTracker');

describe('ImpactMonitor', () => {
  let monitor: ImpactMonitor;
  let mockTracker: jest.Mocked<ImpactTracker>;
  let mockProvider: jest.Mocked<ImpactProvider>;
  let onImpactCalculatedCallback: jest.Mock;
  let mockConfig: any;

  beforeEach(() => {
    // Setup mocks
    mockTracker = {
      addImpact: jest.fn(),
      getSessionTotal: jest.fn(),
      resetSession: jest.fn(),
      resetAll: jest.fn(),
      getWeeklyStats: jest.fn(),
    } as any;

    mockProvider = {
      name: 'EcoLogits',
      version: '1.0.0',
      isAvailable: jest.fn().mockResolvedValue(true),
      calculateImpact: jest.fn(),
    };

    onImpactCalculatedCallback = jest.fn();

    // Mock configuration
    mockConfig = {
      get: jest.fn((key: string, defaultValue?: any) => {
        if (key === 'electricityMix') {
          return 'WOR';
        }
        return defaultValue;
      }),
    };
    (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);

    // Mock factory to return our mock provider
    (ImpactProviderFactory.getInstance as jest.Mock).mockReturnValue({
      getProvider: jest.fn().mockResolvedValue(mockProvider),
    });

    monitor = new ImpactMonitor(mockTracker, onImpactCalculatedCallback);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateImpact', () => {
    const successResult: Result<ImpactCalculation, CalculationError> = {
      success: true,
      data: {
        totalGwp: 1.5,
        totalPrimaryEnergy: 12.0,
        totalAdpe: 0.002,
        energyConsumption: 0.006,
        usage: {
          gwp: 1.0,
          primaryEnergy: 8.0,
          adpe: 0.0015,
        },
        embodied: {
          gwp: 0.5,
          primaryEnergy: 4.0,
          adpe: 0.0005,
        },
        metadata: {
          providerName: 'EcoLogits',
          providerVersion: '1.0.0',
          modelUsed: 'gpt-4',
          calculationMethod: 'EcoLogits LLM Impact Model',
        },
      },
    };

    it('should successfully calculate and track impact', async () => {
      mockProvider.calculateImpact.mockResolvedValue(successResult);

      await monitor.calculateImpact(400, 600, 2.5, 'chat', true, 'gpt-4');

      expect(mockProvider.calculateImpact).toHaveBeenCalledWith({
        inputTokens: 400,
        outputTokens: 600,
        latencySeconds: 2.5,
        modelName: 'gpt-4',
        electricityMixZone: 'WOR',
      });

      expect(mockTracker.addImpact).toHaveBeenCalledWith(
        expect.objectContaining({
          gwp: 1.5,
          primaryEnergy: 12.0,
          adpe: 0.002,
          energy: 0.006,
          model: 'gpt-4',
          tokens: 1000,
          inputTokens: 400,
          outputTokens: 600,
          latency: 2.5,
          source: 'chat',
          isRealTokenCount: true,
        })
      );

      expect(onImpactCalculatedCallback).toHaveBeenCalled();
    });

    it('should use provided electricity mix zone', async () => {
      mockProvider.calculateImpact.mockResolvedValue(successResult);

      await monitor.calculateImpact(400, 600, 2.5, 'chat', true, 'gpt-4', 'FRA');

      expect(mockProvider.calculateImpact).toHaveBeenCalledWith(
        expect.objectContaining({
          electricityMixZone: 'FRA',
        })
      );
    });

    it('should use configured electricity mix when not provided', async () => {
      mockProvider.calculateImpact.mockResolvedValue(successResult);
      mockConfig.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'electricityMix') {
          return 'USA';
        }
        return defaultValue;
      });

      await monitor.calculateImpact(400, 600, 2.5, 'chat', true, 'gpt-4');

      expect(mockProvider.calculateImpact).toHaveBeenCalledWith(
        expect.objectContaining({
          electricityMixZone: 'USA',
        })
      );
    });

    it('should handle completion source', async () => {
      mockProvider.calculateImpact.mockResolvedValue(successResult);

      await monitor.calculateImpact(200, 300, 1.0, 'completion', false, 'gpt-3.5-turbo');

      expect(mockTracker.addImpact).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'completion',
          isRealTokenCount: false,
        })
      );
    });

    it('should handle calculation errors gracefully', async () => {
      const errorResult: Result<ImpactCalculation, CalculationError> = {
        success: false,
        error: {
          code: 'CALCULATION_FAILED',
          message: 'Model not found: invalid-model',
        },
      };

      mockProvider.calculateImpact.mockResolvedValue(errorResult);

      await monitor.calculateImpact(400, 600, 2.5, 'chat', true, 'invalid-model');

      expect(mockTracker.addImpact).not.toHaveBeenCalled();
      expect(onImpactCalculatedCallback).not.toHaveBeenCalled();
    });

    it('should show warning for unsupported models', async () => {
      const errorResult: Result<ImpactCalculation, CalculationError> = {
        success: false,
        error: {
          code: 'CALCULATION_FAILED',
          message: 'Model not found: custom-model',
        },
      };

      mockProvider.calculateImpact.mockResolvedValue(errorResult);

      await monitor.calculateImpact(400, 600, 2.5, 'chat', true, 'custom-model');

      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        expect.stringContaining("Model 'custom-model' is not supported")
      );
    });

    it('should show warning for "not supported" errors', async () => {
      const errorResult: Result<ImpactCalculation, CalculationError> = {
        success: false,
        error: {
          code: 'CALCULATION_FAILED',
          message: 'Model not supported by provider',
        },
      };

      mockProvider.calculateImpact.mockResolvedValue(errorResult);

      await monitor.calculateImpact(400, 600, 2.5, 'chat', true, 'unknown-model');

      expect(vscode.window.showWarningMessage).toHaveBeenCalled();
    });

    it('should handle provider exceptions', async () => {
      mockProvider.calculateImpact.mockRejectedValue(new Error('Provider crashed'));

      await monitor.calculateImpact(400, 600, 2.5, 'chat', true, 'custom-model');

      expect(mockTracker.addImpact).not.toHaveBeenCalled();
      expect(onImpactCalculatedCallback).not.toHaveBeenCalled();
    });

    it('should get provider from factory', async () => {
      mockProvider.calculateImpact.mockResolvedValue(successResult);
      const mockFactory = {
        getProvider: jest.fn().mockResolvedValue(mockProvider),
      };
      (ImpactProviderFactory.getInstance as jest.Mock).mockReturnValue(mockFactory);

      await monitor.calculateImpact(400, 600, 2.5, 'chat', true, 'gpt-4');

      expect(mockFactory.getProvider).toHaveBeenCalled();
    });

    it('should include timestamp in impact record', async () => {
      mockProvider.calculateImpact.mockResolvedValue(successResult);
      const beforeTime = Date.now();

      await monitor.calculateImpact(400, 600, 2.5, 'chat', true, 'gpt-4');

      const afterTime = Date.now();
      const capturedImpact = mockTracker.addImpact.mock.calls[0][0];

      expect(capturedImpact.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(capturedImpact.timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('should include usage and embodied breakdowns', async () => {
      mockProvider.calculateImpact.mockResolvedValue(successResult);

      await monitor.calculateImpact(400, 600, 2.5, 'chat', true, 'gpt-4');

      expect(mockTracker.addImpact).toHaveBeenCalledWith(
        expect.objectContaining({
          usage: {
            gwp: 1.0,
            primaryEnergy: 8.0,
            adpe: 0.0015,
          },
          embodied: {
            gwp: 0.5,
            primaryEnergy: 4.0,
            adpe: 0.0005,
          },
        })
      );
    });

    it('should handle different model names', async () => {
      const models = ['gpt-4', 'gpt-3.5-turbo', 'claude-3-opus', 'gemini-pro'];

      for (const model of models) {
        const result: Result<ImpactCalculation, CalculationError> = {
          success: true,
          data: {
            ...successResult.data,
            metadata: {
              ...successResult.data.metadata,
              modelUsed: model,
            },
          },
        };

        mockProvider.calculateImpact.mockResolvedValue(result);

        await monitor.calculateImpact(400, 600, 2.5, 'chat', true, model);

        expect(mockProvider.calculateImpact).toHaveBeenCalledWith(
          expect.objectContaining({
            modelName: model,
          })
        );
      }
    });
  });
});
