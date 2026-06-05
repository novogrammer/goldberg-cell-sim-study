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

export type Vec3 = [number, number, number];

export interface CellFaceGeometry {
  cellId: number;
  vertexIndices: number[];
  center: [number, number, number];
  normal: Vec3;
  tangent: Vec3;
  bitangent: Vec3;
  inradius: number;
  circumradius: number;
}

export interface GoldbergPolyhedronGeometry {
  vertices: Vec3[];
  faces: CellFaceGeometry[];
}

export interface CellPlacement {
  cellId: number;
  offsetU: number;
  offsetV: number;
  height: number;
  yaw: number;
}

export interface CellPlacementTransform {
  position: Vec3;
  normal: Vec3;
  tangent: Vec3;
  bitangent: Vec3;
  yaw: number;
}

export interface GoldbergMeshData {
  cells: Cell[];
  geometry: GoldbergPolyhedronGeometry;
  pentagonCount: number;
  hexagonCount: number;
}
