import { DEFAULT_RULE_CONFIG, getAdjacentWaterInfluence } from "../sim/simulation";
import type { Cell } from "../types";

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export interface PlanetEditorState {
  cells: Cell[];
  selectedCellId: number | null;
  lastPaintedCellId: number | null;
}

export function setCellTerrainKind(
  cells: Cell[],
  cellId: number,
  terrainKind: Cell["terrainKind"]
): Cell[] {
  const nextCells = cells.map((cell) =>
    cell.id === cellId
      ? { ...cell, terrainKind }
      : cell
  );
  const nextCell = nextCells[cellId];
  const waterAdjacency = getAdjacentWaterInfluence(nextCell, nextCells);
  const moisture = terrainKind === "water"
    ? 1
    : clamp01(0.08 + waterAdjacency * 0.9 + nextCell.geology * 0.08);
  const vegetation = terrainKind === "water"
    ? 0
    : clamp01(
      Math.max(0, moisture - DEFAULT_RULE_CONFIG.minimumMoistureForGrowth) * 0.58 +
      nextCell.fertility * 0.08 +
      nextCell.geology * 0.04
    );

  return nextCells.map((cell) => (
    cell.id === cellId
      ? {
        ...cell,
        terrainKind,
        moisture,
        nextMoisture: moisture,
        vegetation,
        nextVegetation: vegetation,
        state: vegetation,
        nextState: vegetation
      }
      : cell
  ));
}

export function applyTerrainToCell(
  state: PlanetEditorState,
  cellId: number,
  terrainKind: Cell["terrainKind"]
): PlanetEditorState {
  if (state.lastPaintedCellId === cellId) {
    return state;
  }

  return {
    cells: setCellTerrainKind(state.cells, cellId, terrainKind),
    selectedCellId: cellId,
    lastPaintedCellId: cellId
  };
}

export function paintAtPickedPoint(
  state: PlanetEditorState,
  terrainKind: Cell["terrainKind"],
  pickedCellId: number | null
): PlanetEditorState {
  if (pickedCellId === null) {
    return state;
  }

  return applyTerrainToCell(state, pickedCellId, terrainKind);
}

export function toggleSelectedCell(
  selectedCellId: number | null,
  pickedCellId: number | null
): number | null {
  return selectedCellId === pickedCellId ? null : pickedCellId;
}
