import {
  BoxGeometry,
  ConeGeometry,
  Color,
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
  weeds: Mesh[];
  sizeUnit: number;
}

const SURFACE_LIFT = 0.102;
const PENTAGON_SCALE = 0.9;
const MIN_VEGETATION_THRESHOLD = 0.01;
const SPROUT_VEGETATION_THRESHOLD = 0.22;
const MAX_SPROUTS = 5;
const localUp = new Vector3(0, 1, 0);

const SPROUT_LAYOUTS: ReadonlyArray<{ x: number; z: number }> = [
  { x: 0, z: 0 },
  { x: 0.4, z: 0.2 },
  { x: -0.37, z: 0.26 },
  { x: 0.2, z: -0.4 },
  { x: -0.28, z: -0.34 }
];

const WEED_LAYOUTS: ReadonlyArray<{ x: number; z: number }> = [
  { x: 0.34, z: 0.12 },
  { x: -0.38, z: 0.26 },
  { x: 0.4, z: -0.22 },
  { x: -0.18, z: -0.42 },
  { x: 0.02, z: 0.44 },
  { x: 0.52, z: 0.18 },
  { x: -0.5, z: 0.04 },
  { x: 0.14, z: -0.54 },
  { x: -0.34, z: -0.46 }
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
  sproutGeometry: ConeGeometry,
  weedGeometry: BoxGeometry
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

  const weeds = WEED_LAYOUTS.map(({ x, z }) => {
    const weed = new Mesh(weedGeometry, material);
    weed.position.set(
      x * sizeMetrics.layoutScale,
      0,
      z * sizeMetrics.layoutScale
    );
    group.add(weed);
    return weed;
  });

  const visual = { group, material, sprouts, weeds, sizeUnit: face.inradius };
  updateCellVegetationVisual(visual, cell);
  return visual;
}

export function updateCellVegetationVisual(visual: CellVegetationVisual, cell: Cell) {
  const state = getVegetationIndicatorState(cell);
  visual.material.color.copy(state.tint);
  visual.group.visible = state.visibleSproutCount > 0;
  const sproutBaseHeight = visual.sizeUnit * 1.28;
  const sproutBaseRadius = visual.sizeUnit * 0.22;
  const weedBaseHeight = visual.sizeUnit * 0.62;
  const weedBaseRadius = visual.sizeUnit * 0.05;
  const layoutScale = visual.sizeUnit * 1.18;

  for (let index = 0; index < visual.sprouts.length; index += 1) {
    const sprout = visual.sprouts[index];
    const layout = SPROUT_LAYOUTS[index];
    const isVisible = cell.vegetation >= SPROUT_VEGETATION_THRESHOLD && index < state.visibleSproutCount;
    sprout.visible = isVisible;
    if (!isVisible) {
      continue;
    }

    const height = sproutBaseHeight * state.heightScale * (1 - index * 0.08);
    const radius = sproutBaseRadius * state.radiusScale * (1 - index * 0.06);
    const yaw = Math.atan2(layout.x, layout.z);
    sprout.position.set(
      layout.x * layoutScale,
      height * 0.5,
      layout.z * layoutScale
    );
    sprout.scale.set(radius, height, radius);
    sprout.rotation.set(0, yaw, 0);
  }

  for (let index = 0; index < visual.weeds.length; index += 1) {
    const weed = visual.weeds[index];
    const layout = WEED_LAYOUTS[index];
    const visibleWeedCount = Math.min(
      visual.weeds.length,
      Math.max(2, state.visibleSproutCount * 2)
    );
    const isVisible = index < visibleWeedCount;
    weed.visible = isVisible;
    if (!isVisible) {
      continue;
    }

    const height = weedBaseHeight * state.heightScale * (1 - index * 0.035);
    const radius = weedBaseRadius * state.radiusScale * (1 - index * 0.03);
    const yaw = Math.atan2(layout.x, layout.z);
    const lean = 0.26 + index * 0.06;
    weed.position.set(
      layout.x * layoutScale,
      height * 0.5,
      layout.z * layoutScale
    );
    weed.scale.set(radius * 2, height, radius * 0.9);
    weed.rotation.set(Math.cos(yaw) * lean, yaw, -Math.sin(yaw) * lean);
  }
}

export function disposeCellVegetationVisual(visual: CellVegetationVisual) {
  visual.material.dispose();
}
