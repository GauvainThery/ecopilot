/**
 * Domain Models - Pure calculation and request/response types
 */

/**
 * Domain Errors - Business logic errors
 */
export { CalculationError } from './errors/CalculationError';
export { DailyStats, ImpactRecord, MonthlyStats, PeriodStats } from './ImpactRecord';
export { CalculationRequest } from './models/CalculationRequest';
export { CalculationMetadata, ImpactCalculation, ImpactMetrics } from './models/ImpactMetrics';
/**
 * Domain Providers - Strategy interfaces
 */
export { ImpactProvider } from './providers/ImpactProvider';
/**
 * Domain Types - Generic utility types
 */
export { Result } from './types/Result';
