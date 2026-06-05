import type { Cell, SimulationRuleConfig, SimulationStepContext } from "../types";

export const DEFAULT_RULE_CONFIG: SimulationRuleConfig = {
  waterSourceStrength: 0.85,
  moistureSpread: 0.2,
  moistureDecay: 0.1,
  moistureRetentionFromGeology: 0.12,
  vegetationGrowthFromMoisture: 0.42,
  neighborVegetationInfluence: 0.28,
  fertilityInfluence: 0.2,
  geologyMoistureSupport: 0.12,
  baselineVegetationDecay: 0.06,
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
    moistureRetentionFromGeology
  } = context.config;
  const adjacentWaterInfluence = getAdjacentWaterInfluence(cell, cells);
  const neighborMoisture = getNeighborMoistureAverage(cell, cells);
  const sourceGain = adjacentWaterInfluence * waterSourceStrength * (1 - cell.moisture);
  const diffusion = (neighborMoisture - cell.moisture) * moistureSpread;
  const evaporation =
    cell.moisture *
    moistureDecay *
    Math.max(0.12, 1 - cell.geology * moistureRetentionFromGeology);

  return clamp01(cell.moisture + sourceGain + diffusion - evaporation);
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
    neighborVegetationInfluence,
    fertilityInfluence,
    geologyMoistureSupport,
    baselineVegetationDecay,
    growthCap,
    selfLimitingFactor
  } = context.config;
  const moisture = nextMoistureCells[cell.id].nextMoisture;
  const neighboringVegetation = getNeighborVegetationInfluence(cell, nextMoistureCells);
  const growthPotential = clamp01(
    moisture * vegetationGrowthFromMoisture +
    neighboringVegetation * neighborVegetationInfluence +
    cell.fertility * fertilityInfluence +
    cell.geology * geologyMoistureSupport
  );
  const selfLimiting = Math.max(0, 1 - cell.vegetation * selfLimitingFactor);
  const growthDelta = growthPotential * growthCap * selfLimiting;
  const dryness = 1 - moisture;
  const decayDelta =
    baselineVegetationDecay *
    dryness *
    (1 - cell.fertility * 0.4) *
    (1 - neighboringVegetation * 0.35) *
    Math.max(cell.vegetation, 0.12);
  const activated = cell.vegetation + growthDelta - decayDelta - dryness * 0.08 * cell.vegetation;

  return clamp01(activated);
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
    moisture: cell.nextMoisture,
    vegetation: cell.nextVegetation,
    state: cell.nextVegetation
  }));
}
