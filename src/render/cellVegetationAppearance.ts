import {
  Color,
  Euler,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3
} from "three/webgpu";

import type { Cell, CellFaceGeometry } from "../types";

export interface VegetationIndicatorState {
  visibleTreeCount: number;
  heightScale: number;
  radiusScale: number;
  tint: Color;
}

export interface CellVegetationLayout {
  cellScale: number;
  position: Vector3;
  rotation: Quaternion;
  sizeUnit: number;
}

const SURFACE_LIFT = 0.102;
const PENTAGON_SCALE = 0.9;
const MIN_VEGETATION_THRESHOLD = 0.01;
const TREE_VEGETATION_THRESHOLD = 0.22;
const MAX_TREES = 5;
const localUp = new Vector3(0, 1, 0);
const hiddenScale = new Vector3(0, 0, 0);
const tempPosition = new Vector3();
const tempScale = new Vector3();
const tempWorldPosition = new Vector3();
const tempWorldQuaternion = new Quaternion();
const tempLocalQuaternion = new Quaternion();
const tempEuler = new Euler();
const tempMatrix = new Matrix4();

const TREE_LAYOUTS: ReadonlyArray<{ x: number; z: number }> = [
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

export const TREE_INSTANCE_COUNT = TREE_LAYOUTS.length;
export const WEED_INSTANCE_COUNT = WEED_LAYOUTS.length;

export interface VegetationSizeMetrics {
  baseHeight: number;
  baseRadius: number;
  layoutScale: number;
}

export function getVegetationIndicatorState(cell: Cell): VegetationIndicatorState {
  if (cell.terrainKind === "water" || cell.vegetation < MIN_VEGETATION_THRESHOLD) {
    return {
      visibleTreeCount: 0,
      heightScale: 0,
      radiusScale: 0,
      tint: new Color("#000000")
    };
  }

  const vegetation = Math.max(0, Math.min(1, cell.vegetation));
  const visibleTreeCount = Math.min(
    MAX_TREES,
    1 + Math.floor(
      Math.pow((vegetation - MIN_VEGETATION_THRESHOLD) / (1 - MIN_VEGETATION_THRESHOLD), 0.9) *
        (MAX_TREES - 0.0001)
    )
  );
  const vigor = Math.pow(vegetation, 0.72);

  return {
    visibleTreeCount,
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

export function createCellVegetationLayout(
  face: CellFaceGeometry,
  cell: Cell
): CellVegetationLayout {
  const normal = new Vector3(...face.normal).normalize();

  return {
    cellScale: cell.isPentagon ? PENTAGON_SCALE : 1,
    position: new Vector3(...face.center).add(normal.clone().multiplyScalar(SURFACE_LIFT)),
    rotation: new Quaternion().setFromUnitVectors(localUp, normal),
    sizeUnit: face.inradius
  };
}

function setHiddenInstance(mesh: InstancedMesh, index: number) {
  tempMatrix.compose(new Vector3(), new Quaternion(), hiddenScale);
  mesh.setMatrixAt(index, tempMatrix);
}

function setInstanceTransform(
  mesh: InstancedMesh,
  index: number,
  layout: CellVegetationLayout,
  localPosition: Vector3,
  localRotation: Quaternion,
  localScale: Vector3,
  tint: Color
) {
  tempWorldPosition
    .copy(localPosition)
    .multiplyScalar(layout.cellScale)
    .applyQuaternion(layout.rotation)
    .add(layout.position);
  tempWorldQuaternion.copy(layout.rotation).multiply(localRotation);
  tempScale.copy(localScale).multiplyScalar(layout.cellScale);
  tempMatrix.compose(tempWorldPosition, tempWorldQuaternion, tempScale);
  mesh.setMatrixAt(index, tempMatrix);
  mesh.setColorAt(index, tint);
}

export function updateCellVegetationInstances(
  treeMesh: InstancedMesh,
  weedMesh: InstancedMesh,
  treeStartIndex: number,
  weedStartIndex: number,
  layout: CellVegetationLayout,
  cell: Cell
) {
  const state = getVegetationIndicatorState(cell);
  const treeBaseHeight = layout.sizeUnit * 1.28;
  const treeBaseRadius = layout.sizeUnit * 0.22;
  const weedBaseHeight = layout.sizeUnit * 0.62;
  const weedBaseRadius = layout.sizeUnit * 0.05;
  const layoutScale = layout.sizeUnit * 1.18;

  for (let index = 0; index < TREE_INSTANCE_COUNT; index += 1) {
    const treeIndex = treeStartIndex + index;
    const isVisible =
      cell.vegetation >= TREE_VEGETATION_THRESHOLD && index < state.visibleTreeCount;

    if (!isVisible) {
      setHiddenInstance(treeMesh, treeIndex);
      continue;
    }

    const treeLayout = TREE_LAYOUTS[index];
    const height = treeBaseHeight * state.heightScale * (1 - index * 0.08);
    const radius = treeBaseRadius * state.radiusScale * (1 - index * 0.06);
    const yaw = Math.atan2(treeLayout.x, treeLayout.z);

    tempPosition.set(
      treeLayout.x * layoutScale,
      height * 0.5,
      treeLayout.z * layoutScale
    );
    tempLocalQuaternion.setFromEuler(tempEuler.set(0, yaw, 0));
    tempScale.set(radius, height, radius);

    setInstanceTransform(
      treeMesh,
      treeIndex,
      layout,
      tempPosition,
      tempLocalQuaternion,
      tempScale,
      state.tint
    );
  }

  const visibleWeedCount = Math.min(
    WEED_INSTANCE_COUNT,
    Math.max(2, state.visibleTreeCount * 2)
  );

  for (let index = 0; index < WEED_INSTANCE_COUNT; index += 1) {
    const weedIndex = weedStartIndex + index;
    const isVisible = index < visibleWeedCount;

    if (!isVisible) {
      setHiddenInstance(weedMesh, weedIndex);
      continue;
    }

    const weedLayout = WEED_LAYOUTS[index];
    const height = weedBaseHeight * state.heightScale * (1 - index * 0.035);
    const radius = weedBaseRadius * state.radiusScale * (1 - index * 0.03);
    const yaw = Math.atan2(weedLayout.x, weedLayout.z);
    const lean = 0.26 + index * 0.06;

    tempPosition.set(
      weedLayout.x * layoutScale,
      height * 0.5,
      weedLayout.z * layoutScale
    );
    tempLocalQuaternion.setFromEuler(
      tempEuler.set(Math.cos(yaw) * lean, yaw, -Math.sin(yaw) * lean)
    );
    tempScale.set(radius * 2, height, radius * 0.9);

    setInstanceTransform(
      weedMesh,
      weedIndex,
      layout,
      tempPosition,
      tempLocalQuaternion,
      tempScale,
      state.tint
    );
  }
}
