import {
  Color,
  ConeGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Vector3
} from "three/webgpu";

import type { Cell, CellFaceGeometry } from "../types";

export interface VegetationIndicatorState {
  visibleSproutCount: number;
  heightScale: number;
  radiusScale: number;
  tint: Color;
}

export interface CellVegetationVisual {
  group: Group;
  material: MeshStandardMaterial;
  sprouts: Mesh[];
  sizeUnit: number;
}

const SURFACE_LIFT = 0.102;
const PENTAGON_SCALE = 0.9;
const MIN_VEGETATION_THRESHOLD = 0.14;
const MAX_SPROUTS = 4;
const localUp = new Vector3(0, 1, 0);

const SPROUT_LAYOUTS: ReadonlyArray<{ x: number; z: number }> = [
  { x: 0, z: 0 },
  { x: 0.4, z: 0.2 },
  { x: -0.37, z: 0.26 },
  { x: 0.2, z: -0.4 },
  { x: -0.28, z: -0.34 }
];

export interface VegetationSizeMetrics {
  baseHeight: number;
  baseRadius: number;
  layoutScale: number;
}

export function getVegetationIndicatorState(cell: Cell): VegetationIndicatorState {
  if (cell.terrainKind === "water" || cell.vegetation < MIN_VEGETATION_THRESHOLD) {
    return {
      visibleSproutCount: 0,
      heightScale: 0,
      radiusScale: 0,
      tint: new Color("#000000")
    };
  }

  const vegetation = Math.max(0, Math.min(1, cell.vegetation));
  const visibleSproutCount = Math.min(
    MAX_SPROUTS,
    1 + Math.floor(Math.pow((vegetation - MIN_VEGETATION_THRESHOLD) / (1 - MIN_VEGETATION_THRESHOLD), 0.9) * (MAX_SPROUTS - 0.0001))
  );
  const vigor = Math.pow(vegetation, 0.72);

  return {
    visibleSproutCount,
    heightScale: 0.48 + vigor * 0.78,
    radiusScale: 0.62 + vigor * 0.36,
    tint: new Color("#698a49").lerp(new Color("#6acb72"), vigor * 0.9)
  };
}

export function getVegetationSizeMetrics(face: CellFaceGeometry): VegetationSizeMetrics {
  return {
    baseHeight: face.inradius * 1.45,
    baseRadius: face.inradius * 0.28,
    layoutScale: face.inradius * 0.92
  };
}

export function createCellVegetationVisual(
  face: CellFaceGeometry,
  cell: Cell,
  sproutGeometry: ConeGeometry
): CellVegetationVisual {
  const material = new MeshStandardMaterial({
    color: "#6d8f45",
    roughness: 0.88,
    metalness: 0.02
  });
  const group = new Group();
  const normal = new Vector3(...face.normal).normalize();
  const cellScale = cell.isPentagon ? PENTAGON_SCALE : 1;
  const sizeMetrics = getVegetationSizeMetrics(face);
  group.position
    .set(...face.center)
    .add(normal.clone().multiplyScalar(SURFACE_LIFT));
  group.quaternion.copy(new Quaternion().setFromUnitVectors(localUp, normal));
  group.scale.setScalar(cellScale);

  const sprouts = SPROUT_LAYOUTS.map(({ x, z }) => {
    const sprout = new Mesh(sproutGeometry, material);
    sprout.position.set(
      x * sizeMetrics.layoutScale,
      0,
      z * sizeMetrics.layoutScale
    );
    group.add(sprout);
    return sprout;
  });

  const visual = { group, material, sprouts, sizeUnit: face.inradius };
  updateCellVegetationVisual(visual, cell);
  return visual;
}

export function updateCellVegetationVisual(visual: CellVegetationVisual, cell: Cell) {
  const state = getVegetationIndicatorState(cell);
  visual.material.color.copy(state.tint);
  visual.group.visible = state.visibleSproutCount > 0;
  const baseHeight = visual.sizeUnit * 1.45;
  const baseRadius = visual.sizeUnit * 0.28;
  const layoutScale = visual.sizeUnit * 0.92;

  for (let index = 0; index < visual.sprouts.length; index += 1) {
    const sprout = visual.sprouts[index];
    const layout = SPROUT_LAYOUTS[index];
    const isVisible = index < state.visibleSproutCount;
    sprout.visible = isVisible;
    if (!isVisible) {
      continue;
    }

    const height = baseHeight * state.heightScale * (1 - index * 0.08);
    const radius = baseRadius * state.radiusScale * (1 - index * 0.06);
    sprout.position.set(
      layout.x * layoutScale,
      height * 0.5,
      layout.z * layoutScale
    );
    sprout.scale.set(radius, height, radius);
  }
}

export function disposeCellVegetationVisual(visual: CellVegetationVisual) {
  visual.material.dispose();
}
