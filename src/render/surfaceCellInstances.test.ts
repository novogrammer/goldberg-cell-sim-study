import { Color, Quaternion, SphereGeometry, Vector3 } from "three/webgpu";
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
    const visuals = new Map<number, {
      normal: Vector3;
      sphereCenter: Vector3;
      surfaceRotation: Quaternion;
    }>();

    const cellVisual = {
      normal: new Vector3(0, 1, 0),
      sphereCenter: new Vector3(1, 2, 3),
      surfaceRotation: new Quaternion()
    };
    visuals.set(7, cellVisual);

    instances.registerCell(7, cellVisual);
    instances.syncPackedInstances(
      [
        {
          id: 7,
          neighbors: [],
          neighborCount: 0,
          isPentagon: false,
          terrainKind: "land",
          baseFertility: 0,
          fertility: 0,
          geology: 0,
          moisture: 0,
          nextMoisture: 0,
          vegetation: 0,
          nextVegetation: 0
        }
      ],
      (cellId) => visuals.get(cellId),
      () => new Color("#ffffff")
    );

    expect(instances.pickCellId(instances.pickMesh, 7)).toBe(7);
    expect(instances.pickCellId(instances.landMesh, 12)).toBeNull();
    expect(instances.pickCellId(instances.waterMesh, 18)).toBeNull();
    expect(instances.landMesh.count).toBe(1);
    expect(instances.waterMesh.count).toBe(0);

    instances.dispose();
  });
});
