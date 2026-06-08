import { describe, expect, it } from "vitest";

import {
  getAdjacentWaterInfluence,
  getNeighborMoistureAverage,
  getNeighborVegetationInfluence,
  stepSimulation,
  updateMoisture,
  updateVegetation,
  DEFAULT_RULE_CONFIG
} from "./simulation";
import type { Cell } from "../types";

function createCell(
  id: number,
  neighbors: number[],
  vegetation: number,
  isPentagon = false,
  terrainKind: "water" | "land" = "land",
  fertility = 0.5,
  geology = 0.5,
  moisture = terrainKind === "water" ? 1 : 0.25
): Cell {
  return {
    id,
    neighbors,
    neighborCount: neighbors.length,
    isPentagon,
    terrainKind,
    fertility,
    geology,
    moisture,
    nextMoisture: moisture,
    vegetation,
    nextVegetation: vegetation,
    state: vegetation,
    nextState: vegetation
  };
}

describe("simulation", () => {
  it("局所近傍から隣接 water の影響を計算する", () => {
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

  it("乾燥セルより water 近傍の方が vegetation が速く成長する", () => {
    const cells = [
      createCell(0, [1, 2], 0.12, false, "land", 0.55, 0.55, 0.4),
      createCell(1, [0], 0, false, "water"),
      createCell(2, [0], 0.35, false, "land", 0.55, 0.55, 0.4),
      createCell(3, [4, 5], 0.12, false, "land", 0.55, 0.55, 0.08),
      createCell(4, [3], 0.1, false, "land", 0.55, 0.55, 0.08),
      createCell(5, [3], 0.08, false, "land", 0.55, 0.55, 0.08)
    ];

    const wetMoisture = updateMoisture(cells[0], cells, { config: DEFAULT_RULE_CONFIG });
    const dryMoisture = updateMoisture(cells[3], cells, { config: DEFAULT_RULE_CONFIG });
    const moistureCells = cells.map((cell) => ({
      ...cell,
      nextMoisture: cell.id === 0 ? wetMoisture : cell.id === 3 ? dryMoisture : cell.nextMoisture
    }));
    const wetNext = updateVegetation(moistureCells[0], moistureCells, { config: DEFAULT_RULE_CONFIG });
    const dryNext = updateVegetation(moistureCells[3], moistureCells, { config: DEFAULT_RULE_CONFIG });

    expect(wetNext).toBeGreaterThan(dryNext);
  });

  it("water セルの vegetation を常に 0 に保つ", () => {
    const next = updateVegetation(
      createCell(0, [1, 2, 3, 4, 5], 0, true, "water"),
      [
        createCell(0, [1, 2, 3, 4, 5], 0, true, "water"),
        createCell(1, [0], 1),
        createCell(2, [0], 0.8),
        createCell(3, [0], 0.4),
        createCell(4, [0], 0.2),
        createCell(5, [0], 0.3)
      ],
      { config: DEFAULT_RULE_CONFIG }
    );

    expect(next).toBe(0);
  });

  it("各ステップで nextVegetation を vegetation と state に反映する", () => {
    const cells = [
      createCell(0, [1], 0.2, false, "land", 0.6, 0.6),
      createCell(1, [0], 0, false, "water")
    ];

    const next = stepSimulation(cells, DEFAULT_RULE_CONFIG);

    expect(next[0].moisture).toBeGreaterThan(cells[0].moisture);
    expect(next[0].vegetation).toBeCloseTo(next[0].state);
    expect(next[1].vegetation).toBe(0);
    expect(next[0].nextVegetation).toBeCloseTo(next[0].vegetation);
  });

  it("近傍 vegetation を局所影響シグナルとして使う", () => {
    const cells = [
      createCell(0, [1, 2, 3], 0.1),
      createCell(1, [0], 0.9),
      createCell(2, [0], 0.6),
      createCell(3, [0], 0)
    ];

    expect(getNeighborVegetationInfluence(cells[0], cells)).toBeCloseTo((0.9 + 0.6 + 0) / 3);
  });

  it("近傍 moisture を局所影響シグナルとして使う", () => {
    const cells = [
      createCell(0, [1, 2, 3], 0.1, false, "land", 0.4, 0.5, 0.2),
      createCell(1, [0], 0.3, false, "land", 0.4, 0.5, 0.9),
      createCell(2, [0], 0.2, false, "land", 0.4, 0.5, 0.6),
      createCell(3, [0], 0.05, false, "land", 0.4, 0.5, 0.1)
    ];

    expect(getNeighborMoistureAverage(cells[0], cells)).toBeCloseTo((0.9 + 0.6 + 0.1) / 3);
  });

  it("water から 1 リング先にも moisture を伝播させる", () => {
    const cells = [
      createCell(0, [1], 0, false, "water"),
      createCell(1, [0, 2], 0.15, false, "land", 0.5, 0.6, 0.25),
      createCell(2, [1, 3], 0.15, false, "land", 0.5, 0.6, 0.1),
      createCell(3, [2], 0.15, false, "land", 0.5, 0.6, 0.05)
    ];

    const next = stepSimulation(cells, DEFAULT_RULE_CONFIG);

    expect(next[1].moisture).toBeGreaterThan(next[2].moisture);
    expect(next[2].moisture).toBeGreaterThan(next[3].moisture);
    expect(next[2].moisture).toBeGreaterThan(cells[2].moisture);
  });

  it("moisture が不足すると vegetation を 0 方向へ乾燥させる", () => {
    const cells = [
      createCell(0, [1, 2], 0.75, false, "land", 0.2, 0.2, 0.02),
      createCell(1, [0], 0.05, false, "land", 0.2, 0.2, 0.01),
      createCell(2, [0], 0.03, false, "land", 0.2, 0.2, 0.01)
    ];

    const next = stepSimulation(cells, DEFAULT_RULE_CONFIG);

    expect(next[0].vegetation).toBeLessThan(cells[0].vegetation);
  });

  it("乾燥ステップを繰り返すと疎な land を 0 近くに保つ", () => {
    let cells = [
      createCell(0, [1, 2], 0.28, false, "land", 0.15, 0.15, 0.01),
      createCell(1, [0], 0.01, false, "land", 0.15, 0.15, 0.01),
      createCell(2, [0], 0.01, false, "land", 0.15, 0.15, 0.01)
    ];

    for (let index = 0; index < 24; index += 1) {
      cells = stepSimulation(cells, DEFAULT_RULE_CONFIG);
    }

    expect(cells[0].vegetation).toBeLessThan(0.05);
  });

  it("最低 moisture 閾値未満では moisture 起因の growth を抑える", () => {
    const cell = createCell(0, [1, 2], 0.25, false, "land", 0.4, 0.4, 0.1);
    const cells = [
      cell,
      createCell(1, [0], 0.02, false, "land", 0.4, 0.4, 0.1),
      createCell(2, [0], 0.01, false, "land", 0.4, 0.4, 0.1)
    ];
    const belowThreshold = cells.map((entry) => ({
      ...entry,
      nextMoisture: 0.12
    }));
    const aboveThreshold = cells.map((entry) => ({
      ...entry,
      nextMoisture: 0.28
    }));

    const dryNext = updateVegetation(belowThreshold[0], belowThreshold, { config: DEFAULT_RULE_CONFIG });
    const wetNext = updateVegetation(aboveThreshold[0], aboveThreshold, { config: DEFAULT_RULE_CONFIG });

    expect(dryNext).toBeLessThan(cell.vegetation);
    expect(wetNext).toBeGreaterThan(dryNext);
  });
});
