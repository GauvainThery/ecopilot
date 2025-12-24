/**
 * Request for environmental impact calculation
 * Pure domain model - no application concerns
 */
export interface CalculationRequest {
  inputTokens: number;
  outputTokens: number;
  latencySeconds: number;
  modelName: string;
  electricityMixZone: string;
}
