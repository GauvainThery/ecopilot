/**
 * Unit tests for domain models
 * Tests validation and type safety
 */

import type { CalculationError } from '../../domain/errors/CalculationError';
import type { CalculationRequest } from '../../domain/models/CalculationRequest';
import type { ImpactCalculation, ImpactMetrics } from '../../domain/models/ImpactMetrics';
import type { Result } from '../../domain/types/Result';

describe('Domain Models', () => {
  describe('CalculationRequest', () => {
    it('should have required properties', () => {
      const request: CalculationRequest = {
        inputTokens: 400,
        outputTokens: 600,
        latencySeconds: 2.5,
        modelName: 'gpt-4',
        electricityMixZone: 'WOR',
      };

      expect(request.inputTokens).toBe(400);
      expect(request.outputTokens).toBe(600);
      expect(request.latencySeconds).toBe(2.5);
      expect(request.modelName).toBe('gpt-4');
      expect(request.electricityMixZone).toBe('WOR');
    });
  });

  describe('ImpactMetrics', () => {
    it('should represent impact metrics correctly', () => {
      const metrics: ImpactMetrics = {
        gwp: 1.5,
        primaryEnergy: 10.0,
        adpe: 0.001,
      };

      expect(metrics.gwp).toBe(1.5);
      expect(metrics.primaryEnergy).toBe(10.0);
      expect(metrics.adpe).toBe(0.001);
    });
  });

  describe('ImpactCalculation', () => {
    it('should contain complete calculation result', () => {
      const calculation: ImpactCalculation = {
        totalGwp: 2.0,
        totalPrimaryEnergy: 15.0,
        totalAdpe: 0.002,
        energyConsumption: 0.008,
        usage: {
          gwp: 1.4,
          primaryEnergy: 10.5,
          adpe: 0.0014,
        },
        embodied: {
          gwp: 0.6,
          primaryEnergy: 4.5,
          adpe: 0.0006,
        },
        metadata: {
          providerName: 'EcoLogits',
          providerVersion: '1.0.0',
          modelUsed: 'gpt-4',
          calculationMethod: 'EcoLogits LLM Impact Model',
        },
      };

      expect(calculation.totalGwp).toBe(2.0);
      expect(calculation.usage.gwp + calculation.embodied.gwp).toBe(2.0);
      expect(calculation.metadata.providerName).toBe('EcoLogits');
    });
  });

  describe('Result type', () => {
    it('should represent success result', () => {
      const result: Result<number, Error> = {
        success: true,
        data: 42,
      };

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(42);
      }
    });

    it('should represent error result', () => {
      const result: Result<number, Error> = {
        success: false,
        error: new Error('Something went wrong'),
      };

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Something went wrong');
      }
    });

    it('should work with custom error types', () => {
      const result: Result<ImpactCalculation, CalculationError> = {
        success: false,
        error: {
          code: 'CALCULATION_FAILED',
          message: 'Model not found',
        },
      };

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('CALCULATION_FAILED');
        expect(result.error.message).toBe('Model not found');
      }
    });

    it('should ensure type safety with discriminated union', () => {
      const successResult: Result<string, Error> = {
        success: true,
        data: 'test',
      };

      const errorResult: Result<string, Error> = {
        success: false,
        error: new Error('fail'),
      };

      // TypeScript should enforce this at compile time
      // These tests verify runtime behavior
      if (successResult.success) {
        expect('data' in successResult).toBe(true);
        expect('error' in successResult).toBe(false);
      }

      if (!errorResult.success) {
        expect('error' in errorResult).toBe(true);
        expect('data' in errorResult).toBe(false);
      }
    });
  });

  describe('CalculationError', () => {
    it('should support different error codes', () => {
      const errors: CalculationError[] = [
        { code: 'CALCULATION_FAILED', message: 'Calculation failed' },
        { code: 'PROVIDER_UNAVAILABLE', message: 'Provider not available' },
        { code: 'INVALID_MODEL', message: 'Invalid model' },
        { code: 'UNKNOWN_ERROR', message: 'Unknown error' },
      ];

      errors.forEach((error) => {
        expect(error.code).toBeDefined();
        expect(error.message).toBeDefined();
      });
    });

    it('should support optional details', () => {
      const error: CalculationError = {
        code: 'CALCULATION_FAILED',
        message: 'Calculation failed',
        details: { tokens: 1000, model: 'gpt-4' },
      };

      expect(error.details).toBeDefined();
      expect(error.details).toHaveProperty('tokens');
      expect(error.details).toHaveProperty('model');
    });
  });
});
