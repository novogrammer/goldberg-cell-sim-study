import { describe, expect, it } from "vitest";

import { getVegetationIndicatorState } from "./cellVegetationAppearance";
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
    moisture: 0.5,
    nextMoisture: 0.5,
    vegetation: 0,
    nextVegetation: 0,
    state: 0,
    nextState: 0,
    ...overrides
  };
}

describe("cellVegetationAppearance", () => {
  it("water セルには植生オブジェクトを出さない", () => {
    const state = getVegetationIndicatorState(
      createCell({ terrainKind: "water", vegetation: 1 })
    );

    expect(state.visibleSproutCount).toBe(0);
  });

  it("vegetation が高いほど本数とスケールを増やす", () => {
    const sparse = getVegetationIndicatorState(createCell({ vegetation: 0.15 }));
    const dense = getVegetationIndicatorState(createCell({ vegetation: 0.9 }));

    expect(dense.visibleSproutCount).toBeGreaterThan(sparse.visibleSproutCount);
    expect(dense.heightScale).toBeGreaterThan(sparse.heightScale);
    expect(dense.radiusScale).toBeGreaterThan(sparse.radiusScale);
  });
});
