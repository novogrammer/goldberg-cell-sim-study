import { describe, expect, it } from "vitest";

import { buildSelectedCellSummary } from "./buildSelectedCellSummary";
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

describe("buildSelectedCellSummary", () => {
  it("選択セルの表示用サマリーを整形する", () => {
    const cells = [
      createCell({
        id: 0,
        neighbors: [1],
        neighborCount: 1,
        terrainKind: "land",
        baseFertility: 0.5,
        moisture: 0.345,
        vegetation: 0.678,
        fertility: 0.912,
        geology: 0.234
      }),
      createCell({
        id: 1,
        neighbors: [0],
        neighborCount: 1,
        terrainKind: "water",
        moisture: 1,
        vegetation: 0
      })
    ];

    expect(buildSelectedCellSummary(cells, 0)).toEqual({
      cellId: 0,
      terrainKind: "land",
      moisture: "0.34",
      vegetation: "0.68",
      waterAdjacency: "1.00",
      fertility: "0.50 +0.41",
      geology: "0.23"
    });
  });

  it("fertility の差分がほぼないときは base 値だけを表示する", () => {
    const cells = [
      createCell({
        id: 0,
        neighbors: [1],
        neighborCount: 1,
        baseFertility: 0.5,
        fertility: 0.503
      }),
      createCell({
        id: 1,
        neighbors: [0],
        neighborCount: 1,
        terrainKind: "water",
        moisture: 1,
        vegetation: 0
      })
    ];

    expect(buildSelectedCellSummary(cells, 0)?.fertility).toBe("0.50");
  });
});
