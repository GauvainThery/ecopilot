/**
 * Domain error for calculation failures
 */
export interface CalculationError {
  code: 'PROVIDER_UNAVAILABLE' | 'INVALID_MODEL' | 'CALCULATION_FAILED' | 'UNKNOWN_ERROR';
  message: string;
  details?: unknown;
}
