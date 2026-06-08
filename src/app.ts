import "./style.css";

import { findInteractiveCanvasPoint } from "./editor/findInteractiveCanvasPoint";
import { paintAtPickedPoint, setCellTerrainKind, toggleSelectedCell } from "./editor/planetEditor";
import { createSimulationScene } from "./render/scene";
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
    };
  }
}

export function mountApp(root: HTMLElement): () => void {
  const meshData = createGoldbergMesh(DISPLAY_FREQUENCY);
  let cells = randomizeCellState(meshData.cells);
  let speed = 6;
  let isPlaying = true;
  let autoRotate = false;
  let isPaintMode = false;
  let brushTerrainKind: "water" | "land" = "land";
  let lastPaintedCellId: number | null = null;
  let lastTick = 0;
  let selectedCellId: number | null = null;

  const buildHudState = (): HudState => {
    return {
      isPaintMode,
      isPlaying,
      autoRotate,
      speed,
      brushTerrainKind,
      selectedCellSummary: buildSelectedCellSummary(cells, selectedCellId)
    };
  };

  const elements = createAppLayout(root, {
    cellCount: cells.length,
    pentagonCount: meshData.pentagonCount,
    hexagonCount: meshData.hexagonCount,
    frequency: meshData.frequency,
    speed
  }, buildHudState());

  const scene = createSimulationScene(elements.viewport, meshData, cells);
  scene.setAutoRotate(autoRotate);
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

  const syncScene = (nextCells: Cell[]) => {
    cells = nextCells;
    scene.updateCells(cells);
    refreshHud();
  };

  const paintAtClientPoint = (clientX: number, clientY: number) => {
    const nextState = paintAtPickedPoint(
      {
        cells,
        selectedCellId,
        lastPaintedCellId
      },
      brushTerrainKind,
      scene.pickCellAtClientPoint(clientX, clientY)
    );
    if (nextState.cells === cells) {
      return;
    }

    cells = nextState.cells;
    selectedCellId = nextState.selectedCellId;
    lastPaintedCellId = nextState.lastPaintedCellId;
    scene.setSelectedCell(selectedCellId);
    scene.updateCells(cells);
    refreshHud();
  };

  const cleanupEvents = bindAppEvents(elements, canvasElement, {
    onTogglePlay: () => {
      isPlaying = !isPlaying;
      refreshHud();
    },
    onSetMode: (mode) => {
      isPaintMode = mode === "paint";
      lastPaintedCellId = null;
      scene.setControlsEnabled(!isPaintMode);
      refreshHud();
    },
    onToggleAutoRotate: () => {
      autoRotate = !autoRotate;
      scene.setAutoRotate(autoRotate);
      refreshHud();
    },
    onStep: () => {
      syncScene(stepSimulation(cells, DEFAULT_RULE_CONFIG));
    },
    onRandomize: () => {
      syncScene(randomizeCellState(meshData.cells, Math.random() * 1000));
    },
    onSetBrush: (terrainKind) => {
      brushTerrainKind = terrainKind;
      refreshHud();
    },
    onSetTerrain: (terrainKind) => {
      if (selectedCellId === null) {
        refreshHud();
        return;
      }
      syncScene(setCellTerrainKind(cells, selectedCellId, terrainKind));
    },
    onSetSpeed: (nextSpeed) => {
      speed = nextSpeed;
      refreshHud();
    },
    onCanvasHover: (clientX, clientY) => {
      scene.setHoveredCell(scene.pickCellAtClientPoint(clientX, clientY));
    },
    onCanvasLeave: () => {
      scene.setHoveredCell(null);
    },
    onCanvasPaintStart: (clientX, clientY) => {
      lastPaintedCellId = null;
      paintAtClientPoint(clientX, clientY);
    },
    onCanvasPaintMove: (clientX, clientY) => {
      paintAtClientPoint(clientX, clientY);
    },
    onCanvasPaintEnd: () => {
      lastPaintedCellId = null;
    },
    onCanvasSelect: (clientX, clientY) => {
      const pickedCellId = scene.pickCellAtClientPoint(clientX, clientY);
      selectedCellId = toggleSelectedCell(selectedCellId, pickedCellId);
      scene.setSelectedCell(selectedCellId);
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
    const interval = 1000 / speed;

    if (isPlaying && timestamp - lastTick >= interval) {
      syncScene(stepSimulation(cells, DEFAULT_RULE_CONFIG));
      lastTick = timestamp;
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
