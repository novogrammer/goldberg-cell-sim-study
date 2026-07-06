import { describe, expect, it } from "vitest";

import { colorForCell } from "./cellVisualAppearance";
import type { Cell } from "../types";

function createCell(overrides: Partial<Cell> = {}): Cell {
  return {
    id: 0,
    neighbors: [1, 2, 3, 4, 5, 6],
    neighborCount: 6,
    isPentagon: false,
    terrainKind: "land",
    baseFertility: 0.5,
    fertility: 0.5,
    geology: 0.5,
    moisture: 0,
    nextMoisture: 0,
    vegetation: 0.5,
    nextVegetation: 0.5,
    ...overrides
  };
}

describe("cellVisualAppearance", () => {
  it("moisture が高い land ほど colorForCell に青みを足す", () => {
    const dryColor = colorForCell(createCell({ moisture: 0.05, vegetation: 0.35 }));
    const wetColor = colorForCell(createCell({ moisture: 0.95, vegetation: 0.35 }));

    expect(wetColor.b).toBeGreaterThan(dryColor.b);
  });

  it("water セルの色は固定する", () => {
    const waterColor = colorForCell(createCell({ terrainKind: "water", moisture: 1 }));

    expect(waterColor.getHexString()).toBe("1d5ca8");
  });
});
