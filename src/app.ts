import "./style.css";

import type { AppState } from "./appState";
import { paintAtPickedPoint, toggleSelectedCell } from "./editor/planetEditor";
import { createSimulationView } from "./render/createSimulationView";
import { createGoldbergMesh, randomizeCellState } from "./sim/goldberg";
import { DEFAULT_RULE_CONFIG, stepSimulation } from "./sim/simulation";
import type { Cell } from "./types";
import { bindAppEvents } from "./ui/bindAppEvents";
import { buildSelectedCellSummary } from "./ui/buildSelectedCellSummary";
import { createAppLayout } from "./ui/createAppLayout";
import type { HudState } from "./ui/types";
import { updateHud } from "./ui/updateHud";

const DISPLAY_FREQUENCY = 10;

declare global {
  interface Window {
    __goldbergTestState?: {
      getCameraPosition: () => [number, number, number];
      rotateCameraByPixels: (deltaX: number, deltaY: number) => void;
      zoomCameraByDelta: (deltaY: number) => void;
      getInteractiveCanvasPoint: () => { x: number; y: number; cellId: number } | null;
      setPaintMode: (enabled: boolean) => void;
      setBrushTerrainKind: (terrainKind: Cell["terrainKind"]) => void;
      paintStroke: (points: Array<{ x: number; y: number }>) => void;
      getSelectedCellSummary: () => ReturnType<typeof buildSelectedCellSummary>;
      getCellTerrainKind: (cellId: number) => Cell["terrainKind"] | null;
    };
  }
}

class AppController {
  private readonly appState: AppState;
  private readonly cleanupEvents: () => void;
  private readonly elements: ReturnType<typeof createAppLayout>;
  private readonly meshData = createGoldbergMesh(DISPLAY_FREQUENCY);
  private readonly view: ReturnType<typeof createSimulationView>;
  private isDisposed = false;

  constructor(root: HTMLElement) {
    this.appState = {
      cells: randomizeCellState(this.meshData.cells),
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

    this.elements = createAppLayout(root, {
      cellCount: this.appState.cells.length,
      pentagonCount: this.meshData.pentagonCount,
      hexagonCount: this.meshData.hexagonCount,
      frequency: this.meshData.frequency,
      speed: this.appState.speed
    }, this.buildHudState());

    this.view = createSimulationView(
      this.elements.viewport,
      this.meshData,
      this.appState.cells
    );
    this.view.setAutoRotate(this.appState.autoRotate);
    this.cleanupEvents = bindAppEvents(
      this.elements,
      this.view.canvasElement,
      this.buildEventHandlers()
    );
    this.installTestState();
    this.refreshHud();
    this.view.setAnimationLoop(this.animate.bind(this));
  }

  dispose() {
    if (this.isDisposed) {
      return;
    }

    this.isDisposed = true;
    this.view.setAnimationLoop(null);
    this.cleanupEvents();
    delete window.__goldbergTestState;
    this.view.dispose();
  }

  private buildHudState(): HudState {
    const isPlaying = !this.appState.pausedByUser && !this.appState.pausedByPaint;

    return {
      isPaintMode: this.appState.isPaintMode,
      isPlaying,
      autoRotate: this.appState.autoRotate,
      speed: this.appState.speed,
      brushTerrainKind: this.appState.brushTerrainKind,
      selectedCellSummary: buildSelectedCellSummary(
        this.appState.cells,
        this.appState.selectedCellId
      )
    };
  }

  private refreshHud() {
    updateHud(this.elements, this.buildHudState());
  }

  private syncScene(nextCells: AppState["cells"]) {
    this.appState.cells = nextCells;
    this.view.syncCells(this.appState.cells);
    this.refreshHud();
  }

  private setPaintMode(enabled: boolean) {
    this.appState.isPaintMode = enabled;
    this.appState.pausedByPaint = enabled;
    this.appState.lastPaintedCellId = null;
    this.view.setControlsEnabled(!enabled);
    this.refreshHud();
  }

  private setBrushTerrainKind(terrainKind: Cell["terrainKind"]) {
    this.appState.brushTerrainKind = terrainKind;
    this.refreshHud();
  }

  private paintAtClientPoint(clientX: number, clientY: number) {
    const nextState = paintAtPickedPoint(
      {
        cells: this.appState.cells,
        selectedCellId: this.appState.selectedCellId,
        lastPaintedCellId: this.appState.lastPaintedCellId
      },
      this.appState.brushTerrainKind,
      this.view.pickCellAtClientPoint(clientX, clientY)
    );
    if (nextState.cells === this.appState.cells) {
      return;
    }

    this.appState.cells = nextState.cells;
    this.appState.selectedCellId = nextState.selectedCellId;
    this.appState.lastPaintedCellId = nextState.lastPaintedCellId;
    this.view.setSelectedCell(this.appState.selectedCellId);
    this.view.syncCells(this.appState.cells);
    this.refreshHud();
  }

  private paintStroke(points: Array<{ x: number; y: number }>) {
    this.appState.lastPaintedCellId = null;
    for (const point of points) {
      this.paintAtClientPoint(point.x, point.y);
    }
    this.appState.lastPaintedCellId = null;
  }

  private buildEventHandlers(): Parameters<typeof bindAppEvents>[2] {
    return {
      onTogglePlay: () => {
        this.appState.pausedByUser = !this.appState.pausedByUser;
        this.refreshHud();
      },
      onSetMode: (mode) => {
        this.setPaintMode(mode === "paint");
      },
      onToggleAutoRotate: () => {
        this.appState.autoRotate = !this.appState.autoRotate;
        this.view.setAutoRotate(this.appState.autoRotate);
        this.refreshHud();
      },
      onStep: () => {
        this.syncScene(stepSimulation(this.appState.cells, DEFAULT_RULE_CONFIG));
      },
      onRandomize: () => {
        this.syncScene(randomizeCellState(this.meshData.cells, Math.random() * 1000));
      },
      onSetBrush: (terrainKind) => {
        this.setBrushTerrainKind(terrainKind);
      },
      onSetSpeed: (nextSpeed) => {
        this.appState.speed = nextSpeed;
        this.refreshHud();
      },
      onCanvasHover: (clientX, clientY) => {
        this.view.setHoveredFromClientPoint(clientX, clientY);
      },
      onCanvasLeave: () => {
        this.view.clearHoveredCell();
      },
      onCanvasPaintStart: (clientX, clientY) => {
        this.appState.lastPaintedCellId = null;
        this.paintAtClientPoint(clientX, clientY);
      },
      onCanvasPaintMove: (clientX, clientY) => {
        this.paintAtClientPoint(clientX, clientY);
      },
      onCanvasPaintEnd: () => {
        this.appState.lastPaintedCellId = null;
      },
      onCanvasSelect: (clientX, clientY) => {
        const pickedCellId = this.view.pickCellAtClientPoint(clientX, clientY);
        this.appState.selectedCellId = toggleSelectedCell(
          this.appState.selectedCellId,
          pickedCellId
        );
        this.view.setSelectedCell(this.appState.selectedCellId);
        this.refreshHud();
      },
      onCanvasRotate: (deltaX, deltaY) => {
        this.view.rotateCameraByPixels(deltaX, deltaY);
      },
      onCanvasCameraDragChange: (isDragging) => {
        this.view.setCameraDragging(isDragging);
      },
      onCanvasZoom: (deltaY) => {
        this.view.zoomCameraByDelta(deltaY);
      }
    };
  }

  private installTestState() {
    window.__goldbergTestState = {
      getCameraPosition: () => this.view.getCameraPosition(),
      rotateCameraByPixels: (deltaX, deltaY) => {
        this.view.rotateCameraByPixels(deltaX, deltaY);
        this.view.syncCameraImmediately();
      },
      zoomCameraByDelta: (deltaY) => {
        this.view.zoomCameraByDelta(deltaY);
        this.view.syncCameraImmediately();
      },
      getInteractiveCanvasPoint: () => this.view.getInteractiveCanvasPoint(),
      setPaintMode: (enabled) => this.setPaintMode(enabled),
      setBrushTerrainKind: (terrainKind) => this.setBrushTerrainKind(terrainKind),
      paintStroke: (points) => this.paintStroke(points),
      getSelectedCellSummary: () => buildSelectedCellSummary(
        this.appState.cells,
        this.appState.selectedCellId
      ),
      getCellTerrainKind: (cellId) =>
        this.appState.cells.find((cell) => cell.id === cellId)?.terrainKind ?? null
    };
  }

  private animate(timestamp: number) {
    if (this.isDisposed) {
      return;
    }

    const interval = 1000 / this.appState.speed;
    const isPlaying = !this.appState.pausedByUser && !this.appState.pausedByPaint;

    if (isPlaying && timestamp - this.appState.lastTick >= interval) {
      this.syncScene(stepSimulation(this.appState.cells, DEFAULT_RULE_CONFIG));
      this.appState.lastTick = timestamp;
    }

    this.view.render();
  }
}

export function mountApp(root: HTMLElement): () => void {
  const controller = new AppController(root);

  return () => controller.dispose();
}
