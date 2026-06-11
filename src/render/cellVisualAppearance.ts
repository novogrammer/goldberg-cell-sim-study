import {
  Color,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial
} from "three/webgpu";

import type { Cell } from "../types";

export interface CellVisual {
  mesh: Mesh;
  material: MeshStandardMaterial;
  overlayMesh?: Mesh;
}

const HOVER_COLOR = "#fff2a8";
const SELECTED_COLOR = "#ffffff";
const HOVER_OPACITY = 0.42;
const SELECTED_OPACITY = 0.82;

export function colorForCell(cell: Cell): Color {
  if (cell.terrainKind === "water") {
    return new Color("#1d5ca8");
  }

  const barren = new Color("#8f6d37");
  const fertile = new Color("#6bbf4e");
  const moistureTint = new Color("#5f8fc8");
  const vegetationBlend = Math.pow(cell.vegetation, 0.78);
  const baseColor = barren.lerp(fertile, vegetationBlend);
  const moistureBlend = Math.pow(cell.moisture, 0.85) * 0.5;
  return baseColor.lerp(moistureTint, moistureBlend);
}

export function roughnessForCell(cell: Cell): number {
  if (cell.terrainKind === "water") {
    return 0.15;
  }

  return Math.max(0.38, Math.min(0.92, 0.92 - cell.moisture * 0.47));
}

export function applyCellMaterial(visual: CellVisual, cell: Cell) {
  visual.material.color.copy(colorForCell(cell));
  visual.material.roughness = roughnessForCell(cell);
}

export function applyOverlayState(
  visual: CellVisual | undefined,
  cellId: number,
  hoveredCellId: number | null,
  selectedCellId: number | null
) {
  if (!visual) {
    return;
  }

  if (!visual.overlayMesh) {
    return;
  }

  const overlayMaterial = visual.overlayMesh.material;
  if (!(overlayMaterial instanceof MeshBasicMaterial)) {
    return;
  }

  if (cellId === selectedCellId) {
    overlayMaterial.visible = true;
    overlayMaterial.color.set(SELECTED_COLOR);
    overlayMaterial.opacity = SELECTED_OPACITY;
    return;
  }

  if (cellId === hoveredCellId) {
    overlayMaterial.visible = true;
    overlayMaterial.color.set(HOVER_COLOR);
    overlayMaterial.opacity = HOVER_OPACITY;
    return;
  }

  overlayMaterial.visible = false;
  overlayMaterial.opacity = 0;
}
