import {
  AmbientLight,
  BoxGeometry,
  Color,
  ConeGeometry,
  DirectionalLight,
  Group,
  InstancedMesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Quaternion,
  Raycaster,
  Scene,
  SphereGeometry,
  Vector2,
  Vector3,
  WebGPURenderer
} from "three/webgpu";
import { Inspector } from "three/addons/inspector/Inspector.js";

import { GoldbergCameraControls } from "./GoldbergCameraControls";
import { colorForCell } from "./cellVisualAppearance";
import {
  TREE_INSTANCE_COUNT,
  WEED_INSTANCE_COUNT,
  createCellVegetationLayout,
  updateCellVegetationInstances,
  type CellVegetationLayout
} from "./cellVegetationAppearance";
import {
  getPackedSurfaceSphereRadius,
  SurfaceCellInstances,
  type SurfaceCellInstanceData
} from "./surfaceCellInstances";
import { SurfaceSelectionOverlay } from "./surfaceSelectionOverlay";
import type { Cell, GoldbergMeshData } from "../types";

type AnimationLoopCallback = ((time: number, frame?: XRFrame) => void) | null;
const SURFACE_SPHERE_RADIUS_SCALE = 2;

type RenderCellVisual = SurfaceCellInstanceData & {
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

class SimulationSceneController implements SimulationScene {
  readonly renderer: WebGPURenderer;

  private readonly camera: PerspectiveCamera;
  private readonly cellVisuals = new Map<number, RenderCellVisual>();
  private readonly controls: GoldbergCameraControls;
  private readonly mount: HTMLElement;
  private readonly pointer = new Vector2();
  private readonly raycaster = new Raycaster();
  private readonly scene = new Scene();
  private readonly selectionOverlay: SurfaceSelectionOverlay;
  private readonly surfaceCellInstances: SurfaceCellInstances;
  private readonly surfaceSphereGeometry: SphereGeometry;
  private readonly treeGeometry: ConeGeometry;
  private readonly treeMaterial: MeshStandardMaterial;
  private readonly treeMesh: InstancedMesh;
  private readonly weedGeometry: BoxGeometry;
  private readonly weedMaterial: MeshStandardMaterial;
  private readonly weedMesh: InstancedMesh;
  private lastRenderTimestamp = performance.now();

  constructor(
    mount: HTMLElement,
    meshData: GoldbergMeshData,
    cells: Cell[]
  ) {
    this.mount = mount;
    this.scene.background = new Color("#06131f");

    this.camera = new PerspectiveCamera(45, 1, 0.1, 100);
    this.camera.position.set(0, 0, 4.4);

    this.renderer = new WebGPURenderer({ antialias: true });
    this.renderer.inspector = new Inspector();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.domElement.style.touchAction = "none";
    mount.appendChild(this.renderer.domElement);
    this.controls = new GoldbergCameraControls(this.camera, this.renderer.domElement);

    const ambientLight = new AmbientLight("#ffffff", 1.2);
    const directionalLight = new DirectionalLight("#d6f0ff", 2.4);
    directionalLight.position.set(3, 2, 4);
    this.scene.add(ambientLight, directionalLight);

    const group = new Group();
    this.scene.add(group);

    const surfaceSphereRadius =
      getPackedSurfaceSphereRadius(meshData) * SURFACE_SPHERE_RADIUS_SCALE;
    this.surfaceSphereGeometry = new SphereGeometry(
      surfaceSphereRadius,
      32,
      16,
      0,
      Math.PI * 2,
      0,
      Math.PI / 2
    );
    this.treeGeometry = new ConeGeometry(1, 1, 5);
    this.weedGeometry = new BoxGeometry(1, 1, 0.2);
    this.treeMaterial = new MeshStandardMaterial({
      color: "#ffffff",
      roughness: 0.88,
      metalness: 0.02
    });
    this.weedMaterial = new MeshStandardMaterial({
      color: "#ffffff",
      roughness: 0.88,
      metalness: 0.02
    });
    this.surfaceCellInstances = new SurfaceCellInstances(
      this.surfaceSphereGeometry,
      meshData.geometry.faces.length
    );
    this.treeMesh = new InstancedMesh(
      this.treeGeometry,
      this.treeMaterial,
      meshData.geometry.faces.length * TREE_INSTANCE_COUNT
    );
    this.weedMesh = new InstancedMesh(
      this.weedGeometry,
      this.weedMaterial,
      meshData.geometry.faces.length * WEED_INSTANCE_COUNT
    );
    this.selectionOverlay = new SurfaceSelectionOverlay(surfaceSphereRadius);
    this.treeMesh.count = meshData.geometry.faces.length * TREE_INSTANCE_COUNT;
    this.weedMesh.count = meshData.geometry.faces.length * WEED_INSTANCE_COUNT;
    group.add(
      this.surfaceCellInstances.landMesh,
      this.surfaceCellInstances.waterMesh,
      this.treeMesh,
      this.weedMesh,
      this.selectionOverlay.hoverMesh,
      this.selectionOverlay.selectedMesh
    );

    for (const face of meshData.geometry.faces) {
      const cell = cells[face.cellId];
      const faceNormal = new Vector3(...face.normal).normalize();
      const vegetationLayout = createCellVegetationLayout(
        face,
        cell,
        surfaceSphereRadius * 2 + 0.012
      );
      const cellColor = colorForCell(cell);
      const instanceRotation = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), faceNormal);
      const landInstanceId = face.cellId;
      const treeStartIndex = face.cellId * TREE_INSTANCE_COUNT;
      const waterInstanceId = face.cellId;
      const weedStartIndex = face.cellId * WEED_INSTANCE_COUNT;
      const sphereCenter = new Vector3(...face.center).add(
        faceNormal.clone().multiplyScalar(surfaceSphereRadius)
      );
      const visual: RenderCellVisual = {
        landInstanceId,
        normal: faceNormal.clone(),
        surfaceRotation: instanceRotation.clone(),
        sphereCenter,
        treeStartIndex,
        vegetationLayout,
        waterInstanceId,
        weedStartIndex
      };
      this.surfaceCellInstances.registerCell(face.cellId, visual);
      this.surfaceCellInstances.applyCellState(
        visual,
        cell.terrainKind,
        cellColor
      );
      this.cellVisuals.set(face.cellId, visual);
      updateCellVegetationInstances(
        this.treeMesh,
        this.weedMesh,
        treeStartIndex,
        weedStartIndex,
        vegetationLayout,
        cell
      );
    }
    this.surfaceCellInstances.sync();
    this.syncVegetationInstances();
    this.resize();
  }

  resize() {
    const width = this.mount.clientWidth;
    const height = this.mount.clientHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  render() {
    const now = performance.now();
    const deltaSeconds = Math.min(0.05, (now - this.lastRenderTimestamp) / 1000);
    this.lastRenderTimestamp = now;
    this.controls.update(deltaSeconds);
    this.renderer.render(this.scene, this.camera);
  }

  setAnimationLoop(callback: AnimationLoopCallback) {
    this.renderer.setAnimationLoop(callback);
  }

  updateCells(cells: Cell[]) {
    for (const cell of cells) {
      const visual = this.cellVisuals.get(cell.id);
      if (!visual) {
        continue;
      }
      this.surfaceCellInstances.applyCellState(
        visual,
        cell.terrainKind,
        colorForCell(cell)
      );
      updateCellVegetationInstances(
        this.treeMesh,
        this.weedMesh,
        visual.treeStartIndex,
        visual.weedStartIndex,
        visual.vegetationLayout,
        cell
      );
    }
    this.surfaceCellInstances.sync();
    this.syncVegetationInstances();
  }

  setAutoRotate(enabled: boolean) {
    this.controls.setAutoRotate(enabled);
  }

  setControlsEnabled(enabled: boolean) {
    this.controls.setEnabled(enabled);
  }

  getCameraPosition() {
    return this.controls.getCameraPosition();
  }

  rotateCameraByPixels(deltaX: number, deltaY: number) {
    this.controls.rotateByPointerDelta(deltaX, deltaY);
  }

  zoomCameraByDelta(deltaY: number) {
    this.controls.zoomByWheelDelta(deltaY);
  }

  pickCellAtClientPoint(clientX: number, clientY: number): number | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return null;
    }

    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersections = this.raycaster.intersectObjects(
      [this.surfaceCellInstances.landMesh, this.surfaceCellInstances.waterMesh],
      false
    );

    const hit = intersections[0];
    if (!hit || typeof hit.instanceId !== "number") {
      return null;
    }

    return this.surfaceCellInstances.pickCellId(hit.object, hit.instanceId);
  }

  setHoveredCell(cellId: number | null) {
    this.selectionOverlay.setHoveredCell(cellId, (id) => this.cellVisuals.get(id));
  }

  setSelectedCell(cellId: number | null) {
    this.selectionOverlay.setSelectedCell(cellId, (id) => this.cellVisuals.get(id));
  }

  dispose() {
    this.controls.dispose();
    this.surfaceCellInstances.dispose();
    this.selectionOverlay.dispose();
    this.surfaceSphereGeometry.dispose();
    this.treeMaterial.dispose();
    this.weedMaterial.dispose();
    this.treeGeometry.dispose();
    this.weedGeometry.dispose();
    this.renderer.dispose();
    this.mount.removeChild(this.renderer.domElement);
  }

  private syncVegetationInstances() {
    this.treeMesh.instanceMatrix.needsUpdate = true;
    this.weedMesh.instanceMatrix.needsUpdate = true;
    if (this.treeMesh.instanceColor) {
      this.treeMesh.instanceColor.needsUpdate = true;
    }
    if (this.weedMesh.instanceColor) {
      this.weedMesh.instanceColor.needsUpdate = true;
    }
  }
}

export function createSimulationScene(
  mount: HTMLElement,
  meshData: GoldbergMeshData,
  cells: Cell[]
): SimulationScene {
  return new SimulationSceneController(mount, meshData, cells);
}
