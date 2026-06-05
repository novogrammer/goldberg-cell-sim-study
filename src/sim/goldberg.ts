import { Vector3 } from "three";

import type { Cell, CellFaceGeometry, GoldbergMeshData, GoldbergPolyhedronGeometry } from "../types";

const PHI = (1 + Math.sqrt(5)) / 2;
const ICO_RADIUS = 1;
const DEFAULT_GOLDBERG_FREQUENCY = 2;

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

interface GoldbergTopology {
  cells: Cell[];
  triangulation: TriangulationData;
  incidentFaces: Map<number, number[]>;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const FACE_PLANE_DISTANCE = 1.12;

function createNormalizedVertex(raw: [number, number, number]): Vector3 {
  return new Vector3(...raw).normalize().multiplyScalar(ICO_RADIUS);
}

function toKey(vector: Vector3): string {
  return `${vector.x.toFixed(8)}:${vector.y.toFixed(8)}:${vector.z.toFixed(8)}`;
}

function createTriangulation(frequency = DEFAULT_GOLDBERG_FREQUENCY): TriangulationData {
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

function orderedIndicesAroundNormal(
  cellCenter: Vector3,
  points: Vector3[],
  pointIndices: number[]
): number[] {
  const normal = cellCenter.clone().normalize();
  const referenceAxis = Math.abs(normal.y) > 0.9
    ? new Vector3(1, 0, 0)
    : new Vector3(0, 1, 0);
  const tangentX = new Vector3().crossVectors(referenceAxis, normal).normalize();
  const tangentY = new Vector3().crossVectors(normal, tangentX).normalize();

  return points
    .map((point, index) => {
      const projected = point
        .clone()
        .sub(normal.clone().multiplyScalar(point.dot(normal)))
        .normalize();
      const angle = Math.atan2(projected.dot(tangentY), projected.dot(tangentX));
      return { angle, pointIndex: pointIndices[index] };
    })
    .sort((left, right) => left.angle - right.angle)
    .map((entry) => entry.pointIndex);
}

function intersectFacePlanes(a: Vector3, b: Vector3, c: Vector3, distance: number): Vector3 {
  const bc = new Vector3().crossVectors(b, c);
  const ca = new Vector3().crossVectors(c, a);
  const ab = new Vector3().crossVectors(a, b);
  const denominator = a.dot(bc);

  if (Math.abs(denominator) < 1e-8) {
    throw new Error("Failed to intersect Goldberg多面体のface planes.");
  }

  return bc.add(ca).add(ab).multiplyScalar(distance / denominator);
}

function createLocalFrame(normal: Vector3, center: Vector3, firstVertex: Vector3) {
  const fallbackAxis = Math.abs(normal.y) > 0.9
    ? new Vector3(1, 0, 0)
    : new Vector3(0, 1, 0);
  const tangentSeed = firstVertex.clone().sub(center);
  const tangent = tangentSeed.lengthSq() > 1e-10
    ? tangentSeed.clone().normalize()
    : new Vector3().crossVectors(fallbackAxis, normal).normalize();
  const bitangent = new Vector3().crossVectors(normal, tangent).normalize();

  return {
    tangent,
    bitangent
  };
}

function createGoldbergTopology(frequency = DEFAULT_GOLDBERG_FREQUENCY): GoldbergTopology {
  const triangulation = createTriangulation(frequency);
  const adjacency = buildAdjacency(triangulation.vertices.length, triangulation.faces);
  const incidentFaces = buildIncidentFaces(
    triangulation.vertices.length,
    triangulation.faces
  );

  const cells: Cell[] = triangulation.vertices.map((_, cellId) => {
    const neighbors = Array.from(adjacency.get(cellId) ?? []).sort((a, b) => a - b);
    const neighborCount = neighbors.length;

    return {
      id: cellId,
      neighbors,
      neighborCount,
      isPentagon: neighborCount === 5,
      terrainKind: "land",
      fertility: 0,
      geology: 0,
      moisture: 0,
      nextMoisture: 0,
      vegetation: 0,
      nextVegetation: 0,
      state: 0,
      nextState: 0
    };
  });

  return {
    cells,
    triangulation,
    incidentFaces
  };
}

function createGoldbergPolyhedronGeometry(
  topology: GoldbergTopology
): GoldbergPolyhedronGeometry {
  const vertices = topology.triangulation.faces.map((face) => {
    const [a, b, c] = face.vertices.map((id) => topology.triangulation.vertices[id].clone().normalize());
    const vertex = intersectFacePlanes(a, b, c, FACE_PLANE_DISTANCE);
    return [vertex.x, vertex.y, vertex.z] as [number, number, number];
  });

  const faceVectors = vertices.map((vertex) => new Vector3(...vertex));
  const faces: CellFaceGeometry[] = topology.cells.map((cell) => {
    const centerNormal = topology.triangulation.vertices[cell.id].clone().normalize();
    const incidentFaceIds = topology.incidentFaces.get(cell.id) ?? [];
    const orderedVertexIndices = orderedIndicesAroundNormal(
      centerNormal,
      incidentFaceIds.map((vertexId) => faceVectors[vertexId]),
      incidentFaceIds
    );
    const polygonPoints = orderedVertexIndices.map((vertexId) => faceVectors[vertexId]);
    const faceCenter = polygonPoints
      .reduce((sum, point) => sum.add(point.clone()), new Vector3())
      .divideScalar(polygonPoints.length);
    const projectedCenter = centerNormal
      .clone()
      .multiplyScalar(FACE_PLANE_DISTANCE / centerNormal.dot(faceCenter.clone().normalize()));
    const { tangent, bitangent } = createLocalFrame(
      centerNormal,
      faceCenter,
      polygonPoints[0]
    );

    let inradius = Number.POSITIVE_INFINITY;
    let circumradius = 0;

    for (let index = 0; index < polygonPoints.length; index += 1) {
      const point = polygonPoints[index];
      circumradius = Math.max(circumradius, point.distanceTo(faceCenter));

      const next = polygonPoints[(index + 1) % polygonPoints.length];
      const edge = next.clone().sub(point);
      const toCenter = faceCenter.clone().sub(point);
      const edgeLength = edge.length();
      const distanceToEdge = edge.clone().cross(toCenter).length() / edgeLength;
      inradius = Math.min(inradius, distanceToEdge);
    }

    return {
      cellId: cell.id,
      vertexIndices: orderedVertexIndices,
      center: [projectedCenter.x, projectedCenter.y, projectedCenter.z],
      normal: [centerNormal.x, centerNormal.y, centerNormal.z],
      tangent: [tangent.x, tangent.y, tangent.z],
      bitangent: [bitangent.x, bitangent.y, bitangent.z],
      inradius,
      circumradius
    };
  });

  return {
    vertices,
    faces
  };
}

function normalizedNoise(seed: number): number {
  return clamp01(Math.sin(seed * 12.9898) * 43758.5453 % 1 + 0.5);
}

export function createInitialPlanetEnvironment(
  cells: Cell[],
  geometry: GoldbergPolyhedronGeometry
): Cell[] {
  const waterPoleA = new Vector3(0.65, 0.22, 0.72).normalize();
  const waterPoleB = new Vector3(-0.58, -0.31, 0.75).normalize();

  return cells.map((cell) => {
    const face = geometry.faces[cell.id];
    const center = new Vector3(...face.center).normalize();
    const waterScore = Math.max(center.dot(waterPoleA), center.dot(waterPoleB));
    const terrainKind = waterScore > 0.84 ? "water" : "land";
    const noiseSeed = center.x * 31.7 + center.y * 19.3 + center.z * 13.1 + cell.id * 0.37;
    const geology = clamp01(
      0.5 + center.y * 0.18 + Math.sin(noiseSeed * 1.9) * 0.24 + normalizedNoise(noiseSeed) * 0.1
    );
    const fertility = clamp01(
      0.46 + center.x * 0.12 - center.z * 0.08 + Math.cos(noiseSeed * 1.4) * 0.21
    );
    const moisture = terrainKind === "water"
      ? 1
      : clamp01(0.08 + Math.max(0, waterScore - 0.58) * 1.6 + geology * 0.08);
    const vegetation = terrainKind === "water"
      ? 0
      : clamp01(Math.max(0, moisture - 0.18) * 0.72 + fertility * 0.12 + geology * 0.06);

    return {
      ...cell,
      terrainKind,
      fertility,
      geology,
      moisture,
      nextMoisture: moisture,
      vegetation,
      nextVegetation: vegetation,
      state: vegetation,
      nextState: vegetation
    };
  });
}

function expectedCellCountForFrequency(frequency: number): number {
  return 10 * frequency * frequency + 2;
}

export function createGoldbergMesh(frequency = DEFAULT_GOLDBERG_FREQUENCY): GoldbergMeshData {
  if (!Number.isInteger(frequency) || frequency < 1) {
    throw new Error(`Goldberg mesh frequency must be a positive integer, got ${frequency}.`);
  }

  const topology = createGoldbergTopology(frequency);
  const geometry = createGoldbergPolyhedronGeometry(topology);
  const cells = createInitialPlanetEnvironment(topology.cells, geometry);

  const pentagonCount = cells.filter((cell) => cell.isPentagon).length;
  const hexagonCount = cells.length - pentagonCount;
  const expectedCellCount = expectedCellCountForFrequency(frequency);

  if (cells.length !== expectedCellCount) {
    throw new Error(
      `Expected ${expectedCellCount} cells for frequency-${frequency} Goldberg mesh, got ${cells.length}.`
    );
  }

  if (pentagonCount !== 12) {
    throw new Error(`Expected 12 pentagons, got ${pentagonCount}.`);
  }

  if (!cells.every((cell) => cell.isPentagon || cell.neighborCount === 6)) {
    throw new Error("Non-pentagon cells must remain 6-neighbor cells.");
  }

  return {
    frequency,
    cells,
    geometry,
    pentagonCount,
    hexagonCount
  };
}

export function randomizeCellState(cells: Cell[], seed = 0.5): Cell[] {
  return cells.map((cell) => {
    if (cell.terrainKind === "water") {
      return {
        ...cell,
        moisture: 1,
        nextMoisture: 1,
        vegetation: 0,
        nextVegetation: 0,
        state: 0,
        nextState: 0
      };
    }
    const phase = Math.sin((cell.id + 1) * 12.9898 + seed * 78.233) * 43758.5453;
    const state = clamp01(phase - Math.floor(phase));
    return {
      ...cell,
      moisture: clamp01(0.1 + state * 0.35 + cell.geology * 0.08),
      nextMoisture: clamp01(0.1 + state * 0.35 + cell.geology * 0.08),
      vegetation: state,
      nextVegetation: state,
      state,
      nextState: state
    };
  });
}
