import {
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3
} from "three/webgpu";

import type { SurfaceCellInstanceData } from "./surfaceCellInstances";

const HOVER_CAP_SCALE = 1.004;
const SELECTED_CAP_SCALE = 1.005;
const HOVER_RING_THETA_START = Math.PI * 0.18;
const HOVER_RING_THETA_LENGTH = Math.PI * 0.22;
const SELECTED_RING_THETA_START = Math.PI * 0.18;
const SELECTED_RING_THETA_LENGTH = Math.PI * 0.22;

export class SurfaceSelectionOverlay {
  readonly hoverMesh: Mesh;
  readonly selectedMesh: Mesh;

  private hoveredCellId: number | null = null;
  private selectedCellId: number | null = null;
  private readonly selectionUp = new Vector3(0, 1, 0);
  private readonly selectionQuaternion = new Quaternion();

  constructor(surfaceSphereRadius: number) {
    const hoverGeometry = new SphereGeometry(
      surfaceSphereRadius * HOVER_CAP_SCALE,
      32,
      12,
      0,
      Math.PI * 2,
      HOVER_RING_THETA_START,
      HOVER_RING_THETA_LENGTH
    );
    const selectedGeometry = new SphereGeometry(
      surfaceSphereRadius * SELECTED_CAP_SCALE,
      32,
      12,
      0,
      Math.PI * 2,
      SELECTED_RING_THETA_START,
      SELECTED_RING_THETA_LENGTH
    );
    const hoverMaterial = new MeshStandardMaterial({
      color: "#e1ff8a",
      roughness: 0.32,
      metalness: 0.02
    });
    const selectedMaterial = new MeshStandardMaterial({
      color: "#fff3c4",
      roughness: 0.22,
      metalness: 0.04
    });

    this.hoverMesh = new Mesh(hoverGeometry, hoverMaterial);
    this.selectedMesh = new Mesh(selectedGeometry, selectedMaterial);
    this.hoverMesh.visible = false;
    this.selectedMesh.visible = false;
  }

  setHoveredCell(cellId: number | null, getVisual: (cellId: number) => SurfaceCellInstanceData | undefined) {
    if (this.hoveredCellId === cellId) {
      return;
    }

    this.hoveredCellId = cellId;
    this.update(getVisual);
  }

  setSelectedCell(cellId: number | null, getVisual: (cellId: number) => SurfaceCellInstanceData | undefined) {
    if (this.selectedCellId === cellId) {
      return;
    }

    this.selectedCellId = cellId;
    this.update(getVisual);
  }

  dispose() {
    this.disposeMesh(this.hoverMesh);
    this.disposeMesh(this.selectedMesh);
  }

  private update(getVisual: (cellId: number) => SurfaceCellInstanceData | undefined) {
    this.place(this.selectedMesh, this.selectedCellId, getVisual);
    this.place(
      this.hoverMesh,
      this.hoveredCellId !== this.selectedCellId ? this.hoveredCellId : null,
      getVisual
    );
  }

  private place(
    mesh: Mesh,
    cellId: number | null,
    getVisual: (cellId: number) => SurfaceCellInstanceData | undefined
  ) {
    if (cellId === null) {
      mesh.visible = false;
      return;
    }

    const visual = getVisual(cellId);
    if (!visual) {
      mesh.visible = false;
      return;
    }

    this.selectionQuaternion.setFromUnitVectors(this.selectionUp, visual.normal);
    mesh.position.copy(visual.sphereCenter);
    mesh.quaternion.copy(this.selectionQuaternion);
    mesh.visible = true;
  }

  private disposeMesh(mesh: Mesh) {
    mesh.geometry.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) {
      for (const entry of material) {
        entry.dispose();
      }
    } else {
      material.dispose();
    }
  }
}
