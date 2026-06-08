import "./style.css";

import { createSimulationScene } from "./render/scene";
import { createGoldbergMesh, randomizeCellState } from "./sim/goldberg";
import { DEFAULT_RULE_CONFIG, getAdjacentWaterInfluence, stepSimulation } from "./sim/simulation";
import type { Cell } from "./types";
import { bindAppEvents } from "./ui/bindAppEvents";
import { buildSelectedCellSummary } from "./ui/buildSelectedCellSummary";
import { createAppLayout } from "./ui/createAppLayout";
import type { HudState } from "./ui/types";
import { updateHud } from "./ui/updateHud";

const DISPLAY_FREQUENCY = 10;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

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
  const findInteractiveCanvasPoint = () => {
    const rect = scene.renderer.domElement.getBoundingClientRect();
    const probes: Array<[number, number]> = [
      [0.5, 0.5],
      [0.46, 0.5],
      [0.54, 0.5],
      [0.5, 0.44],
      [0.5, 0.56],
      [0.42, 0.46],
      [0.58, 0.54],
      [0.38, 0.5],
      [0.62, 0.5]
    ];

    for (const [u, v] of probes) {
      const clientX = rect.left + rect.width * u;
      const clientY = rect.top + rect.height * v;
      const targetElement = document.elementFromPoint(clientX, clientY);
      if (targetElement !== canvasElement) {
        continue;
      }
      const cellId = scene.pickCellAtClientPoint(clientX, clientY);
      if (cellId !== null) {
        return { x: clientX, y: clientY, cellId };
      }
    }

    return null;
  };
  window.__goldbergTestState = {
    getCameraPosition: () => scene.getCameraPosition(),
    rotateCameraByPixels: (deltaX, deltaY) => {
      scene.rotateCameraByPixels(deltaX, deltaY);
    },
    zoomCameraByDelta: (deltaY) => {
      scene.zoomCameraByDelta(deltaY);
    },
    getInteractiveCanvasPoint: () => findInteractiveCanvasPoint()
  };

  const refreshHud = () => updateHud(elements, buildHudState());

  const setTerrainKind = (cellId: number, terrainKind: "water" | "land") => {
    const nextCells = cells.map((cell) =>
      cell.id === cellId
        ? { ...cell, terrainKind }
        : cell
    );
    const nextCell = nextCells[cellId];
    const waterAdjacency = getAdjacentWaterInfluence(nextCell, nextCells);
    const moisture = terrainKind === "water"
      ? 1
      : clamp01(0.08 + waterAdjacency * 0.9 + nextCell.geology * 0.08);
    const vegetation = terrainKind === "water"
      ? 0
      : clamp01(
        Math.max(0, moisture - DEFAULT_RULE_CONFIG.minimumMoistureForGrowth) * 0.58 +
        nextCell.fertility * 0.08 +
        nextCell.geology * 0.04
      );

    return nextCells.map((cell) => (
      cell.id === cellId
        ? {
          ...cell,
          terrainKind,
          moisture,
          nextMoisture: moisture,
          vegetation,
          nextVegetation: vegetation,
          state: vegetation,
          nextState: vegetation
        }
        : cell
    ));
  };

  const syncScene = (nextCells: Cell[]) => {
    cells = nextCells;
    scene.updateCells(cells);
    refreshHud();
  };

  const applyTerrainToCell = (cellId: number, terrainKind: "water" | "land") => {
    if (lastPaintedCellId === cellId) {
      return;
    }
    lastPaintedCellId = cellId;
    selectedCellId = cellId;
    scene.setSelectedCell(selectedCellId);
    syncScene(setTerrainKind(cellId, terrainKind));
  };

  const paintAtClientPoint = (clientX: number, clientY: number) => {
    const pickedCellId = scene.pickCellAtClientPoint(clientX, clientY);
    if (pickedCellId === null) {
      return;
    }

    applyTerrainToCell(pickedCellId, brushTerrainKind);
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
      syncScene(setTerrainKind(selectedCellId, terrainKind));
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
      selectedCellId = selectedCellId === pickedCellId ? null : pickedCellId;
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
