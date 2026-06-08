import { getAdjacentWaterInfluence } from "../sim/simulation";
import type { Cell } from "../types";
import type { SelectedCellSummary } from "./types";

function formatFertility(cell: Cell): string {
  const base = cell.baseFertility.toFixed(2);
  const delta = cell.fertility - cell.baseFertility;

  if (Math.abs(delta) < 0.005) {
    return base;
  }

  return `${base} ${delta >= 0 ? "+" : "-"}${Math.abs(delta).toFixed(2)}`;
}

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
    fertility: formatFertility(selectedCell),
    geology: selectedCell.geology.toFixed(2)
  };
}
