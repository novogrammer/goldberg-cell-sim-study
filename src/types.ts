export interface Cell {
  id: number;
  neighbors: number[];
  neighborCount: number;
  isPentagon: boolean;
  state: number;
  nextState: number;
}

export interface SimulationRuleConfig {
  coupling: number;
  activationThreshold: number;
  activationBoost: number;
  decay: number;
}

export interface SimulationStepContext {
  config: SimulationRuleConfig;
}

export interface CellRenderData {
  cellId: number;
  points: [number, number, number][];
  center: [number, number, number];
}

export interface GoldbergMeshData {
  cells: Cell[];
  renderCells: CellRenderData[];
  pentagonCount: number;
  hexagonCount: number;
}
