import type { Cell } from "../types";

interface PlanetEditorState {
  cells: Cell[];
  selectedCellId: number | null;
  lastPaintedCellId: number | null;
}

export function setCellTerrainKind(
  cells: Cell[],
  cellId: number,
  terrainKind: Cell["terrainKind"]
): Cell[] {
  const moisture = terrainKind === "water" ? 1 : 0;
  const vegetation = 0;

  return cells.map((cell) => (
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
