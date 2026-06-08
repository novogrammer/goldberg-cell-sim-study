import type { Cell } from "./types";

export interface AppState {
  cells: Cell[];
  speed: number;
  isPlaying: boolean;
  autoRotate: boolean;
  isPaintMode: boolean;
  brushTerrainKind: Cell["terrainKind"];
  lastPaintedCellId: number | null;
  lastTick: number;
  selectedCellId: number | null;
}
