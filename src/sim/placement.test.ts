import { describe, expect, it } from "vitest";
import { Vector3 } from "three";

import { createGoldbergMesh } from "./goldberg";
import { createCellPlacementTransform, getCellFaceGeometry } from "./placement";

describe("placement", () => {
  const mesh = createGoldbergMesh();

  it("各セル face に直交正規なローカル座標系を作る", () => {
    for (const face of mesh.geometry.faces) {
      const normal = new Vector3(...face.normal);
      const tangent = new Vector3(...face.tangent);
      const bitangent = new Vector3(...face.bitangent);

      expect(Math.abs(normal.dot(tangent))).toBeLessThan(1e-6);
      expect(Math.abs(normal.dot(bitangent))).toBeLessThan(1e-6);
      expect(Math.abs(tangent.dot(bitangent))).toBeLessThan(1e-6);
      expect(normal.length()).toBeCloseTo(1);
      expect(tangent.length()).toBeCloseTo(1);
      expect(bitangent.length()).toBeCloseTo(1);
    }
  });

  it("選択したセル face の上にオブジェクトを配置する", () => {
    const face = getCellFaceGeometry(mesh, 0);
    const transform = createCellPlacementTransform(mesh, {
      cellId: 0,
      offsetU: 0,
      offsetV: 0,
      height: 0.25,
      yaw: Math.PI / 4
    });
    const expected = new Vector3(...face.center)
      .add(new Vector3(...face.normal).multiplyScalar(0.25));

    expect(new Vector3(...transform.position).distanceTo(expected)).toBeLessThan(1e-6);
    expect(transform.yaw).toBeCloseTo(Math.PI / 4);
  });
});
