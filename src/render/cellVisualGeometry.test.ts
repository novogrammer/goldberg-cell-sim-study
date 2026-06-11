import { describe, expect, it } from "vitest";

import { createGoldbergMesh } from "../sim/goldberg";
import { getPackedSurfaceSphereRadius } from "./cellVisualGeometry";

describe("getPackedSurfaceSphereRadius", () => {
  it("returns a positive radius that stays below the planet radius", () => {
    const mesh = createGoldbergMesh();

    const radius = getPackedSurfaceSphereRadius(mesh);

    expect(radius).toBeGreaterThan(0);
    expect(radius).toBeLessThan(1);
  });

  it("uses larger spheres for coarser meshes", () => {
    const coarseMesh = createGoldbergMesh(3);
    const denseMesh = createGoldbergMesh(10);

    expect(getPackedSurfaceSphereRadius(coarseMesh)).toBeGreaterThan(
      getPackedSurfaceSphereRadius(denseMesh)
    );
  });
});
