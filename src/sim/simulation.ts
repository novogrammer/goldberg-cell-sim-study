import type { Cell, SimulationRuleConfig, SimulationStepContext } from "../types";

export const DEFAULT_RULE_CONFIG: SimulationRuleConfig = {
  waterInfluence: 0.62,
  neighborVegetationInfluence: 0.28,
  resourceInfluence: 0.2,
  geologyInfluence: 0.14,
  baselineDecay: 0.045,
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

export function updateCell(
  cell: Cell,
  cells: Cell[],
  context: SimulationStepContext
): number {
  if (cell.terrainKind === "water") {
    return 0;
  }

  const {
    waterInfluence,
    neighborVegetationInfluence,
    resourceInfluence,
    geologyInfluence,
    baselineDecay,
    growthCap,
    selfLimitingFactor
  } = context.config;
  const adjacentWaterInfluence = getAdjacentWaterInfluence(cell, cells);
  const neighboringVegetation = getNeighborVegetationInfluence(cell, cells);
  const growthPotential = clamp01(
    adjacentWaterInfluence * waterInfluence +
    neighboringVegetation * neighborVegetationInfluence +
    cell.resource * resourceInfluence +
    cell.geology * geologyInfluence
  );
  const selfLimiting = Math.max(0, 1 - cell.vegetation * selfLimitingFactor);
  const growthDelta = growthPotential * growthCap * selfLimiting;
  const dryness = 1 - adjacentWaterInfluence * 0.85;
  const decayDelta =
    baselineDecay *
    dryness *
    (1 - cell.resource * 0.4) *
    (1 - neighboringVegetation * 0.35) *
    Math.max(cell.vegetation, 0.12);
  const activated = cell.vegetation + growthDelta - decayDelta;

  return clamp01(activated);
}

export function stepSimulation(
  cells: Cell[],
  config: SimulationRuleConfig = DEFAULT_RULE_CONFIG
): Cell[] {
  const context: SimulationStepContext = { config };

  const staged = cells.map((cell) => {
    const nextVegetation = updateCell(cell, cells, context);
    return {
      ...cell,
      nextVegetation,
      nextState: nextVegetation
    };
  });

  return staged.map((cell) => ({
    ...cell,
    vegetation: cell.nextVegetation,
    state: cell.nextVegetation
  }));
}
