import {
  Color,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3
} from "three/webgpu";

import type { Cell, GoldbergMeshData } from "../types";

const DEFAULT_SURFACE_RADIUS = 1;
const hiddenScale = new Vector3(0, 0, 0);
const identityScale = new Vector3(1, 1, 1);
const tempRotation = new Quaternion();
const tempSurfaceMatrix = new Matrix4();

export const LAND_SURFACE_ROUGHNESS = 0.66;
export const WATER_SURFACE_ROUGHNESS = 0.15;

export type SurfaceMeshKind = "land" | "water";

export interface SurfaceCellInstanceData {
  landInstanceId: number;
  normal: Vector3;
  sphereCenter: Vector3;
  surfaceRotation: Quaternion;
  waterInstanceId: number;
}

export function getPackedSurfaceSphereRadius(meshData: GoldbergMeshData) {
  const faceCenters = new Map<number, Vector3>();
  let totalSurfaceRadius = 0;

  for (const face of meshData.geometry.faces) {
    const center = new Vector3(...face.center);
    faceCenters.set(face.cellId, center);
    totalSurfaceRadius += center.length();
  }

  let totalNeighborDistance = 0;
  let neighborPairCount = 0;

  for (const face of meshData.geometry.faces) {
    const center = faceCenters.get(face.cellId);
    if (!center) {
      continue;
    }

    for (const neighborId of meshData.cells[face.cellId].neighbors) {
      if (neighborId <= face.cellId) {
        continue;
      }

      const neighborCenter = faceCenters.get(neighborId);
      if (!neighborCenter) {
        continue;
      }

      totalNeighborDistance += center.distanceTo(neighborCenter);
      neighborPairCount += 1;
    }
  }

  if (neighborPairCount === 0) {
    return meshData.geometry.faces.reduce((sum, face) => sum + face.inradius, 0) / meshData.geometry.faces.length;
  }

  const averageSurfaceRadius = totalSurfaceRadius / meshData.geometry.faces.length || DEFAULT_SURFACE_RADIUS;
  const averageNeighborDistance = totalNeighborDistance / neighborPairCount;
  return (averageSurfaceRadius * averageNeighborDistance) / (2 * averageSurfaceRadius - averageNeighborDistance);
}

export function setSurfaceInstanceTransform(
  mesh: InstancedMesh,
  instanceId: number,
  sphereCenter: Vector3,
  surfaceRotation: Quaternion,
  visible: boolean
) {
  tempRotation.copy(surfaceRotation);
  tempSurfaceMatrix.compose(
    sphereCenter,
    tempRotation,
    visible ? identityScale : hiddenScale
  );
  mesh.setMatrixAt(instanceId, tempSurfaceMatrix);
}

export function applySurfaceCellState(
  landSurfaceMesh: InstancedMesh,
  waterSurfaceMesh: InstancedMesh,
  visual: SurfaceCellInstanceData,
  terrainKind: Cell["terrainKind"],
  cellColor: Color
) {
  setSurfaceInstanceTransform(
    landSurfaceMesh,
    visual.landInstanceId,
    visual.sphereCenter,
    visual.surfaceRotation,
    terrainKind === "land"
  );
  setSurfaceInstanceTransform(
    waterSurfaceMesh,
    visual.waterInstanceId,
    visual.sphereCenter,
    visual.surfaceRotation,
    terrainKind === "water"
  );
  landSurfaceMesh.setColorAt(visual.landInstanceId, cellColor);
  waterSurfaceMesh.setColorAt(visual.waterInstanceId, cellColor);
}

export function resolveSurfaceCellIdFromIntersection(
  hitObject: unknown,
  instanceId: number,
  landSurfaceMesh: InstancedMesh,
  waterSurfaceMesh: InstancedMesh,
  landInstanceToCellId: Map<number, number>,
  waterInstanceToCellId: Map<number, number>
) {
  if (hitObject === landSurfaceMesh) {
    return landInstanceToCellId.get(instanceId) ?? null;
  }

  if (hitObject === waterSurfaceMesh) {
    return waterInstanceToCellId.get(instanceId) ?? null;
  }

  return null;
}
