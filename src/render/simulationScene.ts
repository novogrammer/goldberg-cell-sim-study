import {
  AmbientLight,
  BoxGeometry,
  Color,
  ConeGeometry,
  DirectionalLight,
  Group,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Raycaster,
  Scene,
  SphereGeometry,
  Vector2,
  Vector3,
  WebGPURenderer
} from "three/webgpu";
import { Inspector } from "three/addons/inspector/Inspector.js";

import { GoldbergCameraControls } from "./GoldbergCameraControls";
import {
  applyCellMaterial,
  colorForCell,
  roughnessForCell,
  type CellVisual
} from "./cellVisualAppearance";
import { getPackedSurfaceSphereRadius } from "./cellVisualGeometry";
import {
  TREE_INSTANCE_COUNT,
  WEED_INSTANCE_COUNT,
  createCellVegetationLayout,
  updateCellVegetationInstances,
  type CellVegetationLayout
} from "./cellVegetationAppearance";
import type { Cell, GoldbergMeshData } from "../types";

type AnimationLoopCallback = ((time: number, frame?: XRFrame) => void) | null;
const SURFACE_SPHERE_RADIUS_SCALE = 2;

type RenderCellVisual = CellVisual & {
  treeStartIndex: number;
  vegetationLayout: CellVegetationLayout;
  weedStartIndex: number;
};

export interface SimulationScene {
  renderer: WebGPURenderer;
  resize: () => void;
  render: () => void;
  setAnimationLoop: (callback: AnimationLoopCallback) => void;
  updateCells: (cells: Cell[]) => void;
  setAutoRotate: (enabled: boolean) => void;
  setControlsEnabled: (enabled: boolean) => void;
  getCameraPosition: () => [number, number, number];
  rotateCameraByPixels: (deltaX: number, deltaY: number) => void;
  zoomCameraByDelta: (deltaY: number) => void;
  pickCellAtClientPoint: (clientX: number, clientY: number) => number | null;
  setHoveredCell: (cellId: number | null) => void;
  setSelectedCell: (cellId: number | null) => void;
  dispose: () => void;
}

export function createSimulationScene(
  mount: HTMLElement,
  meshData: GoldbergMeshData,
  cells: Cell[]
): SimulationScene {
  const scene = new Scene();
  scene.background = new Color("#06131f");
  const raycaster = new Raycaster();
  const pointer = new Vector2();

  const camera = new PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 4.4);

  const renderer = new WebGPURenderer({ antialias: true });
  renderer.inspector = new Inspector();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.domElement.style.touchAction = "none";
  mount.appendChild(renderer.domElement);
  const controls = new GoldbergCameraControls(camera, renderer.domElement);

  const ambientLight = new AmbientLight("#ffffff", 1.2);
  const directionalLight = new DirectionalLight("#d6f0ff", 2.4);
  directionalLight.position.set(3, 2, 4);
  scene.add(ambientLight, directionalLight);

  const group = new Group();
  scene.add(group);

  const cellVisuals = new Map<number, RenderCellVisual>();
  let lastRenderTimestamp = performance.now();
  const surfaceSphereRadius =
    getPackedSurfaceSphereRadius(meshData) * SURFACE_SPHERE_RADIUS_SCALE;
  const surfaceSphereGeometry = new SphereGeometry(surfaceSphereRadius, 12, 10);
  const treeGeometry = new ConeGeometry(1, 1, 5);
  const weedGeometry = new BoxGeometry(1, 1, 0.2);
  const treeMaterial = new MeshStandardMaterial({
    color: "#ffffff",
    roughness: 0.88,
    metalness: 0.02
  });
  const weedMaterial = new MeshStandardMaterial({
    color: "#ffffff",
    roughness: 0.88,
    metalness: 0.02
  });
  const treeMesh = new InstancedMesh(
    treeGeometry,
    treeMaterial,
    meshData.geometry.faces.length * TREE_INSTANCE_COUNT
  );
  const weedMesh = new InstancedMesh(
    weedGeometry,
    weedMaterial,
    meshData.geometry.faces.length * WEED_INSTANCE_COUNT
  );
  treeMesh.count = meshData.geometry.faces.length * TREE_INSTANCE_COUNT;
  weedMesh.count = meshData.geometry.faces.length * WEED_INSTANCE_COUNT;
  group.add(treeMesh, weedMesh);

  for (const face of meshData.geometry.faces) {
    const cell = cells[face.cellId];
    const faceNormal = new Vector3(...face.normal).normalize();
    const vegetationLayout = createCellVegetationLayout(
      face,
      cell,
      surfaceSphereRadius * 2 + 0.012
    );
    const treeStartIndex = face.cellId * TREE_INSTANCE_COUNT;
    const weedStartIndex = face.cellId * WEED_INSTANCE_COUNT;
    const material = new MeshStandardMaterial({
      color: colorForCell(cell),
      roughness: roughnessForCell(cell),
      metalness: 0.08
    });
    const mesh = new Mesh(surfaceSphereGeometry, material);
    mesh.position
      .set(...face.center)
      .add(faceNormal.multiplyScalar(surfaceSphereRadius));
    mesh.userData.cellId = face.cellId;
    group.add(mesh);
    cellVisuals.set(face.cellId, {
      mesh,
      material,
      treeStartIndex,
      vegetationLayout,
      weedStartIndex
    });
    updateCellVegetationInstances(
      treeMesh,
      weedMesh,
      treeStartIndex,
      weedStartIndex,
      vegetationLayout,
      cell
    );
  }
  treeMesh.instanceMatrix.needsUpdate = true;
  weedMesh.instanceMatrix.needsUpdate = true;
  if (treeMesh.instanceColor) {
    treeMesh.instanceColor.needsUpdate = true;
  }
  if (weedMesh.instanceColor) {
    weedMesh.instanceColor.needsUpdate = true;
  }

  const resize = () => {
    const width = mount.clientWidth;
    const height = mount.clientHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  const updateCells = (nextCells: Cell[]) => {
    for (const cell of nextCells) {
      const visual = cellVisuals.get(cell.id);
      if (!visual) {
        continue;
      }
      applyCellMaterial(visual, cell);
      updateCellVegetationInstances(
        treeMesh,
        weedMesh,
        visual.treeStartIndex,
        visual.weedStartIndex,
        visual.vegetationLayout,
        cell
      );
    }
    treeMesh.instanceMatrix.needsUpdate = true;
    weedMesh.instanceMatrix.needsUpdate = true;
    if (treeMesh.instanceColor) {
      treeMesh.instanceColor.needsUpdate = true;
    }
    if (weedMesh.instanceColor) {
      weedMesh.instanceColor.needsUpdate = true;
    }
  };

  const setAutoRotate = (enabled: boolean) => {
    controls.setAutoRotate(enabled);
  };

  const setControlsEnabled = (enabled: boolean) => {
    controls.setEnabled(enabled);
  };

  const getCameraPosition = () => controls.getCameraPosition();
  const rotateCameraByPixels = (deltaX: number, deltaY: number) => controls.rotateByPointerDelta(deltaX, deltaY);
  const zoomCameraByDelta = (deltaY: number) => controls.zoomByWheelDelta(deltaY);

  const pickCellAtClientPoint = (clientX: number, clientY: number): number | null => {
    const rect = renderer.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return null;
    }

    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const intersections = raycaster.intersectObjects(
      Array.from(cellVisuals.values()).map((visual) => visual.mesh),
      false
    );

    const hit = intersections[0];
    if (!hit) {
      return null;
    }

    return typeof hit.object.userData.cellId === "number" ? hit.object.userData.cellId : null;
  };

  const setHoveredCell = (_cellId: number | null) => {};

  const setSelectedCell = (_cellId: number | null) => {};

  const render = () => {
    const now = performance.now();
    const deltaSeconds = Math.min(0.05, (now - lastRenderTimestamp) / 1000);
    lastRenderTimestamp = now;
    controls.update(deltaSeconds);
    renderer.render(scene, camera);
  };

  const setAnimationLoop = (callback: AnimationLoopCallback) => {
    renderer.setAnimationLoop(callback);
  };

  const dispose = () => {
    controls.dispose();
    for (const visual of cellVisuals.values()) {
      visual.material.dispose();
      if (visual.overlayMesh) {
        visual.overlayMesh.geometry.dispose();
        if (Array.isArray(visual.overlayMesh.material)) {
          for (const material of visual.overlayMesh.material) {
            material.dispose();
          }
        } else {
          visual.overlayMesh.material.dispose();
        }
      }
    }
    surfaceSphereGeometry.dispose();
    treeMaterial.dispose();
    weedMaterial.dispose();
    treeGeometry.dispose();
    weedGeometry.dispose();
    renderer.dispose();
    mount.removeChild(renderer.domElement);
  };

  resize();

  return {
    renderer,
    resize,
    render,
    setAnimationLoop,
    updateCells,
    setAutoRotate,
    setControlsEnabled,
    getCameraPosition,
    rotateCameraByPixels,
    zoomCameraByDelta,
    pickCellAtClientPoint,
    setHoveredCell,
    setSelectedCell,
    dispose
  };
}
