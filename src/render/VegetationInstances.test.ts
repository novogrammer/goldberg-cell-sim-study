import { DynamicDrawUsage, InstancedBufferAttribute } from "three/webgpu";
import { describe, expect, it, vi } from "vitest";

import type { Cell, CellFaceGeometry } from "../types";
import { createCellVegetationLayout } from "./cellVegetationAppearance";
import { VegetationInstances } from "./VegetationInstances";

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
    vegetation: 0.9,
    nextVegetation: 0.9,
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

describe("VegetationInstances", () => {
  it("sync で植生 instance と更新情報を反映する", () => {
    const instances = new VegetationInstances(1);
    const cell = createCell();
    const layout = createCellVegetationLayout(createFace(), cell);
    const initialTreeMatrixVersion = instances.treeMesh.instanceMatrix.version;
    const initialWeedMatrixVersion = instances.weedMesh.instanceMatrix.version;

    expect(instances.treeMesh.count).toBe(0);
    expect(instances.weedMesh.count).toBe(0);
    expect(instances.weedMesh.material).toMatchObject({
      isNodeMaterial: true,
      positionNode: expect.any(Object)
    });
    instances.weedMesh.geometry.computeBoundingBox();
    expect(instances.weedMesh.geometry.boundingBox?.min.y).toBeCloseTo(0);
    expect(instances.weedMesh.geometry.boundingBox?.max.y).toBeCloseTo(1);

    instances.sync([cell], (cellId) => cellId === cell.id ? layout : undefined);

    expect(instances.treeMesh.count).toBeGreaterThan(0);
    expect(instances.weedMesh.count).toBeGreaterThan(0);
    expect(instances.treeMesh.instanceMatrix.usage).toBe(DynamicDrawUsage);
    expect(instances.weedMesh.instanceMatrix.usage).toBe(DynamicDrawUsage);
    expect(instances.treeMesh.instanceColor?.usage).toBe(DynamicDrawUsage);
    expect(instances.weedMesh.instanceColor?.usage).toBe(DynamicDrawUsage);
    const phaseAttribute = instances.weedMesh.geometry.getAttribute("weedPhase");
    expect(phaseAttribute).toBeInstanceOf(InstancedBufferAttribute);
    if (!(phaseAttribute instanceof InstancedBufferAttribute)) {
      throw new Error("weedPhase は InstancedBufferAttribute である必要があります");
    }
    expect(phaseAttribute.usage).toBe(DynamicDrawUsage);
    expect(instances.treeMesh.instanceMatrix.version).toBeGreaterThan(
      initialTreeMatrixVersion
    );
    expect(instances.weedMesh.instanceMatrix.version).toBeGreaterThan(
      initialWeedMatrixVersion
    );
    expect(instances.treeMesh.instanceColor?.version).toBeGreaterThan(0);
    expect(instances.weedMesh.instanceColor?.version).toBeGreaterThan(0);

    instances.dispose();
  });

  it("所有する geometry と material を破棄する", () => {
    const instances = new VegetationInstances(1);
    const treeGeometryDispose = vi.spyOn(instances.treeMesh.geometry, "dispose");
    const weedGeometryDispose = vi.spyOn(instances.weedMesh.geometry, "dispose");
    const treeMaterial = instances.treeMesh.material;
    const weedMaterial = instances.weedMesh.material;

    expect(Array.isArray(treeMaterial)).toBe(false);
    expect(Array.isArray(weedMaterial)).toBe(false);
    if (Array.isArray(treeMaterial) || Array.isArray(weedMaterial)) {
      throw new Error("VegetationInstances の material は単一である必要があります");
    }

    const treeMaterialDispose = vi.spyOn(treeMaterial, "dispose");
    const weedMaterialDispose = vi.spyOn(weedMaterial, "dispose");

    instances.dispose();

    expect(treeGeometryDispose).toHaveBeenCalledOnce();
    expect(weedGeometryDispose).toHaveBeenCalledOnce();
    expect(treeMaterialDispose).toHaveBeenCalledOnce();
    expect(weedMaterialDispose).toHaveBeenCalledOnce();
  });

  it("packed slot が移動しても同じ weed の位相を維持する", () => {
    const instances = new VegetationInstances(2);
    const firstCell = createCell({ id: 0 });
    const targetCell = createCell({ id: 7 });
    const layouts = new Map([
      [firstCell.id, createCellVegetationLayout(createFace({ cellId: firstCell.id }), firstCell)],
      [targetCell.id, createCellVegetationLayout(createFace({ cellId: targetCell.id }), targetCell)]
    ]);
    const phaseAttribute = instances.weedMesh.geometry.getAttribute("weedPhase");

    instances.sync([firstCell], (cellId) => layouts.get(cellId));
    const firstCellWeedCount = instances.weedMesh.count;
    instances.sync([targetCell], (cellId) => layouts.get(cellId));
    const targetPhaseBeforePackingShift = phaseAttribute.getX(0);

    instances.sync([firstCell, targetCell], (cellId) => layouts.get(cellId));

    expect(phaseAttribute.getX(firstCellWeedCount)).toBeCloseTo(
      targetPhaseBeforePackingShift
    );

    instances.dispose();
  });
});
