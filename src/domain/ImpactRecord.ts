/**
 * Domain model for tracked environmental impact data
 * Extends the calculation result with tracking metadata
 */

/**
 * A recorded instance of environmental impact with tracking metadata
 * This is what gets stored and aggregated over time
 */
export interface ImpactRecord {
  // Core impact metrics
  gwp: number; // Global Warming Potential in grams CO2eq
  primaryEnergy: number; // Primary Energy in MJ
  adpe: number; // Abiotic Depletion Potential in kgSbeq
  energy: number; // Energy consumption in kWh

  // Breakdown by phase
  usage?: {
    gwp: number;
    primaryEnergy: number;
    adpe: number;
  };
  embodied?: {
    gwp: number;
    primaryEnergy: number;
    adpe: number;
  };

  // Request context
  model?: string;
  tokens?: number; // Total tokens (input + output)
  inputTokens?: number; // Tokens used for input/prompt
  outputTokens?: number; // Tokens generated as output
  latency?: number;

  // Tracking metadata
  timestamp: number;
  source?: 'chat' | 'completion'; // Track if from Chat or inline completion
  isRealTokenCount?: boolean; // Track if using real vs estimated tokens
}

/**
 * Aggregated statistics for a specific time period
 */
export interface PeriodStats {
  totalGwp: number;
  totalPe: number;
  totalAdpe: number;
  totalEnergy: number;
  totalTokens: number;
  requestCount: number;
}

/**
 * Daily aggregated impact statistics
 */
export interface DailyStats extends PeriodStats {
  date: string; // YYYY-MM-DD
  impacts: ImpactRecord[];
}

/**
 * Monthly aggregated impact statistics
 */
export interface MonthlyStats extends PeriodStats {
  month: string; // YYYY-MM
  dailyStats: Map<string, DailyStats>;
}
