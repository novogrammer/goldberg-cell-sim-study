import {
  BufferGeometry,
  Float32BufferAttribute,
  Vector3
} from "three";

import type { GoldbergMeshData } from "../types";

const OVERLAY_LIFT = 0.006;
const OVERLAY_WIDTH = 0.055;
const TILE_DEPTH = 0.12;
const TILE_SURFACE_LIFT = 0.08;
const TILE_TOP_INSET = 0.04;
const TILE_BEVEL_DROP_RATIO = 0.18;

function createTileSurfaceProfile(
  points: Vector3[],
  normal: Vector3,
  insetRatio: number,
  bevelDrop: number
) {
  const surfacePoints = points.map((point) =>
    point.clone().add(point.clone().normalize().multiplyScalar(TILE_SURFACE_LIFT))
  );
  const topCenter = surfacePoints
    .reduce((sum, point) => sum.add(point.clone()), new Vector3())
    .divideScalar(surfacePoints.length);
  const insetTopPoints = surfacePoints.map((point) =>
    point.clone().lerp(topCenter, insetRatio)
  );
  const outerTopPoints = surfacePoints.map((point) =>
    point.clone().sub(normal.clone().multiplyScalar(bevelDrop))
  );
  return {
    surfacePoints,
    outerTopPoints,
    insetTopPoints,
    topCenter
  };
}

function createCellGeometry(
  points: Vector3[],
  normal: Vector3,
  insetRatio: number,
  bevelDrop: number
): BufferGeometry {
  const { outerTopPoints, insetTopPoints } = createTileSurfaceProfile(
    points,
    normal,
    insetRatio,
    bevelDrop
  );
  const bottomPoints = outerTopPoints.map((point) =>
    point.clone().sub(normal.clone().multiplyScalar(TILE_DEPTH))
  );
  const positions: number[] = [];

  for (let index = 1; index < insetTopPoints.length - 1; index += 1) {
    const current = insetTopPoints[index];
    const next = insetTopPoints[index + 1];
    positions.push(
      insetTopPoints[0].x, insetTopPoints[0].y, insetTopPoints[0].z,
      current.x, current.y, current.z,
      next.x, next.y, next.z
    );
  }

  for (let index = 1; index < bottomPoints.length - 1; index += 1) {
    const current = bottomPoints[index];
    const next = bottomPoints[index + 1];
    positions.push(
      bottomPoints[0].x, bottomPoints[0].y, bottomPoints[0].z,
      next.x, next.y, next.z,
      current.x, current.y, current.z
    );
  }

  for (let index = 0; index < points.length; index += 1) {
    const outerTopCurrent = outerTopPoints[index];
    const outerTopNext = outerTopPoints[(index + 1) % points.length];
    const insetTopCurrent = insetTopPoints[index];
    const insetTopNext = insetTopPoints[(index + 1) % points.length];
    const bottomCurrent = bottomPoints[index];
    const bottomNext = bottomPoints[(index + 1) % points.length];

    positions.push(
      outerTopCurrent.x, outerTopCurrent.y, outerTopCurrent.z,
      outerTopNext.x, outerTopNext.y, outerTopNext.z,
      insetTopCurrent.x, insetTopCurrent.y, insetTopCurrent.z
    );

    positions.push(
      insetTopCurrent.x, insetTopCurrent.y, insetTopCurrent.z,
      outerTopNext.x, outerTopNext.y, outerTopNext.z,
      insetTopNext.x, insetTopNext.y, insetTopNext.z
    );

    positions.push(
      outerTopCurrent.x, outerTopCurrent.y, outerTopCurrent.z,
      outerTopNext.x, outerTopNext.y, outerTopNext.z,
      bottomCurrent.x, bottomCurrent.y, bottomCurrent.z
    );

    positions.push(
      bottomCurrent.x, bottomCurrent.y, bottomCurrent.z,
      outerTopNext.x, outerTopNext.y, outerTopNext.z,
      bottomNext.x, bottomNext.y, bottomNext.z
    );
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function createInsetOverlayGeometry(
  topPoints: Vector3[],
  topCenter: Vector3,
  overlayWidthRatio: number
): BufferGeometry {
  const liftedOuter = topPoints.map((point) =>
    point.clone().add(point.clone().normalize().multiplyScalar(OVERLAY_LIFT))
  );
  const inner = topPoints.map((point) =>
    point
      .clone()
      .lerp(topCenter, overlayWidthRatio)
      .add(
        point.clone().lerp(topCenter, overlayWidthRatio).normalize().multiplyScalar(OVERLAY_LIFT)
      )
  );
  const positions: number[] = [];

  for (let index = 0; index < topPoints.length; index += 1) {
    const outerCurrent = liftedOuter[index];
    const outerNext = liftedOuter[(index + 1) % topPoints.length];
    const innerCurrent = inner[index];
    const innerNext = inner[(index + 1) % topPoints.length];

    positions.push(
      outerCurrent.x, outerCurrent.y, outerCurrent.z,
      outerNext.x, outerNext.y, outerNext.z,
      innerCurrent.x, innerCurrent.y, innerCurrent.z
    );

    positions.push(
      innerCurrent.x, innerCurrent.y, innerCurrent.z,
      outerNext.x, outerNext.y, outerNext.z,
      innerNext.x, innerNext.y, innerNext.z
    );
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function getTileBevelDrop(meshData: GoldbergMeshData) {
  const hexagonFaces = meshData.geometry.faces.filter((face) => !meshData.cells[face.cellId].isPentagon);
  const total = hexagonFaces.reduce((sum, face) => sum + face.inradius, 0);
  return (total / hexagonFaces.length) * TILE_BEVEL_DROP_RATIO;
}

export function createCellVisualGeometry(
  points: Vector3[],
  normal: Vector3,
  circumradius: number,
  bevelDrop: number
) {
  const tileInsetRatio = Math.min(TILE_TOP_INSET / circumradius, 0.35);
  const { surfacePoints, topCenter } = createTileSurfaceProfile(
    points,
    normal,
    tileInsetRatio,
    bevelDrop
  );
  const overlayWidthRatio = Math.min(OVERLAY_WIDTH / circumradius, 0.18);

  return {
    tileGeometry: createCellGeometry(points, normal, tileInsetRatio, bevelDrop),
    overlayGeometry: createInsetOverlayGeometry(surfacePoints, topCenter, overlayWidthRatio)
  };
}
