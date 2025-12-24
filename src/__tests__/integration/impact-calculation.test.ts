/**
 * Integration tests for end-to-end impact calculation flow
 * Tests the full stack from monitor through provider to tracker
 */

import { EventEmitter } from 'node:events';
import { ImpactMonitor } from '../../application/ImpactMonitor';
import { ImpactProviderFactory } from '../../infrastructure/ImpactProviderFactory';
import { ImpactTracker } from '../../infrastructure/ImpactTracker';
import { createMockContext } from '../mocks/vscode';

// Mock child_process for EcoLogits
jest.mock('node:child_process');

import { spawn } from 'node:child_process';

const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

describe('Impact Calculation Integration', () => {
  let mockContext: any;
  let mockProcess: any;

  beforeEach(() => {
    mockContext = createMockContext();

    // Setup storage mock
    const storageData = new Map();
    mockContext.globalState.get = jest.fn((key: string) => storageData.get(key));
    mockContext.globalState.update = jest.fn((key: string, value: any) => {
      storageData.set(key, value);
      return Promise.resolve();
    });

    // Setup mock process for EcoLogits
    mockProcess = new EventEmitter();
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();
    mockProcess.stdin = { end: jest.fn() };
    mockSpawn.mockReturnValue(mockProcess as any);

    // Initialize factory
    ImpactProviderFactory.initialize(mockContext);
  });

  afterEach(() => {
    jest.clearAllMocks();
    (ImpactProviderFactory as any).instance = null;
  });

  describe('full calculation flow', () => {
    it('should calculate impact end-to-end with real components', async () => {
      const tracker = new ImpactTracker(mockContext);
      const onCalculated = jest.fn();
      const monitor = new ImpactMonitor(tracker, onCalculated);

      // Setup provider availability check
      const availabilityProcess = new EventEmitter();
      mockSpawn.mockReturnValueOnce(availabilityProcess as any);
      setTimeout(() => availabilityProcess.emit('close', 0), 10);

      // Setup calculation response
      const pythonOutput = JSON.stringify({
        gwp_g: 2.5,
        pe_mj: 20.0,
        adpe_kgsbeq: 0.003,
        energy_kwh: 0.01,
        model: 'gpt-4',
        usage: {
          gwp_g: 1.8,
          pe_mj: 14.0,
          adpe_kgsbeq: 0.002,
        },
        embodied: {
          gwp_g: 0.7,
          pe_mj: 6.0,
          adpe_kgsbeq: 0.001,
        },
      });

      const calculationPromise = monitor.calculateImpact(
        600,
        900,
        3.2,
        'chat',
        true,
        'gpt-4',
        'WOR'
      );

      // Simulate Python process
      setTimeout(() => {
        mockProcess.stdout.emit('data', Buffer.from(pythonOutput));
        mockProcess.emit('close', 0);
      }, 20);

      await calculationPromise;

      // Verify impact was tracked
      expect(tracker.getSessionTotal()).toBeCloseTo(2.5, 5);

      // Verify callback was called
      expect(onCalculated).toHaveBeenCalledTimes(1);

      // Verify weekly stats include the impact
      const stats = tracker.getWeeklyStats();
      expect(stats.totalGwp).toBeCloseTo(2.5, 5);
    });

    it('should handle multiple sequential calculations', async () => {
      const tracker = new ImpactTracker(mockContext);
      const onCalculated = jest.fn();
      const monitor = new ImpactMonitor(tracker, onCalculated);

      // Provider availability
      const availabilityProcess = new EventEmitter();
      mockSpawn.mockReturnValueOnce(availabilityProcess as any);
      setTimeout(() => availabilityProcess.emit('close', 0), 10);

      const calculations = [
        { tokens: 1000, gwp: 1.5 },
        { tokens: 2000, gwp: 2.8 },
        { tokens: 500, gwp: 0.7 },
      ];

      for (const calc of calculations) {
        const output = JSON.stringify({
          gwp_g: calc.gwp,
          pe_mj: 10.0,
          adpe_kgsbeq: 0.001,
          energy_kwh: 0.005,
          model: 'gpt-4',
          usage: { gwp_g: calc.gwp * 0.7, pe_mj: 7.0, adpe_kgsbeq: 0.0007 },
          embodied: { gwp_g: calc.gwp * 0.3, pe_mj: 3.0, adpe_kgsbeq: 0.0003 },
        });

        const inputTokens = Math.floor(calc.tokens * 0.4);
        const outputTokens = calc.tokens - inputTokens;
        const promise = monitor.calculateImpact(
          inputTokens,
          outputTokens,
          2.0,
          'chat',
          true,
          'gpt-4'
        );

        setTimeout(() => {
          mockProcess.stdout.emit('data', Buffer.from(output));
          mockProcess.emit('close', 0);
        }, 20);

        await promise;
      }

      // Total should be sum of all calculations
      const expectedTotal = calculations.reduce((sum, c) => sum + c.gwp, 0);
      expect(tracker.getSessionTotal()).toBeCloseTo(expectedTotal, 5);
      expect(onCalculated).toHaveBeenCalledTimes(calculations.length);
    });

    it('should persist impacts across tracker instances', async () => {
      // First tracker instance
      const tracker1 = new ImpactTracker(mockContext);
      const onCalculated1 = jest.fn();
      const monitor1 = new ImpactMonitor(tracker1, onCalculated1);

      // Provider availability
      const availabilityProcess = new EventEmitter();
      mockSpawn.mockReturnValueOnce(availabilityProcess as any);
      setTimeout(() => availabilityProcess.emit('close', 0), 10);

      const pythonOutput = JSON.stringify({
        gwp_g: 3.0,
        pe_mj: 25.0,
        adpe_kgsbeq: 0.004,
        energy_kwh: 0.012,
        model: 'gpt-4',
        usage: { gwp_g: 2.1, pe_mj: 17.5, adpe_kgsbeq: 0.0028 },
        embodied: { gwp_g: 0.9, pe_mj: 7.5, adpe_kgsbeq: 0.0012 },
      });

      const promise = monitor1.calculateImpact(800, 1200, 3.0, 'chat', true, 'gpt-4');

      setTimeout(() => {
        mockProcess.stdout.emit('data', Buffer.from(pythonOutput));
        mockProcess.emit('close', 0);
      }, 20);

      await promise;

      // Create new tracker instance (simulating extension reload)
      const tracker2 = new ImpactTracker(mockContext);

      // Should load persisted data
      const stats = tracker2.getWeeklyStats();
      expect(stats.totalGwp).toBeCloseTo(3.0, 5);
    });

    it('should handle provider errors gracefully', async () => {
      const tracker = new ImpactTracker(mockContext);
      const onCalculated = jest.fn();
      const monitor = new ImpactMonitor(tracker, onCalculated);

      // Provider availability
      const availabilityProcess = new EventEmitter();
      mockSpawn.mockReturnValueOnce(availabilityProcess as any);
      setTimeout(() => availabilityProcess.emit('close', 0), 10);

      // Simulate provider error
      const errorOutput = JSON.stringify({
        error: 'Model not supported',
      });

      const promise = monitor.calculateImpact(400, 600, 2.0, 'chat', true, 'invalid-model');

      setTimeout(() => {
        mockProcess.stdout.emit('data', Buffer.from(errorOutput));
        mockProcess.emit('close', 0);
      }, 20);

      await promise;

      // Should not track failed calculation
      expect(tracker.getSessionTotal()).toBe(0);
      expect(onCalculated).not.toHaveBeenCalled();
    });

    it('should aggregate impacts by day correctly', async () => {
      const tracker = new ImpactTracker(mockContext);
      const onCalculated = jest.fn();
      const monitor = new ImpactMonitor(tracker, onCalculated);

      // Provider availability
      const availabilityProcess = new EventEmitter();
      mockSpawn.mockReturnValueOnce(availabilityProcess as any);
      setTimeout(() => availabilityProcess.emit('close', 0), 10);

      // Add multiple impacts
      const impacts = [
        { gwp: 1.0, tokens: 1000 },
        { gwp: 1.5, tokens: 1500 },
        { gwp: 2.0, tokens: 2000 },
      ];

      for (const impact of impacts) {
        const output = JSON.stringify({
          gwp_g: impact.gwp,
          pe_mj: 10.0,
          adpe_kgsbeq: 0.001,
          energy_kwh: 0.005,
          model: 'gpt-4',
          usage: { gwp_g: impact.gwp * 0.7, pe_mj: 7.0, adpe_kgsbeq: 0.0007 },
          embodied: { gwp_g: impact.gwp * 0.3, pe_mj: 3.0, adpe_kgsbeq: 0.0003 },
        });

        const inputTokens = Math.floor(impact.tokens * 0.4);
        const outputTokens = impact.tokens - inputTokens;
        const promise = monitor.calculateImpact(
          inputTokens,
          outputTokens,
          2.0,
          'chat',
          true,
          'gpt-4'
        );

        setTimeout(() => {
          mockProcess.stdout.emit('data', Buffer.from(output));
          mockProcess.emit('close', 0);
        }, 20);

        await promise;
      }

      const stats = tracker.getWeeklyStats();
      const today = stats.stats.find((s: any) => s.date === new Date().toISOString().split('T')[0]);

      expect(today).toBeDefined();
      expect(today?.requestCount).toBe(3);
      expect(today?.totalGwp).toBeCloseTo(4.5, 5);
      expect(today?.totalTokens).toBe(4500);
    });
  });

  describe('provider factory integration', () => {
    it('should initialize and cache provider correctly', async () => {
      const tracker = new ImpactTracker(mockContext);
      const onCalculated = jest.fn();
      const monitor = new ImpactMonitor(tracker, onCalculated);

      // First calculation - provider initialization
      const availabilityProcess1 = new EventEmitter();
      mockSpawn.mockReturnValueOnce(availabilityProcess1 as any);
      setTimeout(() => availabilityProcess1.emit('close', 0), 10);

      const output1 = JSON.stringify({
        gwp_g: 1.0,
        pe_mj: 10.0,
        adpe_kgsbeq: 0.001,
        energy_kwh: 0.005,
        model: 'gpt-4',
        usage: { gwp_g: 0.7, pe_mj: 7.0, adpe_kgsbeq: 0.0007 },
        embodied: { gwp_g: 0.3, pe_mj: 3.0, adpe_kgsbeq: 0.0003 },
      });

      const promise1 = monitor.calculateImpact(400, 600, 2.0, 'chat', true, 'gpt-4');
      setTimeout(() => {
        mockProcess.stdout.emit('data', Buffer.from(output1));
        mockProcess.emit('close', 0);
      }, 20);
      await promise1;

      // Second calculation - should reuse provider
      const promise2 = monitor.calculateImpact(400, 600, 2.0, 'chat', true, 'gpt-4');
      setTimeout(() => {
        mockProcess.stdout.emit('data', Buffer.from(output1));
        mockProcess.emit('close', 0);
      }, 20);
      await promise2;

      // Both calculations should succeed
      expect(tracker.getSessionTotal()).toBeCloseTo(2.0, 5);
      expect(onCalculated).toHaveBeenCalledTimes(2);
    });
  });
});
