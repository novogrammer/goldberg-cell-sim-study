import { describe, expect, it } from "vitest";

import { createGoldbergMesh } from "../sim/goldberg";
import { getPackedSurfaceSphereRadius } from "./surfaceCellInstances";

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
});
