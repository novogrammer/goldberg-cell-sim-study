import { Vector3 } from "three";

import type { Cell, CellRenderData, GoldbergMeshData } from "../types";

const PHI = (1 + Math.sqrt(5)) / 2;
const ICO_RADIUS = 1;
const GOLDBERG_FREQUENCY = 2;

const ICOSAHEDRON_VERTICES: [number, number, number][] = [
  [-1, PHI, 0],
  [1, PHI, 0],
  [-1, -PHI, 0],
  [1, -PHI, 0],
  [0, -1, PHI],
  [0, 1, PHI],
  [0, -1, -PHI],
  [0, 1, -PHI],
  [PHI, 0, -1],
  [PHI, 0, 1],
  [-PHI, 0, -1],
  [-PHI, 0, 1]
];

const ICOSAHEDRON_FACES: [number, number, number][] = [
  [0, 11, 5],
  [0, 5, 1],
  [0, 1, 7],
  [0, 7, 10],
  [0, 10, 11],
  [1, 5, 9],
  [5, 11, 4],
  [11, 10, 2],
  [10, 7, 6],
  [7, 1, 8],
  [3, 9, 4],
  [3, 4, 2],
  [3, 2, 6],
  [3, 6, 8],
  [3, 8, 9],
  [4, 9, 5],
  [2, 4, 11],
  [6, 2, 10],
  [8, 6, 7],
  [9, 8, 1]
];

interface TriangleFace {
  id: number;
  vertices: [number, number, number];
}

interface TriangulationData {
  vertices: Vector3[];
  faces: TriangleFace[];
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

function createNormalizedVertex(raw: [number, number, number]): Vector3 {
  return new Vector3(...raw).normalize().multiplyScalar(ICO_RADIUS);
}

function toKey(vector: Vector3): string {
  return `${vector.x.toFixed(8)}:${vector.y.toFixed(8)}:${vector.z.toFixed(8)}`;
}

function createTriangulation(frequency = GOLDBERG_FREQUENCY): TriangulationData {
  const baseVertices = ICOSAHEDRON_VERTICES.map(createNormalizedVertex);
  const vertexIndexByKey = new Map<string, number>();
  const vertices: Vector3[] = [];
  const faces: TriangleFace[] = [];

  const ensureVertex = (position: Vector3): number => {
    const normalized = position.clone().normalize().multiplyScalar(ICO_RADIUS);
    const key = toKey(normalized);
    const existing = vertexIndexByKey.get(key);
    if (existing !== undefined) {
      return existing;
    }

    const id = vertices.length;
    vertices.push(normalized);
    vertexIndexByKey.set(key, id);
    return id;
  };

  const baryVertexId = (
    a: Vector3,
    b: Vector3,
    c: Vector3,
    i: number,
    j: number,
    k: number
  ): number => {
    const weight = 1 / frequency;
    const point = a
      .clone()
      .multiplyScalar(i * weight)
      .add(b.clone().multiplyScalar(j * weight))
      .add(c.clone().multiplyScalar(k * weight));
    return ensureVertex(point);
  };

  for (const [aIndex, bIndex, cIndex] of ICOSAHEDRON_FACES) {
    const a = baseVertices[aIndex];
    const b = baseVertices[bIndex];
    const c = baseVertices[cIndex];
    const grid: number[][] = [];

    for (let row = 0; row <= frequency; row += 1) {
      grid[row] = [];
      for (let col = 0; col <= frequency - row; col += 1) {
        const i = frequency - row - col;
        const j = col;
        const k = row;
        grid[row][col] = baryVertexId(a, b, c, i, j, k);
      }
    }

    for (let row = 0; row < frequency; row += 1) {
      for (let col = 0; col < frequency - row; col += 1) {
        const top = grid[row][col];
        const left = grid[row + 1][col];
        const right = grid[row][col + 1];
        faces.push({
          id: faces.length,
          vertices: [top, right, left]
        });

        if (col < frequency - row - 1) {
          const bottomRight = grid[row + 1][col + 1];
          faces.push({
            id: faces.length,
            vertices: [right, bottomRight, left]
          });
        }
      }
    }
  }

  return { vertices, faces };
}

function buildAdjacency(
  vertexCount: number,
  faces: TriangleFace[]
): Map<number, Set<number>> {
  const adjacency = new Map<number, Set<number>>();

  const ensureSet = (vertexId: number): Set<number> => {
    const existing = adjacency.get(vertexId);
    if (existing) {
      return existing;
    }
    const next = new Set<number>();
    adjacency.set(vertexId, next);
    return next;
  };

  for (const face of faces) {
    const [a, b, c] = face.vertices;
    ensureSet(a).add(b);
    ensureSet(a).add(c);
    ensureSet(b).add(a);
    ensureSet(b).add(c);
    ensureSet(c).add(a);
    ensureSet(c).add(b);
  }

  for (let vertexId = 0; vertexId < vertexCount; vertexId += 1) {
    ensureSet(vertexId);
  }

  return adjacency;
}

function buildIncidentFaces(
  vertexCount: number,
  faces: TriangleFace[]
): Map<number, number[]> {
  const incidentFaces = new Map<number, number[]>();

  for (let vertexId = 0; vertexId < vertexCount; vertexId += 1) {
    incidentFaces.set(vertexId, []);
  }

  for (const face of faces) {
    for (const vertexId of face.vertices) {
      incidentFaces.get(vertexId)?.push(face.id);
    }
  }

  return incidentFaces;
}

function orderedDualPolygon(
  cellCenter: Vector3,
  triangleCenters: Vector3[]
): Vector3[] {
  const normal = cellCenter.clone().normalize();
  const referenceAxis = Math.abs(normal.y) > 0.9
    ? new Vector3(1, 0, 0)
    : new Vector3(0, 1, 0);
  const tangentX = new Vector3().crossVectors(referenceAxis, normal).normalize();
  const tangentY = new Vector3().crossVectors(normal, tangentX).normalize();

  return triangleCenters
    .map((center) => {
      const projected = center
        .clone()
        .sub(normal.clone().multiplyScalar(center.dot(normal)))
        .normalize();
      const angle = Math.atan2(projected.dot(tangentY), projected.dot(tangentX));
      return { angle, point: center.clone().normalize().multiplyScalar(ICO_RADIUS) };
    })
    .sort((left, right) => left.angle - right.angle)
    .map((entry) => entry.point);
}

export function createGoldbergMesh(): GoldbergMeshData {
  const triangulation = createTriangulation();
  const adjacency = buildAdjacency(triangulation.vertices.length, triangulation.faces);
  const incidentFaces = buildIncidentFaces(
    triangulation.vertices.length,
    triangulation.faces
  );
  const triangleCenters = triangulation.faces.map((face) => {
    const [a, b, c] = face.vertices.map((id) => triangulation.vertices[id]);
    return a
      .clone()
      .add(b)
      .add(c)
      .divideScalar(3)
      .normalize()
      .multiplyScalar(ICO_RADIUS);
  });

  const cells: Cell[] = triangulation.vertices.map((_, cellId) => {
    const neighbors = Array.from(adjacency.get(cellId) ?? []).sort((a, b) => a - b);
    const neighborCount = neighbors.length;

    return {
      id: cellId,
      neighbors,
      neighborCount,
      isPentagon: neighborCount === 5,
      state: 0,
      nextState: 0
    };
  });

  const renderCells: CellRenderData[] = triangulation.vertices.map((vertex, cellId) => {
    const polygonCenters = (incidentFaces.get(cellId) ?? []).map(
      (faceId) => triangleCenters[faceId]
    );
    const points = orderedDualPolygon(vertex, polygonCenters).map((point) => [
      point.x,
      point.y,
      point.z
    ] as [number, number, number]);

    return {
      cellId,
      points,
      center: [vertex.x, vertex.y, vertex.z]
    };
  });

  const pentagonCount = cells.filter((cell) => cell.isPentagon).length;
  const hexagonCount = cells.length - pentagonCount;

  if (cells.length !== 42) {
    throw new Error(`Expected 42 cells for frequency-2 Goldberg mesh, got ${cells.length}.`);
  }

  if (pentagonCount !== 12) {
    throw new Error(`Expected 12 pentagons, got ${pentagonCount}.`);
  }

  if (!cells.every((cell) => cell.isPentagon || cell.neighborCount === 6)) {
    throw new Error("Non-pentagon cells must remain 6-neighbor cells.");
  }

  return {
    cells,
    renderCells,
    pentagonCount,
    hexagonCount
  };
}

export function randomizeCellState(cells: Cell[], seed = 0.5): Cell[] {
  return cells.map((cell) => {
    const phase = Math.sin((cell.id + 1) * 12.9898 + seed * 78.233) * 43758.5453;
    const state = clamp01(phase - Math.floor(phase));
    return { ...cell, state, nextState: state };
  });
}
