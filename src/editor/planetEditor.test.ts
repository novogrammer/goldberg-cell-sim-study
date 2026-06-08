import { describe, expect, it } from "vitest";

import { applyTerrainToCell, setCellTerrainKind, toggleSelectedCell } from "./planetEditor";
import type { Cell } from "../types";

function createCell(overrides: Partial<Cell>): Cell {
  return {
    id: 0,
    neighbors: [],
    neighborCount: 0,
    isPentagon: false,
    terrainKind: "land",
    baseFertility: 0.5,
    fertility: 0.5,
    geology: 0.5,
    moisture: 0.5,
    nextMoisture: 0.5,
    vegetation: 0.5,
    nextVegetation: 0.5,
    state: 0.5,
    nextState: 0.5,
    ...overrides
  };
}

describe("planetEditor", () => {
  it("water に塗ると moisture を 1 にして vegetation を 0 にする", () => {
    const cells = [
      createCell({ id: 0, terrainKind: "land", moisture: 0.2, vegetation: 0.8 }),
      createCell({ id: 1, terrainKind: "land" })
    ];

    const nextCells = setCellTerrainKind(cells, 0, "water");
    expect(nextCells[0].terrainKind).toBe("water");
    expect(nextCells[0].moisture).toBe(1);
    expect(nextCells[0].vegetation).toBe(0);
  });

  it("land に塗ると moisture と vegetation を 0 にする", () => {
    const cells = [
      createCell({ id: 0, terrainKind: "water", moisture: 1, vegetation: 0.6 }),
      createCell({ id: 1, terrainKind: "land" })
    ];

    const nextCells = setCellTerrainKind(cells, 0, "land");
    expect(nextCells[0].terrainKind).toBe("land");
    expect(nextCells[0].moisture).toBe(0);
    expect(nextCells[0].vegetation).toBe(0);
  });

  it("同じセルを連続で塗ると state を再計算しない", () => {
    const state = {
      cells: [createCell({ id: 0 })],
      selectedCellId: 0,
      lastPaintedCellId: 0
    };

    expect(applyTerrainToCell(state, 0, "water")).toBe(state);
  });

  it("同じセルを選ぶと選択解除する", () => {
    expect(toggleSelectedCell(3, 3)).toBeNull();
    expect(toggleSelectedCell(3, 4)).toBe(4);
  });
});
