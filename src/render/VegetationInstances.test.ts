import { describe, expect, it, vi } from "vitest";

import type { Cell, CellFaceGeometry } from "../types";
import { createCellVegetationLayout } from "./cellVegetationAppearance";
import { VegetationInstances } from "./VegetationInstances";

function createCell(): Cell {
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
    nextVegetation: 0.9
  };
}

function createFace(): CellFaceGeometry {
  return {
    cellId: 0,
    vertexIndices: [0, 1, 2, 3, 4, 5],
    center: [0, 0, 1.12],
    normal: [0, 0, 1],
    tangent: [1, 0, 0],
    bitangent: [0, 1, 0],
    inradius: 0.08,
    circumradius: 0.1
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

    instances.sync([cell], (cellId) => cellId === cell.id ? layout : undefined);

    expect(instances.treeMesh.count).toBeGreaterThan(0);
    expect(instances.weedMesh.count).toBeGreaterThan(0);
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
});
