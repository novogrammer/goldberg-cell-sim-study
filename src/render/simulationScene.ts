import {
  AmbientLight,
  BoxGeometry,
  Color,
  ConeGeometry,
  DirectionalLight,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGPURenderer
} from "three/webgpu";
import { Inspector } from "three/addons/inspector/Inspector.js";

import { GoldbergCameraControls } from "./GoldbergCameraControls";
import {
  applyCellMaterial,
  applyOverlayState as applyCellOverlayState,
  colorForCell,
  roughnessForCell,
  type CellVisual
} from "./cellVisualAppearance";
import {
  createCellVisualGeometry,
  getTileBevelDrop
} from "./cellVisualGeometry";
import {
  createCellVegetationVisual,
  disposeCellVegetationVisual,
  updateCellVegetationVisual,
  type CellVegetationVisual
} from "./cellVegetationAppearance";
import type { Cell, GoldbergMeshData } from "../types";

type AnimationLoopCallback = ((time: number, frame?: XRFrame) => void) | null;
type RenderCellVisual = CellVisual & { vegetationVisual: CellVegetationVisual };

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
  let hoveredCellId: number | null = null;
  let selectedCellId: number | null = null;
  let lastRenderTimestamp = performance.now();
  const geometryVertices = meshData.geometry.vertices.map((vertex) => new Vector3(...vertex));
  const bevelDrop = getTileBevelDrop(meshData);
  const treeGeometry = new ConeGeometry(1, 1, 5);
  const weedGeometry = new BoxGeometry(1, 1, 0.2);

  const applyOverlayState = (cellId: number) => {
    applyCellOverlayState(cellVisuals.get(cellId), cellId, hoveredCellId, selectedCellId);
  };

  for (const face of meshData.geometry.faces) {
    const cell = cells[face.cellId];
    const polygonPoints = face.vertexIndices.map((vertexId) => geometryVertices[vertexId].clone());
    const faceNormal = new Vector3(...face.normal);
    const { tileGeometry, overlayGeometry } = createCellVisualGeometry(
      polygonPoints,
      faceNormal,
      face.circumradius,
      bevelDrop
    );
    const material = new MeshStandardMaterial({
      color: colorForCell(cell),
      roughness: roughnessForCell(cell),
      metalness: 0.08
    });
    const mesh = new Mesh(tileGeometry, material);
    mesh.userData.cellId = face.cellId;
    const overlayMaterial = new MeshBasicMaterial({
      color: "#fff2a8",
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false
    });
    overlayMaterial.visible = false;
    const overlayMesh = new Mesh(overlayGeometry, overlayMaterial);
    overlayMesh.renderOrder = 10;
    const vegetationVisual = createCellVegetationVisual(face, cell, treeGeometry, weedGeometry);

    mesh.add(overlayMesh);
    group.add(mesh);
    group.add(vegetationVisual.group);
    cellVisuals.set(face.cellId, { mesh, material, overlayMesh, vegetationVisual });
    applyOverlayState(face.cellId);
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
      updateCellVegetationVisual(visual.vegetationVisual, cell);
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

  const setHoveredCell = (cellId: number | null) => {
    const previous = hoveredCellId;
    hoveredCellId = cellId;
    if (previous !== null) {
      applyOverlayState(previous);
    }
    if (cellId !== null) {
      applyOverlayState(cellId);
    }
  };

  const setSelectedCell = (cellId: number | null) => {
    const previous = selectedCellId;
    selectedCellId = cellId;
    if (previous !== null) {
      applyOverlayState(previous);
    }
    if (cellId !== null) {
      applyOverlayState(cellId);
    }
  };

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
      visual.mesh.geometry.dispose();
      visual.material.dispose();
      disposeCellVegetationVisual(visual.vegetationVisual);
      visual.overlayMesh.geometry.dispose();
      if (Array.isArray(visual.overlayMesh.material)) {
        for (const material of visual.overlayMesh.material) {
          material.dispose();
        }
      } else {
        visual.overlayMesh.material.dispose();
      }
    }
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
