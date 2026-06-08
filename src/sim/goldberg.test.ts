import { describe, expect, it } from "vitest";
import { Vector3 } from "three";

import { createGoldbergMesh } from "./goldberg";

describe("createGoldbergMesh", () => {
  const mesh = createGoldbergMesh();
  const denseMesh = createGoldbergMesh(3);

  it("期待されるセル数を生成する", () => {
    expect(mesh.cells).toHaveLength(42);
    expect(mesh.geometry.faces).toHaveLength(42);
  });

  it("frequency を上げるとより多いセル数を生成できる", () => {
    expect(denseMesh.frequency).toBe(3);
    expect(denseMesh.cells).toHaveLength(92);
    expect(denseMesh.geometry.faces).toHaveLength(92);
    expect(denseMesh.pentagonCount).toBe(12);
    expect(denseMesh.hexagonCount).toBe(80);
  });

  it("water セルと land セルの両方を生成する", () => {
    const waterCells = mesh.cells.filter((cell) => cell.terrainKind === "water");
    const landCells = mesh.cells.filter((cell) => cell.terrainKind === "land");
    expect(waterCells.length).toBeGreaterThan(0);
    expect(landCells.length).toBeGreaterThan(0);
  });

  it("全セルの fertility と geology を初期化する", () => {
    for (const cell of mesh.cells) {
      expect(cell.fertility).toBeGreaterThanOrEqual(0);
      expect(cell.fertility).toBeLessThanOrEqual(1);
      expect(cell.geology).toBeGreaterThanOrEqual(0);
      expect(cell.geology).toBeLessThanOrEqual(1);
    }
  });

  it("12 個すべての五角形セルを 5 近傍として維持する", () => {
    const pentagons = mesh.cells.filter((cell) => cell.isPentagon);
    expect(pentagons).toHaveLength(12);
    expect(pentagons.every((cell) => cell.neighborCount === 5)).toBe(true);
  });

  it("非五角形セルを 6 近傍として維持する", () => {
    const hexagons = mesh.cells.filter((cell) => !cell.isPentagon);
    expect(hexagons).toHaveLength(30);
    expect(hexagons.every((cell) => cell.neighborCount === 6)).toBe(true);
  });

  it("高 frequency でも非五角形セルを 6 近傍として維持する", () => {
    const pentagons = denseMesh.cells.filter((cell) => cell.isPentagon);
    const hexagons = denseMesh.cells.filter((cell) => !cell.isPentagon);
    expect(pentagons).toHaveLength(12);
    expect(pentagons.every((cell) => cell.neighborCount === 5)).toBe(true);
    expect(hexagons).toHaveLength(80);
    expect(hexagons.every((cell) => cell.neighborCount === 6)).toBe(true);
  });

  it("隣接関係を双方向に保つ", () => {
    for (const cell of mesh.cells) {
      for (const neighborId of cell.neighbors) {
        expect(mesh.cells[neighborId].neighbors).toContain(cell.id);
      }
    }
  });

  it("各 face の頂点数をセルの近傍数に一致させる", () => {
    for (const face of mesh.geometry.faces) {
      const cell = mesh.cells[face.cellId];
      expect(face.vertexIndices).toHaveLength(cell.neighborCount);
    }
  });

  it("各セル face を平面に保つ", () => {
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

  it("隣接セル同士がちょうど 1 辺を共有する", () => {
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
