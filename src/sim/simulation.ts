import type { Cell, SimulationRuleConfig, SimulationStepContext } from "../types";

export const DEFAULT_RULE_CONFIG: SimulationRuleConfig = {
  coupling: 0.38,
  activationThreshold: 0.58,
  activationBoost: 0.09,
  decay: 0.03
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export function getNeighborAverage(cell: Cell, cells: Cell[]): number {
  if (cell.neighborCount === 0) {
    return 0;
  }

  const sum = cell.neighbors.reduce((total, neighborId) => total + cells[neighborId].state, 0);
  return sum / cell.neighborCount;
}

export function updateCell(
  cell: Cell,
  neighborAverage: number,
  context: SimulationStepContext
): number {
  const { coupling, activationBoost, activationThreshold, decay } = context.config;
  const blended = cell.state + (neighborAverage - cell.state) * coupling;
  const activated =
    neighborAverage >= activationThreshold ? blended + activationBoost : blended - decay;

  return clamp01(activated);
}

export function stepSimulation(
  cells: Cell[],
  config: SimulationRuleConfig = DEFAULT_RULE_CONFIG
): Cell[] {
  const context: SimulationStepContext = { config };

  const staged = cells.map((cell) => {
    const neighborAverage = getNeighborAverage(cell, cells);
    const nextState = updateCell(cell, neighborAverage, context);
    return {
      ...cell,
      nextState
    };
  });

  return staged.map((cell) => ({
    ...cell,
    state: cell.nextState
  }));
}
