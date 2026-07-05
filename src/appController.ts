import type { AppState } from "./appState";
import { paintAtPickedPoint, toggleSelectedCell } from "./editor/planetEditor";
import type { SimulationView } from "./render/createSimulationView";
import type { GoldbergMeshData } from "./types";
import { DEFAULT_RULE_CONFIG, stepSimulation } from "./sim/simulation";
import { randomizeCellState } from "./sim/goldberg";
import { buildSelectedCellSummary } from "./ui/buildSelectedCellSummary";
import type { AppElements, HudState } from "./ui/types";
import { updateHud } from "./ui/updateHud";
import type { Cell } from "./types";

interface AppControllerOptions {
  elements: AppElements;
  initialState: AppState;
  meshData: Pick<GoldbergMeshData, "cells">;
  view: Pick<
    SimulationView,
    | "clearHoveredCell"
    | "getCameraPosition"
    | "pickCellAtClientPoint"
    | "render"
    | "rotateCameraByPixels"
    | "setAutoRotate"
    | "setControlsEnabled"
    | "setHoveredFromClientPoint"
    | "setSelectedCell"
    | "syncCameraImmediately"
    | "syncCells"
    | "zoomCameraByDelta"
    | "getInteractiveCanvasPoint"
  >;
  onAfterRender?: () => void;
}

export function createInitialAppState(cells: Cell[]): AppState {
  return {
    cells,
    speed: 6,
    pausedByUser: false,
    pausedByPaint: false,
    autoRotate: false,
    isPaintMode: false,
    brushTerrainKind: "land",
    lastPaintedCellId: null,
    lastTick: 0,
    selectedCellId: null
  };
}

export function buildAppHudState(appState: AppState): HudState {
  const isPlaying = !appState.pausedByUser && !appState.pausedByPaint;

  return {
    isPaintMode: appState.isPaintMode,
    isPlaying,
    autoRotate: appState.autoRotate,
    speed: appState.speed,
    brushTerrainKind: appState.brushTerrainKind,
    selectedCellSummary: buildSelectedCellSummary(appState.cells, appState.selectedCellId)
  };
}

export class AppController {
  private appState: AppState;

  constructor(
    private readonly options: AppControllerOptions
  ) {
    this.appState = { ...options.initialState };
    this.refreshHud();
  }

  refreshHud() {
    updateHud(this.options.elements, buildAppHudState(this.appState));
  }

  syncScene(nextCells: AppState["cells"]) {
    this.appState.cells = nextCells;
    this.options.view.syncCells(this.appState.cells);
    this.refreshHud();
  }

  setPaintMode(enabled: boolean) {
    this.appState.isPaintMode = enabled;
    this.appState.pausedByPaint = enabled;
    this.appState.lastPaintedCellId = null;
    this.options.view.setControlsEnabled(!enabled);
    this.refreshHud();
  }

  setBrushTerrainKind(terrainKind: Cell["terrainKind"]) {
    this.appState.brushTerrainKind = terrainKind;
    this.refreshHud();
  }

  onTogglePlay() {
    this.appState.pausedByUser = !this.appState.pausedByUser;
    this.refreshHud();
  }

  setPlaybackState(isPlaying: boolean) {
    this.appState.pausedByUser = !isPlaying;
    this.refreshHud();
  }

  onSetMode(mode: "view" | "paint") {
    this.setPaintMode(mode === "paint");
  }

  onToggleAutoRotate() {
    this.appState.autoRotate = !this.appState.autoRotate;
    this.options.view.setAutoRotate(this.appState.autoRotate);
    this.refreshHud();
  }

  setAutoRotateEnabled(enabled: boolean) {
    this.appState.autoRotate = enabled;
    this.options.view.setAutoRotate(enabled);
    this.refreshHud();
  }

  onStep() {
    this.syncScene(stepSimulation(this.appState.cells, DEFAULT_RULE_CONFIG));
  }

  onRandomize() {
    this.syncScene(randomizeCellState(this.options.meshData.cells, Math.random() * 1000));
  }

  onSetBrush(terrainKind: Cell["terrainKind"]) {
    this.setBrushTerrainKind(terrainKind);
  }

  onSetSpeed(nextSpeed: number) {
    this.appState.speed = nextSpeed;
    this.refreshHud();
  }

  onCanvasHover(clientX: number, clientY: number) {
    this.options.view.setHoveredFromClientPoint(clientX, clientY);
  }

  onCanvasLeave() {
    this.options.view.clearHoveredCell();
  }

  onCanvasPaintStart(clientX: number, clientY: number) {
    this.appState.lastPaintedCellId = null;
    this.paintAtClientPoint(clientX, clientY);
  }

  onCanvasPaintMove(clientX: number, clientY: number) {
    this.paintAtClientPoint(clientX, clientY);
  }

  onCanvasPaintEnd() {
    this.appState.lastPaintedCellId = null;
  }

  onCanvasSelect(clientX: number, clientY: number) {
    const pickedCellId = this.options.view.pickCellAtClientPoint(clientX, clientY);
    this.appState.selectedCellId = toggleSelectedCell(this.appState.selectedCellId, pickedCellId);
    this.options.view.setSelectedCell(this.appState.selectedCellId);
    this.refreshHud();
  }

  paintStroke(points: Array<{ x: number; y: number }>) {
    this.appState.lastPaintedCellId = null;
    for (const point of points) {
      this.paintAtClientPoint(point.x, point.y);
    }
    this.appState.lastPaintedCellId = null;
  }

  animate(timestamp: number) {
    const interval = 1000 / this.appState.speed;
    const isPlaying = !this.appState.pausedByUser && !this.appState.pausedByPaint;

    if (isPlaying && timestamp - this.appState.lastTick >= interval) {
      this.syncScene(stepSimulation(this.appState.cells, DEFAULT_RULE_CONFIG));
      this.appState.lastTick = timestamp;
    }

    this.options.view.render();
    this.options.onAfterRender?.();
  }

  getCameraPosition() {
    return this.options.view.getCameraPosition();
  }

  rotateCameraByPixels(deltaX: number, deltaY: number) {
    this.options.view.rotateCameraByPixels(deltaX, deltaY);
    this.options.view.syncCameraImmediately();
  }

  zoomCameraByDelta(deltaY: number) {
    this.options.view.zoomCameraByDelta(deltaY);
    this.options.view.syncCameraImmediately();
  }

  getInteractiveCanvasPoint() {
    return this.options.view.getInteractiveCanvasPoint();
  }

  getSelectedCellSummary() {
    return buildSelectedCellSummary(this.appState.cells, this.appState.selectedCellId);
  }

  getCellTerrainKind(cellId: number) {
    return this.appState.cells.find((cell) => cell.id === cellId)?.terrainKind ?? null;
  }

  private paintAtClientPoint(clientX: number, clientY: number) {
    const nextState = paintAtPickedPoint(
      {
        cells: this.appState.cells,
        selectedCellId: this.appState.selectedCellId,
        lastPaintedCellId: this.appState.lastPaintedCellId
      },
      this.appState.brushTerrainKind,
      this.options.view.pickCellAtClientPoint(clientX, clientY)
    );
    if (nextState.cells === this.appState.cells) {
      return;
    }

    this.appState.cells = nextState.cells;
    this.appState.selectedCellId = nextState.selectedCellId;
    this.appState.lastPaintedCellId = nextState.lastPaintedCellId;
    this.options.view.setSelectedCell(this.appState.selectedCellId);
    this.options.view.syncCells(this.appState.cells);
    this.refreshHud();
  }
}
