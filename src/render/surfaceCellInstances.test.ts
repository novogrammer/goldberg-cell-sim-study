import { Quaternion, SphereGeometry, Vector3 } from "three/webgpu";
import { describe, expect, it } from "vitest";

import { createGoldbergMesh } from "../sim/goldberg";
import {
  getPackedSurfaceSphereRadius,
  SurfaceCellInstances
} from "./surfaceCellInstances";

describe("surfaceCellInstances", () => {
  it("packed sphere 半径は正で、惑星半径より小さい", () => {
    const mesh = createGoldbergMesh();

    const radius = getPackedSurfaceSphereRadius(mesh);

    expect(radius).toBeGreaterThan(0);
    expect(radius).toBeLessThan(1);
  });

  it("粗いメッシュほど大きい packed sphere を使う", () => {
    const coarseMesh = createGoldbergMesh(3);
    const denseMesh = createGoldbergMesh(10);

    expect(getPackedSurfaceSphereRadius(coarseMesh)).toBeGreaterThan(
      getPackedSurfaceSphereRadius(denseMesh)
    );
  });

  it("pick は表示用 instanceId ではなく専用 mesh の固定スロットを返す", () => {
    const instances = new SurfaceCellInstances(new SphereGeometry(1, 8, 4), 32);

    instances.registerCell(7, {
      landInstanceId: 12,
      normal: new Vector3(0, 1, 0),
      sphereCenter: new Vector3(1, 2, 3),
      surfaceRotation: new Quaternion(),
      waterInstanceId: 18
    });

    expect(instances.pickCellId(instances.pickMesh, 7)).toBe(7);
    expect(instances.pickCellId(instances.landMesh, 12)).toBeNull();
    expect(instances.pickCellId(instances.waterMesh, 18)).toBeNull();

    instances.dispose();
  });
});
