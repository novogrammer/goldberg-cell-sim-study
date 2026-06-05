import { describe, expect, it } from "vitest";

import {
  getAdjacentWaterInfluence,
  getNeighborVegetationInfluence,
  stepSimulation,
  updateCell
} from "./simulation";
import type { Cell } from "../types";

function createCell(
  id: number,
  neighbors: number[],
  vegetation: number,
  isPentagon = false,
  terrainKind: "water" | "land" = "land",
  resource = 0.5,
  geology = 0.5
): Cell {
  return {
    id,
    neighbors,
    neighborCount: neighbors.length,
    isPentagon,
    terrainKind,
    resource,
    geology,
    vegetation,
    nextVegetation: vegetation,
    state: vegetation,
    nextState: vegetation
  };
}

describe("simulation", () => {
  it("computes adjacent water influence from local neighbors", () => {
    const cells = [
      createCell(0, [1, 2, 3, 4, 5], 0.3, true),
      createCell(1, [0], 0, false, "water"),
      createCell(2, [0], 0.8),
      createCell(3, [0], 0.4),
      createCell(4, [0], 0, false, "water"),
      createCell(5, [0], 0.2)
    ];

    expect(getAdjacentWaterInfluence(cells[0], cells)).toBeCloseTo(2 / 5);
  });

  it("grows vegetation faster next to water than in dry cells", () => {
    const cells = [
      createCell(0, [1, 2], 0.12, false, "land", 0.55, 0.55),
      createCell(1, [0], 0, false, "water"),
      createCell(2, [0], 0.35, false, "land", 0.55, 0.55),
      createCell(3, [4, 5], 0.12, false, "land", 0.55, 0.55),
      createCell(4, [3], 0.1, false, "land", 0.55, 0.55),
      createCell(5, [3], 0.08, false, "land", 0.55, 0.55)
    ];

    const wetNext = updateCell(cells[0], cells, {
      config: {
        waterInfluence: 0.62,
        neighborVegetationInfluence: 0.28,
        resourceInfluence: 0.2,
        geologyInfluence: 0.14,
        baselineDecay: 0.045,
        growthCap: 0.22,
        selfLimitingFactor: 0.9
      }
    });
    const dryNext = updateCell(cells[3], cells, {
      config: {
        waterInfluence: 0.62,
        neighborVegetationInfluence: 0.28,
        resourceInfluence: 0.2,
        geologyInfluence: 0.14,
        baselineDecay: 0.045,
        growthCap: 0.22,
        selfLimitingFactor: 0.9
      }
    });

    expect(wetNext).toBeGreaterThan(dryNext);
  });

  it("keeps water cells fixed at zero vegetation", () => {
    const next = updateCell(
      createCell(0, [1, 2, 3, 4, 5], 0, true, "water"),
      [
        createCell(0, [1, 2, 3, 4, 5], 0, true, "water"),
        createCell(1, [0], 1),
        createCell(2, [0], 0.8),
        createCell(3, [0], 0.4),
        createCell(4, [0], 0.2),
        createCell(5, [0], 0.3)
      ],
      {
        config: {
          waterInfluence: 0.62,
          neighborVegetationInfluence: 0.28,
          resourceInfluence: 0.2,
          geologyInfluence: 0.14,
          baselineDecay: 0.045,
          growthCap: 0.22,
          selfLimitingFactor: 0.9
        }
      }
    );

    expect(next).toBe(0);
  });

  it("commits nextVegetation into vegetation and state on each step", () => {
    const cells = [
      createCell(0, [1], 0.2, false, "land", 0.6, 0.6),
      createCell(1, [0], 0, false, "water")
    ];

    const next = stepSimulation(cells, {
      waterInfluence: 0.62,
      neighborVegetationInfluence: 0.28,
      resourceInfluence: 0.2,
      geologyInfluence: 0.14,
      baselineDecay: 0.045,
      growthCap: 0.22,
      selfLimitingFactor: 0.9
    });

    expect(next[0].vegetation).toBeCloseTo(next[0].state);
    expect(next[1].vegetation).toBe(0);
    expect(next[0].nextVegetation).toBeCloseTo(next[0].vegetation);
  });

  it("uses neighboring vegetation as a local influence signal", () => {
    const cells = [
      createCell(0, [1, 2, 3], 0.1),
      createCell(1, [0], 0.9),
      createCell(2, [0], 0.6),
      createCell(3, [0], 0)
    ];

    expect(getNeighborVegetationInfluence(cells[0], cells)).toBeCloseTo((0.9 + 0.6 + 0) / 3);
  });
});
