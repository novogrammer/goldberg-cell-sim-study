import "./style.css";

import type { AppState } from "./appState";
import { findInteractiveCanvasPoint } from "./editor/findInteractiveCanvasPoint";
import { paintAtPickedPoint, setCellTerrainKind, toggleSelectedCell } from "./editor/planetEditor";
import { createSimulationScene } from "./render/scene";
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
    isPlaying: true,
    autoRotate: false,
    isPaintMode: false,
    brushTerrainKind: "land",
    lastPaintedCellId: null,
    lastTick: 0,
    selectedCellId: null
  };

  const buildHudState = (): HudState => {
    return {
      isPaintMode: appState.isPaintMode,
      isPlaying: appState.isPlaying,
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

  const scene = createSimulationScene(elements.viewport, meshData, appState.cells);
  scene.setAutoRotate(appState.autoRotate);
  const canvasElement = scene.renderer.domElement;
  window.__goldbergTestState = {
    getCameraPosition: () => scene.getCameraPosition(),
    rotateCameraByPixels: (deltaX, deltaY) => {
      scene.rotateCameraByPixels(deltaX, deltaY);
    },
    zoomCameraByDelta: (deltaY) => {
      scene.zoomCameraByDelta(deltaY);
    },
    getInteractiveCanvasPoint: () => findInteractiveCanvasPoint(
      canvasElement,
      scene.pickCellAtClientPoint
    )
  };

  const refreshHud = () => updateHud(elements, buildHudState());

  const syncScene = (nextCells: AppState["cells"]) => {
    appState.cells = nextCells;
    scene.updateCells(appState.cells);
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
      scene.pickCellAtClientPoint(clientX, clientY)
    );
    if (nextState.cells === appState.cells) {
      return;
    }

    appState.cells = nextState.cells;
    appState.selectedCellId = nextState.selectedCellId;
    appState.lastPaintedCellId = nextState.lastPaintedCellId;
    scene.setSelectedCell(appState.selectedCellId);
    scene.updateCells(appState.cells);
    refreshHud();
  };

  const cleanupEvents = bindAppEvents(elements, canvasElement, {
    onTogglePlay: () => {
      appState.isPlaying = !appState.isPlaying;
      refreshHud();
    },
    onSetMode: (mode) => {
      appState.isPaintMode = mode === "paint";
      appState.lastPaintedCellId = null;
      scene.setControlsEnabled(!appState.isPaintMode);
      refreshHud();
    },
    onToggleAutoRotate: () => {
      appState.autoRotate = !appState.autoRotate;
      scene.setAutoRotate(appState.autoRotate);
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
    onSetTerrain: (terrainKind) => {
      if (appState.selectedCellId === null) {
        refreshHud();
        return;
      }
      syncScene(setCellTerrainKind(appState.cells, appState.selectedCellId, terrainKind));
    },
    onSetSpeed: (nextSpeed) => {
      appState.speed = nextSpeed;
      refreshHud();
    },
    onCanvasHover: (clientX, clientY) => {
      scene.setHoveredCell(scene.pickCellAtClientPoint(clientX, clientY));
    },
    onCanvasLeave: () => {
      scene.setHoveredCell(null);
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
      const pickedCellId = scene.pickCellAtClientPoint(clientX, clientY);
      appState.selectedCellId = toggleSelectedCell(appState.selectedCellId, pickedCellId);
      scene.setSelectedCell(appState.selectedCellId);
      refreshHud();
    }
  });

  const onResize = () => scene.resize();
  window.addEventListener("resize", onResize);

  let animationFrameId = 0;
  let isDisposed = false;

  const animate = (timestamp: number) => {
    if (isDisposed) {
      return;
    }

    animationFrameId = requestAnimationFrame(animate);
    const interval = 1000 / appState.speed;

    if (appState.isPlaying && timestamp - appState.lastTick >= interval) {
      syncScene(stepSimulation(appState.cells, DEFAULT_RULE_CONFIG));
      appState.lastTick = timestamp;
    }

    scene.render();
  };

  refreshHud();
  animationFrameId = requestAnimationFrame(animate);

  return () => {
    if (isDisposed) {
      return;
    }

    isDisposed = true;
    cancelAnimationFrame(animationFrameId);
    cleanupEvents();
    window.removeEventListener("resize", onResize);
    delete window.__goldbergTestState;
    scene.dispose();
  };
}
