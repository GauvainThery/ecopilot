/**
 * Unit tests for EcoLogitsProvider
 * Tests Python process integration, error handling, and result parsing
 */

import { EventEmitter } from 'node:events';
import type { CalculationRequest } from '../../domain/models/CalculationRequest';
import { EcoLogitsProvider } from '../../providers/ecologits/EcoLogitsProvider';
import { createMockContext } from '../mocks/vscode';

// Mock child_process
jest.mock('node:child_process');

import { spawn } from 'node:child_process';

const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

describe('EcoLogitsProvider', () => {
  let provider: EcoLogitsProvider;
  let mockContext: any;
  let mockProcess: any;

  beforeEach(() => {
    mockContext = createMockContext();
    provider = new EcoLogitsProvider(mockContext);

    // Create mock process
    mockProcess = new EventEmitter();
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();
    mockProcess.stdin = { end: jest.fn() };

    mockSpawn.mockReturnValue(mockProcess as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('metadata', () => {
    it('should have correct provider name and version', () => {
      expect(provider.name).toBe('EcoLogits');
      expect(provider.version).toBe('1.0.0');
    });
  });

  describe('isAvailable', () => {
    it('should return true when ecologits is installed', async () => {
      const testProcess = new EventEmitter();
      mockSpawn.mockReturnValueOnce(testProcess as any);

      const availablePromise = provider.isAvailable();

      // Simulate successful import
      setTimeout(() => testProcess.emit('close', 0), 10);

      const result = await availablePromise;
      expect(result).toBe(true);
    });

    it('should return false when ecologits is not installed', async () => {
      const testProcess = new EventEmitter();
      mockSpawn.mockReturnValueOnce(testProcess as any);

      const availablePromise = provider.isAvailable();

      // Simulate import error
      setTimeout(() => testProcess.emit('close', 1), 10);

      const result = await availablePromise;
      expect(result).toBe(false);
    });

    it('should return false on process error', async () => {
      const testProcess = new EventEmitter();
      mockSpawn.mockReturnValueOnce(testProcess as any);

      const availablePromise = provider.isAvailable();

      // Simulate process error
      setTimeout(() => testProcess.emit('error', new Error('Process failed')), 10);

      const result = await availablePromise;
      expect(result).toBe(false);
    });
  });

  describe('calculateImpact', () => {
    const createRequest = (): CalculationRequest => ({
      inputTokens: 400,
      outputTokens: 600,
      latencySeconds: 2.5,
      modelName: 'gpt-4',
      electricityMixZone: 'WOR',
    });

    it('should successfully calculate impact with valid response', async () => {
      const request = createRequest();
      const pythonOutput = JSON.stringify({
        gwp_g: 1.234,
        pe_mj: 10.5,
        adpe_kgsbeq: 0.001,
        energy_kwh: 0.005,
        model: 'gpt-4',
        usage: {
          gwp_g: 0.8,
          pe_mj: 7.0,
          adpe_kgsbeq: 0.0007,
        },
        embodied: {
          gwp_g: Math.LOG10E,
          pe_mj: 3.5,
          adpe_kgsbeq: 0.0003,
        },
      });

      const resultPromise = provider.calculateImpact(request);

      // Simulate Python process output
      setTimeout(() => {
        mockProcess.stdout.emit('data', Buffer.from(pythonOutput));
        mockProcess.emit('close', 0);
      }, 10);

      const result = await resultPromise;

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.totalGwp).toBeCloseTo(1.234, 3);
        expect(result.data.totalPrimaryEnergy).toBeCloseTo(10.5, 3);
        expect(result.data.energyConsumption).toBeCloseTo(0.005, 5);
        expect(result.data.metadata.providerName).toBe('EcoLogits');
        expect(result.data.metadata.modelUsed).toBe('gpt-4');
        expect(result.data.usage.gwp).toBeCloseTo(0.8, 3);
        expect(result.data.embodied.gwp).toBeCloseTo(Math.LOG10E, 3);
      }
    });

    it('should handle Python script errors', async () => {
      const request = createRequest();
      const errorOutput = JSON.stringify({
        error: 'Model not found: invalid-model',
      });

      const resultPromise = provider.calculateImpact(request);

      setTimeout(() => {
        mockProcess.stdout.emit('data', Buffer.from(errorOutput));
        mockProcess.emit('close', 0);
      }, 10);

      const result = await resultPromise;

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('CALCULATION_FAILED');
        expect(result.error.message).toContain('Model not found');
      }
    });

    it('should handle invalid JSON response', async () => {
      const request = createRequest();

      const resultPromise = provider.calculateImpact(request);

      setTimeout(() => {
        mockProcess.stdout.emit('data', Buffer.from('invalid json'));
        mockProcess.emit('close', 0);
      }, 10);

      const result = await resultPromise;

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('CALCULATION_FAILED');
        expect(result.error.message).toContain('Failed to parse');
      }
    });

    it('should handle process exit with non-zero code', async () => {
      const request = createRequest();

      const resultPromise = provider.calculateImpact(request);

      setTimeout(() => {
        mockProcess.stderr.emit('data', Buffer.from('Python error'));
        mockProcess.emit('close', 1);
      }, 10);

      const result = await resultPromise;

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('CALCULATION_FAILED');
      }
    });

    it('should handle process spawn errors', async () => {
      const request = createRequest();

      const resultPromise = provider.calculateImpact(request);

      setTimeout(() => {
        mockProcess.emit('error', new Error('Failed to spawn process'));
      }, 10);

      const result = await resultPromise;

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('PROVIDER_UNAVAILABLE');
        expect(result.error.message).toContain('Failed to start calculation process');
      }
    });

    it('should pass correct arguments to Python script', async () => {
      const request = createRequest();

      const resultPromise = provider.calculateImpact(request);

      // Complete the process
      setTimeout(() => {
        mockProcess.stdout.emit(
          'data',
          Buffer.from(
            JSON.stringify({
              gwp_g: 1.0,
              pe_mj: 10.0,
              adpe_kgsbeq: 0.001,
              energy_kwh: 0.005,
              model: 'gpt-4',
              usage: { gwp_g: 0.6, pe_mj: 6.0, adpe_kgsbeq: 0.0006 },
              embodied: { gwp_g: 0.4, pe_mj: 4.0, adpe_kgsbeq: 0.0004 },
            })
          )
        );
        mockProcess.emit('close', 0);
      }, 10);

      await resultPromise;

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.stringContaining('python'),
        expect.arrayContaining([
          expect.stringContaining('calculate_impact.py'),
          '400',
          '600',
          '2.5',
          'gpt-4',
          'WOR',
        ])
      );
    });

    it('should log model info messages as info, not errors', async () => {
      const request = createRequest();
      const modelInfoMessage = 'Using model: gpt-4 (fallback estimates)\n';

      const resultPromise = provider.calculateImpact(request);

      setTimeout(() => {
        mockProcess.stderr.emit('data', Buffer.from(modelInfoMessage));
        mockProcess.stdout.emit(
          'data',
          Buffer.from(
            JSON.stringify({
              gwp_g: 1.0,
              pe_mj: 10.0,
              adpe_kgsbeq: 0.001,
              energy_kwh: 0.005,
              model: 'gpt-4',
              usage: { gwp_g: 0.6, pe_mj: 6.0, adpe_kgsbeq: 0.0006 },
              embodied: { gwp_g: 0.4, pe_mj: 4.0, adpe_kgsbeq: 0.0004 },
            })
          )
        );
        mockProcess.emit('close', 0);
      }, 10);

      const result = await resultPromise;

      // Should still succeed despite stderr output
      expect(result.success).toBe(true);
    });

    it('should handle multi-chunk output', async () => {
      const request = createRequest();
      const outputPart1 = '{"gwp_g": 1.234, "pe_mj": 10.5, ';
      const outputPart2 = '"adpe_kgsbeq": 0.001, "energy_kwh": 0.005, ';
      const outputPart3 =
        '"model": "gpt-4", "usage": {"gwp_g": 0.8, "pe_mj": 7.0, "adpe_kgsbeq": 0.0007}, ';
      const outputPart4 = '"embodied": {"gwp_g": 0.434, "pe_mj": 3.5, "adpe_kgsbeq": 0.0003}}';

      const resultPromise = provider.calculateImpact(request);

      setTimeout(() => {
        mockProcess.stdout.emit('data', Buffer.from(outputPart1));
        mockProcess.stdout.emit('data', Buffer.from(outputPart2));
        mockProcess.stdout.emit('data', Buffer.from(outputPart3));
        mockProcess.stdout.emit('data', Buffer.from(outputPart4));
        mockProcess.emit('close', 0);
      }, 10);

      const result = await resultPromise;

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.totalGwp).toBeCloseTo(1.234, 3);
      }
    });
  });
});
