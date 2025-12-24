/**
 * Environmental impact metrics for a single phase (usage or embodied)
 */
export interface ImpactMetrics {
  gwp: number; // Global Warming Potential in grams CO2eq
  primaryEnergy: number; // Primary Energy in megajoules
  adpe: number; // Abiotic Depletion Potential in kg antimony equivalent
}

/**
 * Metadata about the calculation
 */
export interface CalculationMetadata {
  providerName: string;
  providerVersion?: string;
  modelUsed: string;
  calculationMethod?: string;
}

/**
 * Complete environmental impact calculation result
 * Contains only calculated values, no request echo
 */
export interface ImpactCalculation {
  totalGwp: number;
  totalPrimaryEnergy: number;
  totalAdpe: number;
  energyConsumption: number; // in kWh
  usage: ImpactMetrics;
  embodied: ImpactMetrics;
  metadata: CalculationMetadata;
}
