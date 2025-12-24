import type * as vscode from 'vscode';
import type { DailyStats, ImpactRecord, MonthlyStats } from '../domain/ImpactRecord';
import { logger } from './Logger';

export class ImpactTracker {
  private dailyStats: Map<string, DailyStats> = new Map();
  private monthlyStats: Map<string, MonthlyStats> = new Map();
  private sessionTotalGwp: number = 0;
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.loadFromStorage();
    logger.info('ImpactTracker initialized', {
      dailyStatsCount: this.dailyStats.size,
      monthlyStatsCount: this.monthlyStats.size,
      sessionTotal: this.sessionTotalGwp,
    });
  }

  addImpact(impact: ImpactRecord): void {
    const date = new Date(impact.timestamp);
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const monthStr = dateStr.substring(0, 7); // YYYY-MM

    // Update session total
    this.sessionTotalGwp += impact.gwp;

    // Update daily stats
    let daily = this.dailyStats.get(dateStr);
    if (!daily) {
      daily = {
        date: dateStr,
        totalGwp: 0,
        totalPe: 0,
        totalAdpe: 0,
        totalEnergy: 0,
        totalTokens: 0,
        requestCount: 0,
        impacts: [],
      };
      this.dailyStats.set(dateStr, daily);
    }

    daily.totalGwp += impact.gwp;
    daily.totalPe += impact.primaryEnergy;
    daily.totalAdpe += impact.adpe;
    daily.totalEnergy += impact.energy;
    daily.totalTokens += impact.tokens || 0;
    daily.requestCount += 1;
    daily.impacts.push(impact);

    // Update monthly stats
    let monthly = this.monthlyStats.get(monthStr);
    if (!monthly) {
      monthly = {
        month: monthStr,
        totalGwp: 0,
        totalPe: 0,
        totalAdpe: 0,
        totalEnergy: 0,
        totalTokens: 0,
        requestCount: 0,
        dailyStats: new Map(),
      };
      this.monthlyStats.set(monthStr, monthly);
    }

    monthly.totalGwp += impact.gwp;
    monthly.totalPe += impact.primaryEnergy;
    monthly.totalAdpe += impact.adpe;
    monthly.totalEnergy += impact.energy;
    monthly.totalTokens += impact.tokens || 0;
    monthly.requestCount += 1;
    monthly.dailyStats.set(dateStr, daily);

    // Save to storage
    this.saveToStorage();
    logger.debug(`Impact added - ${impact.gwp.toFixed(4)} gCO2eq on ${dateStr}`);
  }

  getSessionTotal(): number {
    return this.sessionTotalGwp;
  }

  resetSession(): void {
    this.sessionTotalGwp = 0;
    this.saveToStorage();
    logger.info('Session counter reset');
  }

  resetAll(): void {
    this.dailyStats.clear();
    this.monthlyStats.clear();
    this.sessionTotalGwp = 0;
    this.saveToStorage();
    logger.info('All impact data reset');
  }

  getWeeklyStats(endDate?: Date): {
    stats: DailyStats[];
    totalGwp: number;
    totalPe: number;
    totalAdpe: number;
    totalEnergy: number;
    totalTokens: number;
  } {
    const end = endDate || new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 6); // Last 7 days

    const stats: DailyStats[] = [];
    let totalGwp = 0;
    let totalPe = 0;
    let totalAdpe = 0;
    let totalEnergy = 0;
    let totalTokens = 0;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const daily = this.dailyStats.get(dateStr);
      if (daily) {
        stats.push(daily);
        totalGwp += daily.totalGwp;
        totalPe += daily.totalPe;
        totalAdpe += daily.totalAdpe;
        totalEnergy += daily.totalEnergy;
        totalTokens += daily.totalTokens;
      }
    }

    return { stats, totalGwp, totalPe, totalAdpe, totalEnergy, totalTokens };
  }

  private saveToStorage(): void {
    // Convert Maps to objects for storage
    const dailyData: { [key: string]: DailyStats } = {};
    this.dailyStats.forEach((value, key) => {
      dailyData[key] = value;
    });

    const monthlyData: { [key: string]: any } = {};
    this.monthlyStats.forEach((value, key) => {
      monthlyData[key] = {
        ...value,
        dailyStats: undefined, // Don't duplicate daily stats in monthly
      };
    });

    this.context.globalState.update('ecopilot.dailyStats', dailyData);
    this.context.globalState.update('ecopilot.monthlyStats', monthlyData);
    this.context.globalState.update('ecopilot.sessionTotal', this.sessionTotalGwp);
  }

  private loadFromStorage(): void {
    const dailyData = this.context.globalState.get<{ [key: string]: DailyStats }>(
      'ecopilot.dailyStats'
    );
    if (dailyData) {
      Object.entries(dailyData).forEach(([key, value]) => {
        this.dailyStats.set(key, value);
      });
    }

    const monthlyData = this.context.globalState.get<{ [key: string]: any }>(
      'ecopilot.monthlyStats'
    );
    if (monthlyData) {
      Object.entries(monthlyData).forEach(([key, value]) => {
        // Rebuild daily stats reference
        const dailyStatsMap = new Map<string, DailyStats>();
        const yearMonth = key;
        this.dailyStats.forEach((daily, dateStr) => {
          if (dateStr.startsWith(yearMonth)) {
            dailyStatsMap.set(dateStr, daily);
          }
        });

        this.monthlyStats.set(key, {
          ...value,
          dailyStats: dailyStatsMap,
        });
      });
    }

    const sessionTotal = this.context.globalState.get<number>('ecopilot.sessionTotal');
    if (sessionTotal) {
      this.sessionTotalGwp = sessionTotal;
    }

    // Clean up old data (older than 12 months)
    this.cleanupOldData();
  }

  private cleanupOldData(): void {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const cutoffDate = twelveMonthsAgo.toISOString().split('T')[0];

    // Remove old daily stats
    const datesToRemove: string[] = [];
    this.dailyStats.forEach((_, date) => {
      if (date < cutoffDate) {
        datesToRemove.push(date);
      }
    });
    for (const date of datesToRemove) {
      this.dailyStats.delete(date);
    }

    // Remove old monthly stats
    const monthsToRemove: string[] = [];
    this.monthlyStats.forEach((_, month) => {
      if (month < cutoffDate.substring(0, 7)) {
        monthsToRemove.push(month);
      }
    });
    for (const month of monthsToRemove) {
      this.monthlyStats.delete(month);
    }

    if (datesToRemove.length > 0 || monthsToRemove.length > 0) {
      this.saveToStorage();
    }
  }
}
