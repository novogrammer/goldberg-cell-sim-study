import { getAdjacentWaterInfluence } from "../sim/simulation";
import type { Cell } from "../types";
import type { SelectedCellSummary } from "./types";

export function buildSelectedCellSummary(
  cells: Cell[],
  selectedCellId: number | null
): SelectedCellSummary | null {
  if (selectedCellId === null) {
    return null;
  }

  const selectedCell = cells[selectedCellId];
  if (!selectedCell) {
    return null;
  }

  const waterAdjacency = getAdjacentWaterInfluence(selectedCell, cells);
  return {
    cellId: selectedCellId,
    terrainKind: selectedCell.terrainKind,
    moisture: selectedCell.moisture.toFixed(2),
    vegetation: selectedCell.vegetation.toFixed(2),
    waterAdjacency: waterAdjacency.toFixed(2),
    fertility: selectedCell.fertility.toFixed(2),
    geology: selectedCell.geology.toFixed(2)
  };
}
