import { describe, expect, it } from "vitest";

import { createGoldbergMesh } from "./goldberg";

describe("createGoldbergMesh", () => {
  const mesh = createGoldbergMesh();

  it("creates the expected number of cells", () => {
    expect(mesh.cells).toHaveLength(42);
    expect(mesh.renderCells).toHaveLength(42);
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

  it("creates render polygons that match the neighbor count", () => {
    for (const renderCell of mesh.renderCells) {
      const cell = mesh.cells[renderCell.cellId];
      expect(renderCell.points).toHaveLength(cell.neighborCount);
    }
  });
});
