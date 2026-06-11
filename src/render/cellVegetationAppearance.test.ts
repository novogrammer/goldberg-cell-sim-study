import { describe, expect, it } from "vitest";

import {
  getVegetationIndicatorState,
  getVegetationSizeMetrics
} from "./cellVegetationAppearance";
import { createGoldbergMesh } from "../sim/goldberg";
import type { Cell, CellFaceGeometry } from "../types";

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

function createFace(overrides: Partial<CellFaceGeometry> = {}): CellFaceGeometry {
  return {
    cellId: 0,
    vertexIndices: [0, 1, 2, 3, 4, 5],
    center: [0, 0, 1.12],
    normal: [0, 0, 1],
    tangent: [1, 0, 0],
    bitangent: [0, 1, 0],
    inradius: 0.08,
    circumradius: 0.1,
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

  it("大きいセルほど植生オブジェクトの基準サイズも大きくする", () => {
    const small = getVegetationSizeMetrics(createFace({ inradius: 0.08 }));
    const large = getVegetationSizeMetrics(createFace({ inradius: 0.21 }));

    expect(large.baseHeight).toBeGreaterThan(small.baseHeight);
    expect(large.baseRadius).toBeGreaterThan(small.baseRadius);
    expect(large.layoutScale).toBeGreaterThan(small.layoutScale);
  });

  it("frequency=3 のメッシュでは frequency=10 より大きい植生サイズを使う", () => {
    const coarseMesh = createGoldbergMesh(3);
    const denseMesh = createGoldbergMesh(10);
    const coarseFace = coarseMesh.geometry.faces.find((face) => !coarseMesh.cells[face.cellId].isPentagon);
    const denseFace = denseMesh.geometry.faces.find((face) => !denseMesh.cells[face.cellId].isPentagon);

    expect(coarseFace).toBeDefined();
    expect(denseFace).toBeDefined();

    const coarseMetrics = getVegetationSizeMetrics(coarseFace!);
    const denseMetrics = getVegetationSizeMetrics(denseFace!);

    expect(coarseMetrics.baseHeight).toBeGreaterThan(denseMetrics.baseHeight);
    expect(coarseMetrics.baseRadius).toBeGreaterThan(denseMetrics.baseRadius);
    expect(coarseMetrics.layoutScale).toBeGreaterThan(denseMetrics.layoutScale);
  });
});
