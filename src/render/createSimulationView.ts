import { findInteractiveCanvasPoint } from "../editor/findInteractiveCanvasPoint";
import type { Cell, GoldbergMeshData } from "../types";
import { createSimulationScene } from "./scene";

export interface SimulationView {
  canvasElement: HTMLCanvasElement;
  resize: () => void;
  render: () => void;
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
  zoomCameraByDelta: (deltaY: number) => void;
  getInteractiveCanvasPoint: () => { x: number; y: number; cellId: number } | null;
}

export function createSimulationView(
  mount: HTMLElement,
  meshData: GoldbergMeshData,
  cells: Cell[]
): SimulationView {
  const scene = createSimulationScene(mount, meshData, cells);
  const canvasElement = scene.renderer.domElement;

  return {
    canvasElement,
    resize: () => scene.resize(),
    render: () => scene.render(),
    dispose: () => scene.dispose(),
    syncCells: (nextCells) => scene.updateCells(nextCells),
    setAutoRotate: (enabled) => scene.setAutoRotate(enabled),
    setControlsEnabled: (enabled) => scene.setControlsEnabled(enabled),
    setHoveredFromClientPoint: (clientX, clientY) => {
      scene.setHoveredCell(scene.pickCellAtClientPoint(clientX, clientY));
    },
    clearHoveredCell: () => scene.setHoveredCell(null),
    setSelectedCell: (cellId) => scene.setSelectedCell(cellId),
    pickCellAtClientPoint: (clientX, clientY) => scene.pickCellAtClientPoint(clientX, clientY),
    getCameraPosition: () => scene.getCameraPosition(),
    rotateCameraByPixels: (deltaX, deltaY) => scene.rotateCameraByPixels(deltaX, deltaY),
    zoomCameraByDelta: (deltaY) => scene.zoomCameraByDelta(deltaY),
    getInteractiveCanvasPoint: () => findInteractiveCanvasPoint(
      canvasElement,
      scene.pickCellAtClientPoint
    )
  };
}
