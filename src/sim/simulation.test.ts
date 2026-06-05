import { describe, expect, it } from "vitest";

import { getNeighborAverage, stepSimulation, updateCell } from "./simulation";
import type { Cell } from "../types";

function createCell(
  id: number,
  neighbors: number[],
  state: number,
  isPentagon = false
): Cell {
  return {
    id,
    neighbors,
    neighborCount: neighbors.length,
    isPentagon,
    state,
    nextState: state
  };
}

describe("simulation", () => {
  it("computes neighbor average from neighborCount rather than raw sum", () => {
    const cells = [
      createCell(0, [1, 2, 3, 4, 5], 0.3, true),
      createCell(1, [0], 1),
      createCell(2, [0], 0.8),
      createCell(3, [0], 0.4),
      createCell(4, [0], 0.2),
      createCell(5, [0], 0)
    ];

    expect(getNeighborAverage(cells[0], cells)).toBeCloseTo((1 + 0.8 + 0.4 + 0.2 + 0) / 5);
  });

  it("can update a pentagon cell through the same average-based rule", () => {
    const next = updateCell(
      createCell(0, [1, 2, 3, 4, 5], 0.2, true),
      0.7,
      {
        config: {
          coupling: 0.5,
          activationThreshold: 0.6,
          activationBoost: 0.1,
          decay: 0.03
        }
      }
    );

    expect(next).toBeCloseTo(0.55);
  });

  it("commits nextState into state on each step", () => {
    const cells = [
      createCell(0, [1], 0.2),
      createCell(1, [0], 0.8)
    ];

    const next = stepSimulation(cells, {
      coupling: 1,
      activationThreshold: 0.95,
      activationBoost: 0,
      decay: 0
    });

    expect(next[0].state).toBeCloseTo(0.8);
    expect(next[1].state).toBeCloseTo(0.2);
    expect(next[0].nextState).toBeCloseTo(0.8);
  });
});
