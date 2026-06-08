import type { Cell, SimulationRuleConfig, SimulationStepContext } from "../types";

export const DEFAULT_RULE_CONFIG: SimulationRuleConfig = {
  waterSourceStrength: 0.85,
  moistureSpread: 0.28,
  moistureDecay: 0.1,
  moistureRetentionFromGeology: 0.12,
  vegetationMoistureConsumption: 0.09,
  vegetationGrowthFromMoisture: 0.26,
  idealMoistureForGrowth: 0.45,
  moistureGrowthTolerance: 0.32,
  fertilityThresholdRelief: 0.14,
  neighborVegetationInfluence: 0.5,
  fertilityInfluence: 0.2,
  geologyMoistureSupport: 0.16,
  soilGrowthSupport: 0.18,
  fertilityRecoveryFromVegetation: 0.009,
  fertilityErosionFromDryness: 0.008,
  fertilityLeachingFromWetness: 0.03,
  fertilityWaterloggingFromAdjacency: 0.012,
  fertilityBaseRecovery: 0.0015,
  baselineVegetationDecay: 0.05,
  dryVegetationDecay: 0.08,
  growthCap: 0.22,
  selfLimitingFactor: 0.9
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export function getNeighborAverage(cell: Cell, cells: Cell[]): number {
  if (cell.neighborCount === 0) {
    return 0;
  }

  const sum = cell.neighbors.reduce((total, neighborId) => total + cells[neighborId].vegetation, 0);
  return sum / cell.neighborCount;
}

export function getNeighborMoistureAverage(cell: Cell, cells: Cell[]): number {
  if (cell.neighborCount === 0) {
    return 0;
  }

  const sum = cell.neighbors.reduce((total, neighborId) => total + cells[neighborId].moisture, 0);
  return sum / cell.neighborCount;
}

export function getAdjacentWaterInfluence(cell: Cell, cells: Cell[]): number {
  if (cell.neighborCount === 0) {
    return 0;
  }

  const waterNeighbors = cell.neighbors.reduce((total, neighborId) => (
    cells[neighborId].terrainKind === "water" ? total + 1 : total
  ), 0);

  return waterNeighbors / cell.neighborCount;
}

export function getNeighborVegetationInfluence(cell: Cell, cells: Cell[]): number {
  if (cell.neighborCount === 0) {
    return 0;
  }

  const sum = cell.neighbors.reduce((total, neighborId) => total + cells[neighborId].vegetation, 0);
  return sum / cell.neighborCount;
}

export function updateMoisture(
  cell: Cell,
  cells: Cell[],
  context: SimulationStepContext
): number {
  if (cell.terrainKind === "water") {
    return 1;
  }

  const {
    waterSourceStrength,
    moistureSpread,
    moistureDecay,
    moistureRetentionFromGeology,
    vegetationMoistureConsumption
  } = context.config;
  const adjacentWaterInfluence = getAdjacentWaterInfluence(cell, cells);
  const neighborMoisture = getNeighborMoistureAverage(cell, cells);
  const sourceGain = adjacentWaterInfluence * waterSourceStrength * (1 - cell.moisture);
  const diffusion = (neighborMoisture - cell.moisture) * moistureSpread;
  const evaporation =
    cell.moisture *
    moistureDecay *
    Math.max(0.12, 1 - cell.geology * moistureRetentionFromGeology);
  const vegetationConsumption = cell.vegetation * vegetationMoistureConsumption * cell.moisture;

  return clamp01(cell.moisture + sourceGain + diffusion - evaporation - vegetationConsumption);
}

export function updateVegetation(
  cell: Cell,
  nextMoistureCells: Cell[],
  context: SimulationStepContext
): number {
  if (cell.terrainKind === "water") {
    return 0;
  }

  const {
    vegetationGrowthFromMoisture,
    idealMoistureForGrowth,
    moistureGrowthTolerance,
    fertilityThresholdRelief,
    neighborVegetationInfluence,
    fertilityInfluence,
    geologyMoistureSupport,
    soilGrowthSupport,
    baselineVegetationDecay,
    dryVegetationDecay,
    growthCap,
    selfLimitingFactor
  } = context.config;
  const moisture = nextMoistureCells[cell.id].nextMoisture;
  const neighboringVegetation = getNeighborVegetationInfluence(cell, nextMoistureCells);
  const effectiveIdealMoisture = clamp01(
    idealMoistureForGrowth - cell.fertility * fertilityThresholdRelief
  );
  const effectiveTolerance = Math.max(0.001, moistureGrowthTolerance);
  const normalizedDistance = (moisture - effectiveIdealMoisture) / effectiveTolerance;
  const moistureSuitability = clamp01(1 - normalizedDistance * normalizedDistance);
  const soilMoistureAccess = clamp01(moisture + cell.geology * 0.2);
  const soilSupport =
    (cell.fertility * fertilityInfluence + cell.geology * geologyMoistureSupport) *
    soilGrowthSupport *
    soilMoistureAccess;
  const moistureDrivenGrowth =
    moistureSuitability *
    (vegetationGrowthFromMoisture + neighboringVegetation * neighborVegetationInfluence);
  const growthPotential = clamp01(
    moistureDrivenGrowth +
    soilSupport
  );
  const selfLimiting = Math.max(0, 1 - cell.vegetation * selfLimitingFactor);
  const growthDelta = growthPotential * growthCap * selfLimiting;
  const dryness = 1 - moisture;
  const decayDelta =
    baselineVegetationDecay *
    dryness *
    (1 - cell.fertility * 0.4) *
    (1 - neighboringVegetation * 0.35) *
    cell.vegetation;
  const activated =
    cell.vegetation +
    growthDelta -
    decayDelta -
    dryness * dryVegetationDecay * cell.vegetation;

  return clamp01(activated);
}

export function updateFertility(
  cell: Cell,
  nextCells: Cell[],
  context: SimulationStepContext
): number {
  if (cell.terrainKind === "water") {
    return cell.fertility;
  }

  const {
    fertilityRecoveryFromVegetation,
    fertilityErosionFromDryness,
    fertilityLeachingFromWetness,
    fertilityWaterloggingFromAdjacency,
    fertilityBaseRecovery
  } = context.config;
  const moisture = nextCells[cell.id].nextMoisture;
  const vegetation = nextCells[cell.id].nextVegetation;
  const adjacentWaterInfluence = getAdjacentWaterInfluence(cell, nextCells);
  const recovery = vegetation * (1 - cell.fertility) * fertilityRecoveryFromVegetation;
  const erosion = (1 - vegetation) * (1 - moisture) * fertilityErosionFromDryness;
  const leaching = Math.max(0, moisture - 0.8) * fertilityLeachingFromWetness;
  const waterlogging = adjacentWaterInfluence * moisture * fertilityWaterloggingFromAdjacency;
  const baseRecovery = (cell.baseFertility - cell.fertility) * fertilityBaseRecovery;

  return clamp01(cell.fertility + recovery - erosion - leaching - waterlogging + baseRecovery);
}

export function stepSimulation(
  cells: Cell[],
  config: SimulationRuleConfig = DEFAULT_RULE_CONFIG
): Cell[] {
  const context: SimulationStepContext = { config };

  const moistureStaged = cells.map((cell) => {
    const nextMoisture = updateMoisture(cell, cells, context);
    return {
      ...cell,
      nextMoisture
    };
  });

  const vegetationStaged = moistureStaged.map((cell) => {
    const nextVegetation = updateVegetation(cell, moistureStaged, context);
    return {
      ...cell,
      nextVegetation,
      nextState: nextVegetation
    };
  });

  return vegetationStaged.map((cell) => ({
    ...cell,
    fertility: updateFertility(cell, vegetationStaged, context),
    moisture: cell.nextMoisture,
    vegetation: cell.nextVegetation,
    state: cell.nextVegetation
  }));
}
