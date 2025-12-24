import type { CalculationError } from '../errors/CalculationError';
import type { CalculationRequest } from '../models/CalculationRequest';
import type { ImpactCalculation } from '../models/ImpactMetrics';
import type { Result } from '../types/Result';

/**
 * Strategy interface for environmental impact calculation providers
 * Allows pluggable implementations (EcoLogits, custom calculators, etc.)
 */
export interface ImpactProvider {
  /**
   * Provider name for identification
   */
  readonly name: string;

  /**
   * Provider version
   */
  readonly version: string;

  /**
   * Calculate environmental impact for given token usage
   * Returns Result type for explicit error handling
   */
  calculateImpact(
    request: CalculationRequest
  ): Promise<Result<ImpactCalculation, CalculationError>>;

  /**
   * Check if provider is available and properly configured
   */
  isAvailable(): Promise<boolean>;
}
