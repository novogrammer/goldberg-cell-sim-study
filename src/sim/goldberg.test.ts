import { describe, expect, it } from "vitest";
import { Vector3 } from "three";

import { createGoldbergMesh } from "./goldberg";

describe("createGoldbergMesh", () => {
  const mesh = createGoldbergMesh();

  it("creates the expected number of cells", () => {
    expect(mesh.cells).toHaveLength(42);
    expect(mesh.geometry.faces).toHaveLength(42);
  });

  it("creates both water and land cells", () => {
    const waterCells = mesh.cells.filter((cell) => cell.terrainKind === "water");
    const landCells = mesh.cells.filter((cell) => cell.terrainKind === "land");
    expect(waterCells.length).toBeGreaterThan(0);
    expect(landCells.length).toBeGreaterThan(0);
  });

  it("initializes fertility and geology for every cell", () => {
    for (const cell of mesh.cells) {
      expect(cell.fertility).toBeGreaterThanOrEqual(0);
      expect(cell.fertility).toBeLessThanOrEqual(1);
      expect(cell.geology).toBeGreaterThanOrEqual(0);
      expect(cell.geology).toBeLessThanOrEqual(1);
    }
  });

  it("keeps all 12 pentagons as 5-neighbor cells", () => {
    const pentagons = mesh.cells.filter((cell) => cell.isPentagon);
    expect(pentagons).toHaveLength(12);
    expect(pentagons.every((cell) => cell.neighborCount === 5)).toBe(true);
  });

  it("keeps all non-pentagon cells as 6-neighbor cells", () => {
    const hexagons = mesh.cells.filter((cell) => !cell.isPentagon);
    expect(hexagons).toHaveLength(30);
    expect(hexagons.every((cell) => cell.neighborCount === 6)).toBe(true);
  });

  it("builds symmetric adjacency", () => {
    for (const cell of mesh.cells) {
      for (const neighborId of cell.neighbors) {
        expect(mesh.cells[neighborId].neighbors).toContain(cell.id);
      }
    }
  });

  it("creates face polygons that match the neighbor count", () => {
    for (const face of mesh.geometry.faces) {
      const cell = mesh.cells[face.cellId];
      expect(face.vertexIndices).toHaveLength(cell.neighborCount);
    }
  });

  it("keeps every cell face planar", () => {
    const vertices = mesh.geometry.vertices.map((vertex) => new Vector3(...vertex));

    for (const face of mesh.geometry.faces) {
      const center = new Vector3(...face.center);
      const normal = new Vector3(...face.normal);

      for (const vertexId of face.vertexIndices) {
        const distance = Math.abs(vertices[vertexId].clone().sub(center).dot(normal));
        expect(distance).toBeLessThan(1e-6);
      }
    }
  });

  it("shares exactly one edge between adjacent cells", () => {
    const faceMap = new Map(mesh.geometry.faces.map((face) => [face.cellId, face]));

    for (const cell of mesh.cells) {
      const face = faceMap.get(cell.id);
      expect(face).toBeDefined();

      for (const neighborId of cell.neighbors) {
        const neighborFace = faceMap.get(neighborId);
        expect(neighborFace).toBeDefined();
        const sharedVertices = face!.vertexIndices.filter((vertexId) =>
          neighborFace!.vertexIndices.includes(vertexId)
        );
        expect(sharedVertices).toHaveLength(2);
      }
    }
  });
});
