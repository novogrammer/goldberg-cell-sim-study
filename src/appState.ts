import type { Cell } from "./types";

export interface AppState {
  cells: Cell[];
  speed: number;
  pausedByUser: boolean;
  pausedByPaint: boolean;
  autoRotate: boolean;
  isPaintMode: boolean;
  brushTerrainKind: Cell["terrainKind"];
  lastPaintedCellId: number | null;
  lastTick: number;
  selectedCellId: number | null;
}
