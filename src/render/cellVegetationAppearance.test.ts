import { BoxGeometry, InstancedMesh, MeshBasicMaterial } from "three/webgpu";
import { describe, expect, it } from "vitest";

import {
  createCellVegetationLayout,
  getVegetationIndicatorState,
  getVegetationSizeMetrics,
  syncPackedVegetationInstances,
  TREE_INSTANCE_COUNT,
  WEED_INSTANCE_COUNT
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

function createVegetationTestMesh(capacity: number) {
  return new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial(), capacity);
}

describe("cellVegetationAppearance", () => {
  it("water セルには植生オブジェクトを出さない", () => {
    const state = getVegetationIndicatorState(
      createCell({ terrainKind: "water", vegetation: 1 })
    );

    expect(state.visibleTreeCount).toBe(0);
  });

  it("vegetation が高いほど本数とスケールを増やす", () => {
    const sparse = getVegetationIndicatorState(createCell({ vegetation: 0.1 }));
    const dense = getVegetationIndicatorState(createCell({ vegetation: 0.9 }));

    expect(sparse.visibleTreeCount).toBeGreaterThan(0);
    expect(dense.visibleTreeCount).toBeGreaterThan(sparse.visibleTreeCount);
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

  it("vegetation が 0 のセルは tree / weed の count に含めない", () => {
    const treeMesh = createVegetationTestMesh(TREE_INSTANCE_COUNT);
    const weedMesh = createVegetationTestMesh(WEED_INSTANCE_COUNT);
    const cell = createCell({ vegetation: 0 });
    const face = createFace();
    const layouts = new Map([[cell.id, createCellVegetationLayout(face, cell)]]);

    syncPackedVegetationInstances(
      treeMesh,
      weedMesh,
      [cell],
      (cellId) => layouts.get(cellId)
    );

    expect(treeMesh.count).toBe(0);
    expect(weedMesh.count).toBe(0);
  });

  it("高 vegetation の land セルは visible 本数だけ count を増やす", () => {
    const treeMesh = createVegetationTestMesh(TREE_INSTANCE_COUNT * 2);
    const weedMesh = createVegetationTestMesh(WEED_INSTANCE_COUNT * 2);
    const sparseCell = createCell({ id: 0, vegetation: 0.1 });
    const denseCell = createCell({ id: 1, vegetation: 0.9 });
    const sparseLayout = createCellVegetationLayout(createFace({ cellId: 0 }), sparseCell);
    const denseLayout = createCellVegetationLayout(createFace({ cellId: 1 }), denseCell);
    const layouts = new Map([
      [sparseCell.id, sparseLayout],
      [denseCell.id, denseLayout]
    ]);
    const sparseState = getVegetationIndicatorState(sparseCell);
    const denseState = getVegetationIndicatorState(denseCell);

    syncPackedVegetationInstances(
      treeMesh,
      weedMesh,
      [sparseCell, denseCell],
      (cellId) => layouts.get(cellId)
    );

    const sparseVisibleTreeCount = sparseCell.vegetation >= 0.22 ? sparseState.visibleTreeCount : 0;
    const denseVisibleTreeCount = denseCell.vegetation >= 0.22 ? denseState.visibleTreeCount : 0;

    expect(treeMesh.count).toBe(sparseVisibleTreeCount + denseVisibleTreeCount);
    expect(weedMesh.count).toBe(
      (sparseState.visibleTreeCount === 0
        ? 0
        : Math.min(WEED_INSTANCE_COUNT, Math.max(2, sparseState.visibleTreeCount * 2))) +
        (denseState.visibleTreeCount === 0
          ? 0
          : Math.min(WEED_INSTANCE_COUNT, Math.max(2, denseState.visibleTreeCount * 2)))
    );
  });

  it("water セルは vegetation 描画から除外する", () => {
    const treeMesh = createVegetationTestMesh(TREE_INSTANCE_COUNT * 2);
    const weedMesh = createVegetationTestMesh(WEED_INSTANCE_COUNT * 2);
    const landCell = createCell({ id: 0, vegetation: 0.9 });
    const waterCell = createCell({ id: 1, terrainKind: "water", vegetation: 1 });
    const layouts = new Map([
      [landCell.id, createCellVegetationLayout(createFace({ cellId: 0 }), landCell)],
      [waterCell.id, createCellVegetationLayout(createFace({ cellId: 1 }), waterCell)]
    ]);
    const landState = getVegetationIndicatorState(landCell);

    syncPackedVegetationInstances(
      treeMesh,
      weedMesh,
      [landCell, waterCell],
      (cellId) => layouts.get(cellId)
    );

    expect(treeMesh.count).toBe(landState.visibleTreeCount);
    expect(weedMesh.count).toBe(
      Math.min(WEED_INSTANCE_COUNT, Math.max(2, landState.visibleTreeCount * 2))
    );
  });
});
