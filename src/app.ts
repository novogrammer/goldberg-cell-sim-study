import "./style.css";

import type { AppState } from "./appState";
import { paintAtPickedPoint, toggleSelectedCell } from "./editor/planetEditor";
import { createSimulationView } from "./render/createSimulationView";
import { createGoldbergMesh, randomizeCellState } from "./sim/goldberg";
import { DEFAULT_RULE_CONFIG, stepSimulation } from "./sim/simulation";
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
    };
  }
}

export function mountApp(root: HTMLElement): () => void {
  const meshData = createGoldbergMesh(DISPLAY_FREQUENCY);
  const appState: AppState = {
    cells: randomizeCellState(meshData.cells),
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

  const buildHudState = (): HudState => {
    const isPlaying = !appState.pausedByUser && !appState.pausedByPaint;

    return {
      isPaintMode: appState.isPaintMode,
      isPlaying,
      autoRotate: appState.autoRotate,
      speed: appState.speed,
      brushTerrainKind: appState.brushTerrainKind,
      selectedCellSummary: buildSelectedCellSummary(appState.cells, appState.selectedCellId)
    };
  };

  const elements = createAppLayout(root, {
    cellCount: appState.cells.length,
    pentagonCount: meshData.pentagonCount,
    hexagonCount: meshData.hexagonCount,
    frequency: meshData.frequency,
    speed: appState.speed
  }, buildHudState());

  const view = createSimulationView(elements.viewport, meshData, appState.cells);
  view.setAutoRotate(appState.autoRotate);
  window.__goldbergTestState = {
    getCameraPosition: () => view.getCameraPosition(),
    rotateCameraByPixels: (deltaX, deltaY) => {
      view.rotateCameraByPixels(deltaX, deltaY);
    },
    zoomCameraByDelta: (deltaY) => {
      view.zoomCameraByDelta(deltaY);
    },
    getInteractiveCanvasPoint: () => view.getInteractiveCanvasPoint()
  };

  const refreshHud = () => updateHud(elements, buildHudState());

  const syncScene = (nextCells: AppState["cells"]) => {
    appState.cells = nextCells;
    view.syncCells(appState.cells);
    refreshHud();
  };

  const paintAtClientPoint = (clientX: number, clientY: number) => {
    const nextState = paintAtPickedPoint(
      {
        cells: appState.cells,
        selectedCellId: appState.selectedCellId,
        lastPaintedCellId: appState.lastPaintedCellId
      },
      appState.brushTerrainKind,
      view.pickCellAtClientPoint(clientX, clientY)
    );
    if (nextState.cells === appState.cells) {
      return;
    }

    appState.cells = nextState.cells;
    appState.selectedCellId = nextState.selectedCellId;
    appState.lastPaintedCellId = nextState.lastPaintedCellId;
    view.setSelectedCell(appState.selectedCellId);
    view.syncCells(appState.cells);
    refreshHud();
  };

  const cleanupEvents = bindAppEvents(elements, view.canvasElement, {
    onTogglePlay: () => {
      appState.pausedByUser = !appState.pausedByUser;
      refreshHud();
    },
    onSetMode: (mode) => {
      appState.isPaintMode = mode === "paint";
      appState.pausedByPaint = appState.isPaintMode;
      appState.lastPaintedCellId = null;
      view.setControlsEnabled(!appState.isPaintMode);
      refreshHud();
    },
    onToggleAutoRotate: () => {
      appState.autoRotate = !appState.autoRotate;
      view.setAutoRotate(appState.autoRotate);
      refreshHud();
    },
    onStep: () => {
      syncScene(stepSimulation(appState.cells, DEFAULT_RULE_CONFIG));
    },
    onRandomize: () => {
      syncScene(randomizeCellState(meshData.cells, Math.random() * 1000));
    },
    onSetBrush: (terrainKind) => {
      appState.brushTerrainKind = terrainKind;
      refreshHud();
    },
    onSetSpeed: (nextSpeed) => {
      appState.speed = nextSpeed;
      refreshHud();
    },
    onCanvasHover: (clientX, clientY) => {
      view.setHoveredFromClientPoint(clientX, clientY);
    },
    onCanvasLeave: () => {
      view.clearHoveredCell();
    },
    onCanvasPaintStart: (clientX, clientY) => {
      appState.lastPaintedCellId = null;
      paintAtClientPoint(clientX, clientY);
    },
    onCanvasPaintMove: (clientX, clientY) => {
      paintAtClientPoint(clientX, clientY);
    },
    onCanvasPaintEnd: () => {
      appState.lastPaintedCellId = null;
    },
    onCanvasSelect: (clientX, clientY) => {
      const pickedCellId = view.pickCellAtClientPoint(clientX, clientY);
      appState.selectedCellId = toggleSelectedCell(appState.selectedCellId, pickedCellId);
      view.setSelectedCell(appState.selectedCellId);
      refreshHud();
    }
  });

  const onResize = () => view.resize();
  window.addEventListener("resize", onResize);

  let isDisposed = false;

  const animate = (timestamp: number) => {
    if (isDisposed) {
      return;
    }

    const interval = 1000 / appState.speed;
    const isPlaying = !appState.pausedByUser && !appState.pausedByPaint;

    if (isPlaying && timestamp - appState.lastTick >= interval) {
      syncScene(stepSimulation(appState.cells, DEFAULT_RULE_CONFIG));
      appState.lastTick = timestamp;
    }

    view.render();
  };

  refreshHud();
  view.setAnimationLoop(animate);

  return () => {
    if (isDisposed) {
      return;
    }

    isDisposed = true;
    view.setAnimationLoop(null);
    cleanupEvents();
    window.removeEventListener("resize", onResize);
    delete window.__goldbergTestState;
    view.dispose();
  };
}
