import {
  Color,
  InstancedMesh,
  Matrix4,
  Material,
  MeshBasicMaterial,
  Quaternion,
  SphereGeometry,
  Vector3
} from "three/webgpu";

import type { Cell, GoldbergMeshData } from "../types";
import {
  createLandSurfaceMaterial,
  createWaterSurfaceMaterial
} from "./surfaceCellMaterial";

const DEFAULT_SURFACE_RADIUS = 1;
const identityScale = new Vector3(1, 1, 1);
const tempSurfaceMatrix = new Matrix4();

export interface SurfaceCellInstanceData {
  normal: Vector3;
  sphereCenter: Vector3;
  surfaceRotation: Quaternion;
}

export class SurfaceCellInstances {
  readonly landMesh: InstancedMesh;
  readonly pickMesh: InstancedMesh;
  readonly waterMesh: InstancedMesh;

  constructor(surfaceSphereGeometry: SphereGeometry, maxCount: number) {
    const landSurfaceMaterial = createLandSurfaceMaterial();
    const pickSurfaceMaterial = new MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false
    });
    const waterSurfaceMaterial = createWaterSurfaceMaterial();

    this.landMesh = new InstancedMesh(
      surfaceSphereGeometry,
      landSurfaceMaterial,
      maxCount
    );
    this.pickMesh = new InstancedMesh(
      surfaceSphereGeometry,
      pickSurfaceMaterial,
      maxCount
    );
    this.waterMesh = new InstancedMesh(
      surfaceSphereGeometry,
      waterSurfaceMaterial,
      maxCount
    );
    this.landMesh.count = 0;
    this.pickMesh.count = maxCount;
    this.waterMesh.count = 0;
  }

  registerCell(cellId: number, visual: SurfaceCellInstanceData) {
    setSurfaceInstanceTransform(
      this.pickMesh,
      cellId,
      visual.sphereCenter,
      visual.surfaceRotation
    );
  }

  syncPackedInstances(
    cells: Cell[],
    getVisual: (cellId: number) => SurfaceCellInstanceData | undefined,
    getCellColor: (cell: Cell) => Color
  ) {
    let landPackedIndex = 0;
    let waterPackedIndex = 0;

    for (const cell of cells) {
      const visual = getVisual(cell.id);
      if (!visual) {
        continue;
      }

      const cellColor = getCellColor(cell);
      if (cell.terrainKind === "land") {
        setSurfaceInstanceTransform(
          this.landMesh,
          landPackedIndex,
          visual.sphereCenter,
          visual.surfaceRotation
        );
        this.landMesh.setColorAt(landPackedIndex, cellColor);
        landPackedIndex += 1;
        continue;
      }

      setSurfaceInstanceTransform(
        this.waterMesh,
        waterPackedIndex,
        visual.sphereCenter,
        visual.surfaceRotation
      );
      this.waterMesh.setColorAt(waterPackedIndex, cellColor);
      waterPackedIndex += 1;
    }

    this.landMesh.count = landPackedIndex;
    this.waterMesh.count = waterPackedIndex;
  }

  sync() {
    this.landMesh.instanceMatrix.needsUpdate = true;
    this.pickMesh.instanceMatrix.needsUpdate = true;
    this.waterMesh.instanceMatrix.needsUpdate = true;
    if (this.landMesh.instanceColor) {
      this.landMesh.instanceColor.needsUpdate = true;
    }
    if (this.waterMesh.instanceColor) {
      this.waterMesh.instanceColor.needsUpdate = true;
    }
  }

  pickCellId(hitObject: unknown, instanceId: number) {
    if (hitObject === this.pickMesh) {
      return instanceId;
    }

    return null;
  }

  dispose() {
    disposeMaterial(this.landMesh.material);
    disposeMaterial(this.pickMesh.material);
    disposeMaterial(this.waterMesh.material);
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
  surfaceRotation: Quaternion
) {
  tempSurfaceMatrix.compose(
    sphereCenter,
    surfaceRotation,
    identityScale
  );
  mesh.setMatrixAt(instanceId, tempSurfaceMatrix);
}

function disposeMaterial(material: Material | Material[]) {
  if (Array.isArray(material)) {
    for (const entry of material) {
      entry.dispose();
    }
    return;
  }

  material.dispose();
}
