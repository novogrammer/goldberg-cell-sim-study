import { Quaternion, Vector3 } from "three/webgpu";
import { describe, expect, it, vi } from "vitest";

import type { SurfaceCellInstanceData } from "./SurfaceCellInstances";
import { SurfaceSelectionOverlay } from "./SurfaceSelectionOverlay";

function expectVectorToEqual(actual: Vector3, expected: Vector3) {
  expect(actual.x).toBeCloseTo(expected.x);
  expect(actual.y).toBeCloseTo(expected.y);
  expect(actual.z).toBeCloseTo(expected.z);
}

describe("SurfaceSelectionOverlay", () => {
  it("選択セルと同じセルの hover は隠し、別セルでは表示する", () => {
    const overlay = new SurfaceSelectionOverlay(2);
    const visuals = new Map<number, SurfaceCellInstanceData>([
      [
        1,
        {
          normal: new Vector3(0, 0, 1),
          sphereCenter: new Vector3(1, 2, 3),
          surfaceRotation: new Quaternion()
        }
      ],
      [
        2,
        {
          normal: new Vector3(1, 0, 0),
          sphereCenter: new Vector3(-1, -2, -3),
          surfaceRotation: new Quaternion()
        }
      ]
    ]);
    const getVisual = (cellId: number) => visuals.get(cellId);

    expect(overlay.hoverMesh.visible).toBe(false);
    expect(overlay.selectedMesh.visible).toBe(false);

    overlay.setHoveredCell(1, getVisual);
    expect(overlay.hoverMesh.visible).toBe(true);
    expect(overlay.selectedMesh.visible).toBe(false);

    overlay.setSelectedCell(1, getVisual);
    expect(overlay.hoverMesh.visible).toBe(false);
    expect(overlay.selectedMesh.visible).toBe(true);

    overlay.setHoveredCell(2, getVisual);
    expect(overlay.hoverMesh.visible).toBe(true);
    expect(overlay.selectedMesh.visible).toBe(true);

    overlay.dispose();
  });

  it("セルの中心・法線と表示種別ごとの offset を反映する", () => {
    const surfaceSphereRadius = 2;
    const overlay = new SurfaceSelectionOverlay(surfaceSphereRadius);
    const visual: SurfaceCellInstanceData = {
      normal: new Vector3(0, 0, 1),
      sphereCenter: new Vector3(1, 2, 3),
      surfaceRotation: new Quaternion()
    };
    const getVisual = () => visual;

    overlay.setHoveredCell(1, getVisual);
    overlay.setSelectedCell(2, getVisual);

    expectVectorToEqual(overlay.hoverMesh.position, new Vector3(1, 2, 3.1));
    expectVectorToEqual(overlay.selectedMesh.position, new Vector3(1, 2, 3.12));
    expectVectorToEqual(
      new Vector3(0, 1, 0).applyQuaternion(overlay.hoverMesh.quaternion),
      visual.normal
    );
    expectVectorToEqual(
      new Vector3(0, 1, 0).applyQuaternion(overlay.selectedMesh.quaternion),
      visual.normal
    );

    overlay.dispose();
  });

  it("visual がないセルを非表示にし、所有する描画リソースを破棄する", () => {
    const overlay = new SurfaceSelectionOverlay(2);
    const hoverGeometryDispose = vi.spyOn(overlay.hoverMesh.geometry, "dispose");
    const selectedGeometryDispose = vi.spyOn(overlay.selectedMesh.geometry, "dispose");
    const hoverMaterial = overlay.hoverMesh.material;
    const selectedMaterial = overlay.selectedMesh.material;

    expect(Array.isArray(hoverMaterial)).toBe(false);
    expect(Array.isArray(selectedMaterial)).toBe(false);
    if (Array.isArray(hoverMaterial) || Array.isArray(selectedMaterial)) {
      throw new Error("SurfaceSelectionOverlay の material は単一である必要があります");
    }

    const hoverMaterialDispose = vi.spyOn(hoverMaterial, "dispose");
    const selectedMaterialDispose = vi.spyOn(selectedMaterial, "dispose");

    overlay.setHoveredCell(1, () => undefined);
    overlay.setSelectedCell(2, () => undefined);

    expect(overlay.hoverMesh.visible).toBe(false);
    expect(overlay.selectedMesh.visible).toBe(false);

    overlay.dispose();

    expect(hoverGeometryDispose).toHaveBeenCalledOnce();
    expect(selectedGeometryDispose).toHaveBeenCalledOnce();
    expect(hoverMaterialDispose).toHaveBeenCalledOnce();
    expect(selectedMaterialDispose).toHaveBeenCalledOnce();
  });
});
