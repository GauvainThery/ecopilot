/**
 * Unit tests for ImpactTracker
 * Tests aggregation, persistence, and session management
 */

import type { ImpactRecord } from '../../domain/ImpactRecord';
import { ImpactTracker } from '../../infrastructure/ImpactTracker';
import { createMockContext } from '../mocks/vscode';

describe('ImpactTracker', () => {
  let tracker: ImpactTracker;
  let mockContext: any;
  let storageData: Map<string, any>;

  beforeEach(() => {
    // Mock storage
    storageData = new Map();
    mockContext = createMockContext();
    mockContext.globalState.get = jest.fn((key: string) => storageData.get(key));
    mockContext.globalState.update = jest.fn((key: string, value: any) => {
      storageData.set(key, value);
      return Promise.resolve();
    });

    tracker = new ImpactTracker(mockContext);
  });

  describe('addImpact', () => {
    it('should add impact and update session total', () => {
      const impact: ImpactRecord = {
        gwp: 1.5,
        primaryEnergy: 10.0,
        adpe: 0.001,
        energy: 0.005,
        timestamp: Date.now(),
        model: 'gpt-4',
        tokens: 100,
        latency: 2.0,
        source: 'chat',
        isRealTokenCount: true,
      };

      tracker.addImpact(impact);

      expect(tracker.getSessionTotal()).toBe(1.5);
    });

    it('should aggregate multiple impacts to session total', () => {
      const impact1: ImpactRecord = {
        gwp: 1.5,
        primaryEnergy: 10.0,
        adpe: 0.001,
        energy: 0.005,
        timestamp: Date.now(),
      };

      const impact2: ImpactRecord = {
        gwp: 2.3,
        primaryEnergy: 15.0,
        adpe: 0.002,
        energy: 0.008,
        timestamp: Date.now(),
      };

      tracker.addImpact(impact1);
      tracker.addImpact(impact2);

      expect(tracker.getSessionTotal()).toBeCloseTo(3.8, 5);
    });

    it('should save to storage after adding impact', () => {
      const impact: ImpactRecord = {
        gwp: 1.5,
        primaryEnergy: 10.0,
        adpe: 0.001,
        energy: 0.005,
        timestamp: Date.now(),
      };

      tracker.addImpact(impact);

      expect(mockContext.globalState.update).toHaveBeenCalledWith('ecopilot.sessionTotal', 1.5);
      expect(mockContext.globalState.update).toHaveBeenCalledWith(
        'ecopilot.dailyStats',
        expect.any(Object)
      );
    });

    it('should create daily stats for new date', () => {
      const timestamp = new Date('2025-12-06T10:00:00Z').getTime();
      const impact: ImpactRecord = {
        gwp: 1.5,
        primaryEnergy: 10.0,
        adpe: 0.001,
        energy: 0.005,
        timestamp,
      };

      tracker.addImpact(impact);

      const weeklyStats = tracker.getWeeklyStats(new Date('2025-12-06'));
      expect(weeklyStats.stats.length).toBeGreaterThan(0);
      expect(weeklyStats.totalGwp).toBeCloseTo(1.5, 5);
    });

    it('should aggregate impacts on the same day', () => {
      const date = new Date('2025-12-06T10:00:00Z');
      const impact1: ImpactRecord = {
        gwp: 1.5,
        primaryEnergy: 10.0,
        adpe: 0.001,
        energy: 0.005,
        timestamp: date.getTime(),
        tokens: 100,
      };

      const impact2: ImpactRecord = {
        gwp: 2.5,
        primaryEnergy: 15.0,
        adpe: 0.002,
        energy: 0.008,
        timestamp: date.getTime(),
        tokens: 150,
      };

      tracker.addImpact(impact1);
      tracker.addImpact(impact2);

      const weeklyStats = tracker.getWeeklyStats(new Date('2025-12-06'));
      const todayStats = weeklyStats.stats.find((s) => s.date === '2025-12-06');

      expect(todayStats).toBeDefined();
      expect(todayStats?.totalGwp).toBeCloseTo(4.0, 5);
      expect(todayStats?.totalTokens).toBe(250);
      expect(todayStats?.requestCount).toBe(2);
      expect(todayStats?.impacts.length).toBe(2);
    });
  });

  describe('getWeeklyStats', () => {
    beforeEach(() => {
      // Add impacts for different days
      const dates = [
        '2025-12-01T10:00:00Z',
        '2025-12-02T10:00:00Z',
        '2025-12-03T10:00:00Z',
        '2025-12-06T10:00:00Z',
      ];

      dates.forEach((dateStr, index) => {
        const impact: ImpactRecord = {
          gwp: (index + 1) * 1.0,
          primaryEnergy: (index + 1) * 10.0,
          adpe: (index + 1) * 0.001,
          energy: (index + 1) * 0.005,
          timestamp: new Date(dateStr).getTime(),
        };
        tracker.addImpact(impact);
      });
    });

    it('should return stats for last 7 days', () => {
      const endDate = new Date('2025-12-06');
      const stats = tracker.getWeeklyStats(endDate);

      // Should include 12-01, 12-02, 12-03, 12-06 (4 days with data)
      expect(stats.stats.length).toBe(4);
    });

    it('should calculate correct totals', () => {
      const endDate = new Date('2025-12-06');
      const stats = tracker.getWeeklyStats(endDate);

      // 1 + 2 + 3 + 4 = 10
      expect(stats.totalGwp).toBeCloseTo(10.0, 5);
      expect(stats.totalPe).toBeCloseTo(100.0, 5);
    });

    it('should handle empty date range', () => {
      // Create a fresh tracker with no pre-existing data
      const freshStorageData = new Map();
      const freshContext = createMockContext();
      freshContext.globalState.get = jest.fn((key: string) => freshStorageData.get(key));
      freshContext.globalState.update = jest.fn((key: string, value: any) => {
        freshStorageData.set(key, value);
        return Promise.resolve();
      });

      const emptyTracker = new ImpactTracker(freshContext as any);
      const stats = emptyTracker.getWeeklyStats();

      expect(stats.stats.length).toBe(0);
      expect(stats.totalGwp).toBe(0);
    });

    it('should use current date when no endDate provided', () => {
      const stats = tracker.getWeeklyStats();

      expect(stats).toBeDefined();
      expect(stats.stats).toBeInstanceOf(Array);
    });
  });

  describe('resetSession', () => {
    it('should reset session total to zero', () => {
      const impact: ImpactRecord = {
        gwp: 5.0,
        primaryEnergy: 10.0,
        adpe: 0.001,
        energy: 0.005,
        timestamp: Date.now(),
      };

      tracker.addImpact(impact);
      expect(tracker.getSessionTotal()).toBe(5.0);

      tracker.resetSession();
      expect(tracker.getSessionTotal()).toBe(0);
    });

    it('should save reset value to storage', () => {
      tracker.resetSession();

      expect(mockContext.globalState.update).toHaveBeenCalledWith('ecopilot.sessionTotal', 0);
    });

    it('should not affect daily/monthly stats', () => {
      const impact: ImpactRecord = {
        gwp: 5.0,
        primaryEnergy: 10.0,
        adpe: 0.001,
        energy: 0.005,
        timestamp: Date.now(),
      };

      tracker.addImpact(impact);
      const weeklyBefore = tracker.getWeeklyStats();

      tracker.resetSession();
      const weeklyAfter = tracker.getWeeklyStats();

      expect(weeklyBefore.totalGwp).toBe(weeklyAfter.totalGwp);
    });
  });

  describe('resetAll', () => {
    it('should clear all stats and session total', () => {
      const impact: ImpactRecord = {
        gwp: 5.0,
        primaryEnergy: 10.0,
        adpe: 0.001,
        energy: 0.005,
        timestamp: Date.now(),
      };

      tracker.addImpact(impact);
      tracker.resetAll();

      expect(tracker.getSessionTotal()).toBe(0);
      const weekly = tracker.getWeeklyStats();
      expect(weekly.stats.length).toBe(0);
      expect(weekly.totalGwp).toBe(0);
    });
  });

  describe('persistence', () => {
    it('should load data from storage on initialization', () => {
      const dailyData = {
        '2025-12-06': {
          date: '2025-12-06',
          totalGwp: 5.0,
          totalPe: 50.0,
          totalAdpe: 0.005,
          totalEnergy: 0.025,
          totalTokens: 500,
          requestCount: 5,
          impacts: [],
        },
      };

      storageData.set('ecopilot.dailyStats', dailyData);
      storageData.set('ecopilot.sessionTotal', 3.5);

      const newTracker = new ImpactTracker(mockContext);

      expect(newTracker.getSessionTotal()).toBe(3.5);
      const stats = newTracker.getWeeklyStats(new Date('2025-12-06'));
      expect(stats.totalGwp).toBeCloseTo(5.0, 5);
    });

    it('should handle missing storage data gracefully', () => {
      const newTracker = new ImpactTracker(mockContext);

      expect(newTracker.getSessionTotal()).toBe(0);
      const stats = newTracker.getWeeklyStats();
      expect(stats.stats.length).toBe(0);
    });
  });

  describe('monthly aggregation', () => {
    it('should aggregate impacts into monthly stats', () => {
      const impacts = [
        {
          gwp: 1.0,
          primaryEnergy: 10.0,
          adpe: 0.001,
          energy: 0.005,
          timestamp: new Date('2025-12-01T10:00:00Z').getTime(),
          tokens: 100,
        },
        {
          gwp: 2.0,
          primaryEnergy: 20.0,
          adpe: 0.002,
          energy: 0.01,
          timestamp: new Date('2025-12-15T10:00:00Z').getTime(),
          tokens: 200,
        },
      ];

      for (const impact of impacts) {
        tracker.addImpact(impact);
      }

      // Verify data is saved
      expect(mockContext.globalState.update).toHaveBeenCalledWith(
        'ecopilot.monthlyStats',
        expect.objectContaining({
          '2025-12': expect.objectContaining({
            totalGwp: 3.0,
            totalTokens: 300,
            requestCount: 2,
          }),
        })
      );
    });
  });
});
