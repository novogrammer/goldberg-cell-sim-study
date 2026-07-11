import { findInteractiveCanvasPoint } from "../editor/findInteractiveCanvasPoint";
import type { Cell, GoldbergMeshData } from "../types";
import { createSimulationScene, type SimulationScene } from "./simulationScene";

interface SimulationView {
  canvasElement: HTMLCanvasElement;
  resize: () => void;
  render: () => void;
  setAnimationLoop: (callback: ((time: number, frame?: XRFrame) => void) | null) => void;
  dispose: () => void;
  syncCells: (cells: Cell[]) => void;
  setAutoRotate: (enabled: boolean) => void;
  setControlsEnabled: (enabled: boolean) => void;
  setHoveredFromClientPoint: (clientX: number, clientY: number) => void;
  clearHoveredCell: () => void;
  setSelectedCell: (cellId: number | null) => void;
  pickCellAtClientPoint: (clientX: number, clientY: number) => number | null;
  getCameraPosition: () => [number, number, number];
  rotateCameraByPixels: (deltaX: number, deltaY: number) => void;
  setCameraDragging: (isDragging: boolean) => void;
  zoomCameraByDelta: (deltaY: number) => void;
  syncCameraImmediately: () => void;
  getInteractiveCanvasPoint: () => { x: number; y: number; cellId: number } | null;
}

class SimulationViewAdapter implements SimulationView {
  readonly canvasElement: HTMLCanvasElement;

  constructor(private readonly scene: SimulationScene) {
    this.canvasElement = scene.renderer.domElement;
  }

  resize() {
    this.scene.resize();
  }

  render() {
    this.scene.render();
  }

  setAnimationLoop(callback: ((time: number, frame?: XRFrame) => void) | null) {
    this.scene.setAnimationLoop(callback);
  }

  dispose() {
    this.scene.dispose();
  }

  syncCells(cells: Cell[]) {
    this.scene.updateCells(cells);
  }

  setAutoRotate(enabled: boolean) {
    this.scene.setAutoRotate(enabled);
  }

  setControlsEnabled(enabled: boolean) {
    this.scene.setControlsEnabled(enabled);
  }

  setHoveredFromClientPoint(clientX: number, clientY: number) {
    this.scene.setHoveredCell(this.scene.pickCellAtClientPoint(clientX, clientY));
  }

  clearHoveredCell() {
    this.scene.setHoveredCell(null);
  }

  setSelectedCell(cellId: number | null) {
    this.scene.setSelectedCell(cellId);
  }

  pickCellAtClientPoint(clientX: number, clientY: number) {
    return this.scene.pickCellAtClientPoint(clientX, clientY);
  }

  getCameraPosition() {
    return this.scene.getCameraPosition();
  }

  rotateCameraByPixels(deltaX: number, deltaY: number) {
    this.scene.rotateCameraByPixels(deltaX, deltaY);
  }

  setCameraDragging(isDragging: boolean) {
    this.scene.setCameraDragging(isDragging);
  }

  zoomCameraByDelta(deltaY: number) {
    this.scene.zoomCameraByDelta(deltaY);
  }

  syncCameraImmediately() {
    this.scene.syncCameraImmediately();
  }

  getInteractiveCanvasPoint() {
    return findInteractiveCanvasPoint(
      this.canvasElement,
      this.scene.pickCellAtClientPoint.bind(this.scene)
    );
  }
}

export function createSimulationView(
  mount: HTMLElement,
  meshData: GoldbergMeshData,
  cells: Cell[]
): SimulationView {
  return new SimulationViewAdapter(createSimulationScene(mount, meshData, cells));
}
