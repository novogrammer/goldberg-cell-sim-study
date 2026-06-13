import {
  Color,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3
} from "three/webgpu";

import type { Cell, GoldbergMeshData } from "../types";

const DEFAULT_SURFACE_RADIUS = 1;
const hiddenScale = new Vector3(0, 0, 0);
const identityScale = new Vector3(1, 1, 1);
const tempRotation = new Quaternion();
const tempSurfaceMatrix = new Matrix4();

const LAND_SURFACE_ROUGHNESS = 0.66;
const WATER_SURFACE_ROUGHNESS = 0.15;

export interface SurfaceCellInstanceData {
  landInstanceId: number;
  normal: Vector3;
  sphereCenter: Vector3;
  surfaceRotation: Quaternion;
  waterInstanceId: number;
}

export class SurfaceCellInstances {
  readonly landMesh: InstancedMesh;
  readonly waterMesh: InstancedMesh;

  private readonly landInstanceToCellId = new Map<number, number>();
  private readonly waterInstanceToCellId = new Map<number, number>();

  constructor(surfaceSphereGeometry: SphereGeometry, maxCount: number) {
    const landSurfaceMaterial = new MeshStandardMaterial({
      color: "#ffffff",
      roughness: LAND_SURFACE_ROUGHNESS,
      metalness: 0.08
    });
    const waterSurfaceMaterial = new MeshStandardMaterial({
      color: "#ffffff",
      roughness: WATER_SURFACE_ROUGHNESS,
      metalness: 0.08
    });

    this.landMesh = new InstancedMesh(
      surfaceSphereGeometry,
      landSurfaceMaterial,
      maxCount
    );
    this.waterMesh = new InstancedMesh(
      surfaceSphereGeometry,
      waterSurfaceMaterial,
      maxCount
    );
    this.landMesh.count = maxCount;
    this.waterMesh.count = maxCount;
  }

  registerCell(cellId: number, visual: SurfaceCellInstanceData) {
    this.landInstanceToCellId.set(visual.landInstanceId, cellId);
    this.waterInstanceToCellId.set(visual.waterInstanceId, cellId);
  }

  applyCellState(
    visual: SurfaceCellInstanceData,
    terrainKind: Cell["terrainKind"],
    cellColor: Color
  ) {
    setSurfaceInstanceTransform(
      this.landMesh,
      visual.landInstanceId,
      visual.sphereCenter,
      visual.surfaceRotation,
      terrainKind === "land"
    );
    setSurfaceInstanceTransform(
      this.waterMesh,
      visual.waterInstanceId,
      visual.sphereCenter,
      visual.surfaceRotation,
      terrainKind === "water"
    );
    this.landMesh.setColorAt(visual.landInstanceId, cellColor);
    this.waterMesh.setColorAt(visual.waterInstanceId, cellColor);
  }

  sync() {
    this.landMesh.instanceMatrix.needsUpdate = true;
    this.waterMesh.instanceMatrix.needsUpdate = true;
    if (this.landMesh.instanceColor) {
      this.landMesh.instanceColor.needsUpdate = true;
    }
    if (this.waterMesh.instanceColor) {
      this.waterMesh.instanceColor.needsUpdate = true;
    }
  }

  pickCellId(hitObject: unknown, instanceId: number) {
    if (hitObject === this.landMesh) {
      return this.landInstanceToCellId.get(instanceId) ?? null;
    }

    if (hitObject === this.waterMesh) {
      return this.waterInstanceToCellId.get(instanceId) ?? null;
    }

    return null;
  }

  dispose() {
    const landMaterial = this.landMesh.material;
    if (landMaterial instanceof MeshStandardMaterial) {
      landMaterial.dispose();
    }
    const waterMaterial = this.waterMesh.material;
    if (waterMaterial instanceof MeshStandardMaterial) {
      waterMaterial.dispose();
    }
  }
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

function setSurfaceInstanceTransform(
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
