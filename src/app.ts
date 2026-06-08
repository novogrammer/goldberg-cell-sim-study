import "./style.css";

import { createSimulationScene } from "./render/scene";
import { createGoldbergMesh, randomizeCellState } from "./sim/goldberg";
import { DEFAULT_RULE_CONFIG, getAdjacentWaterInfluence, stepSimulation } from "./sim/simulation";
import type { Cell } from "./types";

const DISPLAY_FREQUENCY = 10;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const CLICK_SELECTION_THRESHOLD = 6;

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

export function mountApp(root: HTMLElement): void {
  const meshData = createGoldbergMesh(DISPLAY_FREQUENCY);
  let cells = randomizeCellState(meshData.cells);
  let speed = 6;
  let isPlaying = true;
  let autoRotate = true;
  let isPaintMode = false;
  let brushTerrainKind: "water" | "land" = "land";
  let isPointerPainting = false;
  let lastPaintedCellId: number | null = null;
  let pointerDownClientX = 0;
  let pointerDownClientY = 0;
  let lastTick = 0;
  let selectedCellId: number | null = null;

  root.innerHTML = `
    <div class="app-shell" data-mode="view">
      <div class="hud">
        <div class="hero-block">
          <p class="eyebrow">Goldberg Polyhedron Cell Simulation</p>
          <h1>Water basins drive vegetation across the planet</h1>
          <p class="hero-copy">
            Watch the planet drift in view mode, then switch to paint mode to edit water and land directly on the sphere.
          </p>
        </div>
        <section class="panel panel-mode" data-panel="mode">
          <div class="panel-header">
            <div>
              <p class="panel-eyebrow">Mode</p>
              <h2 data-stat="mode-label">View mode</h2>
            </div>
            <span class="mode-badge" data-stat="mode-badge">Orbit camera</span>
          </div>
          <p class="panel-copy" data-stat="mode-detail">
            Drag to orbit, scroll to zoom, and inspect the current simulation state.
          </p>
          <div class="segmented" role="group" aria-label="Mode switch">
            <button type="button" data-action="view-mode" aria-pressed="true">View</button>
            <button type="button" data-action="paint-mode" aria-pressed="false">Paint</button>
          </div>
          <div class="state-row">
            <span class="state-chip" data-stat="camera-state">Camera unlocked</span>
            <span class="state-chip" data-stat="brush-state">Brush: land</span>
          </div>
        </section>

        <section class="panel" data-panel="simulation">
          <div class="panel-header">
            <div>
              <p class="panel-eyebrow">Simulation</p>
              <h2>Run state</h2>
            </div>
          </div>
          <div class="controls">
            <button type="button" data-action="toggle">Pause</button>
            <button type="button" data-action="step">Step</button>
            <button type="button" data-action="randomize">Randomize</button>
          </div>
          <dl class="stat-grid stat-grid-compact">
            <div><dt>Rule</dt><dd>Water + vegetation locality</dd></div>
            <div><dt>Cells</dt><dd data-stat="cells">${cells.length}</dd></div>
            <div><dt>Pentagons</dt><dd data-stat="pentagons">${meshData.pentagonCount}</dd></div>
            <div><dt>Hexagons</dt><dd data-stat="hexagons">${meshData.hexagonCount}</dd></div>
            <div><dt>Frequency</dt><dd data-stat="frequency">${meshData.frequency}</dd></div>
          </dl>
        </section>

        <section class="panel" data-panel="camera">
          <div class="panel-header">
            <div>
              <p class="panel-eyebrow">Camera</p>
              <h2>Movement</h2>
            </div>
            <span class="panel-status" data-stat="rotation-state">Auto rotate on</span>
          </div>
          <div class="controls">
            <button type="button" data-action="rotate">Stop Rotation</button>
            <label>
              <span>Speed</span>
              <input type="range" min="1" max="24" step="1" value="${speed}" data-action="speed" />
            </label>
          </div>
        </section>

        <section class="panel panel-paint" data-panel="paint">
          <div class="panel-header">
            <div>
              <p class="panel-eyebrow">Paint</p>
              <h2>Brush tools</h2>
            </div>
            <span class="panel-status" data-stat="paint-state">Inactive</span>
          </div>
          <p class="panel-copy">
            In paint mode, click or drag across the sphere to apply the selected terrain.
          </p>
          <div class="controls">
            <label>
              <span>Brush</span>
              <select data-action="brush">
                <option value="land">land</option>
                <option value="water">water</option>
              </select>
            </label>
          </div>
        </section>

        <section class="panel" data-panel="selection">
          <div class="panel-header">
            <div>
              <p class="panel-eyebrow">Selection</p>
              <h2>Cell detail</h2>
            </div>
            <span class="panel-status" data-stat="selection-state">No cell selected</span>
          </div>
          <div class="controls">
            <label>
              <span>Terrain</span>
              <select data-action="terrain" disabled>
                <option value="land">land</option>
                <option value="water">water</option>
              </select>
            </label>
          </div>
          <dl class="stat-grid">
            <div><dt>Selected</dt><dd data-stat="selected">none</dd></div>
            <div><dt>Terrain</dt><dd data-stat="terrain">-</dd></div>
            <div><dt>Moisture</dt><dd data-stat="moisture">-</dd></div>
            <div><dt>Vegetation</dt><dd data-stat="vegetation">-</dd></div>
            <div><dt>Water Adj.</dt><dd data-stat="water-adj">-</dd></div>
            <div><dt>Fertility</dt><dd data-stat="fertility">-</dd></div>
            <div><dt>Geology</dt><dd data-stat="geology">-</dd></div>
          </dl>
        </section>
      </div>
      <div class="viewport-frame">
        <div class="viewport-overlay" aria-hidden="true">
          <div class="viewport-guide">
            <span class="viewport-guide-badge" data-stat="viewport-mode">View mode</span>
            <p class="viewport-guide-text" data-stat="viewport-hint">
              Drag to orbit and scroll to zoom.
            </p>
          </div>
          <div class="viewport-selection-card" data-stat="viewport-selection">
            No cell selected
          </div>
        </div>
        <div class="viewport" data-role="viewport"></div>
      </div>
    </div>
  `;

  const appShell = root.querySelector<HTMLElement>(".app-shell");
  const viewport = root.querySelector<HTMLElement>("[data-role='viewport']");
  if (!appShell || !viewport) {
    throw new Error("Viewport element was not created.");
  }

  const scene = createSimulationScene(viewport, meshData, cells);
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

  const toggleButton = root.querySelector<HTMLButtonElement>("[data-action='toggle']");
  const viewModeButton = root.querySelector<HTMLButtonElement>("[data-action='view-mode']");
  const rotateButton = root.querySelector<HTMLButtonElement>("[data-action='rotate']");
  const paintModeButton = root.querySelector<HTMLButtonElement>("[data-action='paint-mode']");
  const stepButton = root.querySelector<HTMLButtonElement>("[data-action='step']");
  const randomizeButton = root.querySelector<HTMLButtonElement>("[data-action='randomize']");
  const brushSelect = root.querySelector<HTMLSelectElement>("[data-action='brush']");
  const terrainSelect = root.querySelector<HTMLSelectElement>("[data-action='terrain']");
  const speedSlider = root.querySelector<HTMLInputElement>("[data-action='speed']");
  const modePanel = root.querySelector<HTMLElement>("[data-panel='mode']");
  const simulationPanel = root.querySelector<HTMLElement>("[data-panel='simulation']");
  const cameraPanel = root.querySelector<HTMLElement>("[data-panel='camera']");
  const paintPanel = root.querySelector<HTMLElement>("[data-panel='paint']");
  const selectionPanel = root.querySelector<HTMLElement>("[data-panel='selection']");
  const selectedStat = root.querySelector<HTMLElement>("[data-stat='selected']");
  const modeLabelStat = root.querySelector<HTMLElement>("[data-stat='mode-label']");
  const modeBadgeStat = root.querySelector<HTMLElement>("[data-stat='mode-badge']");
  const modeDetailStat = root.querySelector<HTMLElement>("[data-stat='mode-detail']");
  const cameraStateStat = root.querySelector<HTMLElement>("[data-stat='camera-state']");
  const brushStateStat = root.querySelector<HTMLElement>("[data-stat='brush-state']");
  const rotationStateStat = root.querySelector<HTMLElement>("[data-stat='rotation-state']");
  const paintStateStat = root.querySelector<HTMLElement>("[data-stat='paint-state']");
  const selectionStateStat = root.querySelector<HTMLElement>("[data-stat='selection-state']");
  const viewportModeStat = root.querySelector<HTMLElement>("[data-stat='viewport-mode']");
  const viewportHintStat = root.querySelector<HTMLElement>("[data-stat='viewport-hint']");
  const viewportSelectionStat = root.querySelector<HTMLElement>("[data-stat='viewport-selection']");
  const terrainStat = root.querySelector<HTMLElement>("[data-stat='terrain']");
  const moistureStat = root.querySelector<HTMLElement>("[data-stat='moisture']");
  const vegetationStat = root.querySelector<HTMLElement>("[data-stat='vegetation']");
  const waterAdjStat = root.querySelector<HTMLElement>("[data-stat='water-adj']");
  const fertilityStat = root.querySelector<HTMLElement>("[data-stat='fertility']");
  const geologyStat = root.querySelector<HTMLElement>("[data-stat='geology']");

  if (
    !toggleButton ||
    !viewModeButton ||
    !rotateButton ||
    !paintModeButton ||
    !stepButton ||
    !randomizeButton ||
    !brushSelect ||
    !terrainSelect ||
    !speedSlider ||
    !modePanel ||
    !simulationPanel ||
    !cameraPanel ||
    !paintPanel ||
    !selectionPanel ||
    !selectedStat ||
    !modeLabelStat ||
    !modeBadgeStat ||
    !modeDetailStat ||
    !cameraStateStat ||
    !brushStateStat ||
    !rotationStateStat ||
    !paintStateStat ||
    !selectionStateStat ||
    !viewportModeStat ||
    !viewportHintStat ||
    !viewportSelectionStat ||
    !terrainStat ||
    !moistureStat ||
    !vegetationStat ||
    !waterAdjStat ||
    !fertilityStat ||
    !geologyStat
  ) {
    throw new Error("Control elements were not created.");
  }

  const updateModeUI = () => {
    appShell.dataset.mode = isPaintMode ? "paint" : "view";
    modeLabelStat.textContent = isPaintMode ? "Paint mode" : "View mode";
    modeBadgeStat.textContent = isPaintMode ? "Editing terrain" : "Orbit camera";
    modeDetailStat.textContent = isPaintMode
      ? "Click or drag across the sphere to paint the active terrain without moving the camera."
      : "Drag to orbit, scroll to zoom, and inspect the current simulation state.";
    cameraStateStat.textContent = isPaintMode ? "Camera locked for painting" : "Camera unlocked";
    brushStateStat.textContent = `Brush: ${brushTerrainKind}`;
    rotationStateStat.textContent = autoRotate ? "Auto rotate on" : "Auto rotate off";
    paintStateStat.textContent = isPaintMode ? "Active" : "Inactive";
    viewportModeStat.textContent = isPaintMode ? "Paint mode" : "View mode";
    viewportHintStat.textContent = isPaintMode
      ? `Brush ${brushTerrainKind}. Click or drag across the sphere to paint.`
      : "Drag to orbit and scroll to zoom.";
    viewModeButton.setAttribute("aria-pressed", String(!isPaintMode));
    paintModeButton.setAttribute("aria-pressed", String(isPaintMode));
    modePanel.dataset.mode = isPaintMode ? "paint" : "view";
    simulationPanel.dataset.emphasis = isPaintMode ? "muted" : "normal";
    cameraPanel.dataset.emphasis = isPaintMode ? "muted" : "normal";
    paintPanel.dataset.active = String(isPaintMode);
    selectionPanel.dataset.emphasis = selectedCellId === null ? "normal" : "active";
    toggleButton.disabled = isPaintMode;
    rotateButton.disabled = isPaintMode;
    speedSlider.disabled = isPaintMode;
  };

  const updateSelectionStats = () => {
    if (selectedCellId === null) {
      selectedStat.textContent = "none";
      selectionStateStat.textContent = "No cell selected";
      selectionPanel.dataset.emphasis = "normal";
      viewportSelectionStat.textContent = isPaintMode
        ? "Pick a cell to start painting terrain."
        : "No cell selected";
      terrainStat.textContent = "-";
      moistureStat.textContent = "-";
      vegetationStat.textContent = "-";
      waterAdjStat.textContent = "-";
      fertilityStat.textContent = "-";
      geologyStat.textContent = "-";
      terrainSelect.disabled = true;
      return;
    }

    const selectedCell = cells[selectedCellId];
    if (!selectedCell) {
      return;
    }

    const waterAdjacency = getAdjacentWaterInfluence(selectedCell, cells);
    selectedStat.textContent = `cell ${selectedCellId}`;
    selectionStateStat.textContent = `Selected cell ${selectedCellId}`;
    viewportSelectionStat.textContent = `Selected cell ${selectedCellId} · ${selectedCell.terrainKind}`;
    terrainStat.textContent = selectedCell.terrainKind;
    moistureStat.textContent = selectedCell.moisture.toFixed(2);
    vegetationStat.textContent = selectedCell.vegetation.toFixed(2);
    waterAdjStat.textContent = waterAdjacency.toFixed(2);
    fertilityStat.textContent = selectedCell.fertility.toFixed(2);
    geologyStat.textContent = selectedCell.geology.toFixed(2);
    terrainSelect.value = selectedCell.terrainKind;
    terrainSelect.disabled = false;
    selectionPanel.dataset.emphasis = "active";
  };

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
    updateSelectionStats();
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

  toggleButton.addEventListener("click", () => {
    isPlaying = !isPlaying;
    toggleButton.textContent = isPlaying ? "Pause" : "Play";
  });

  viewModeButton.addEventListener("click", () => {
    isPaintMode = false;
    isPointerPainting = false;
    lastPaintedCellId = null;
    scene.setControlsEnabled(true);
    updateModeUI();
  });

  rotateButton.addEventListener("click", () => {
    autoRotate = !autoRotate;
    scene.setAutoRotate(autoRotate);
    rotateButton.textContent = autoRotate ? "Stop Rotation" : "Auto Rotate";
    updateModeUI();
  });

  paintModeButton.addEventListener("click", () => {
    isPaintMode = true;
    isPointerPainting = false;
    lastPaintedCellId = null;
    scene.setControlsEnabled(false);
    updateModeUI();
  });

  stepButton.addEventListener("click", () => {
    syncScene(stepSimulation(cells, DEFAULT_RULE_CONFIG));
  });

  randomizeButton.addEventListener("click", () => {
    syncScene(randomizeCellState(meshData.cells, Math.random() * 1000));
  });

  brushSelect.addEventListener("change", () => {
    brushTerrainKind = brushSelect.value as "water" | "land";
    updateModeUI();
  });

  terrainSelect.addEventListener("change", () => {
    if (selectedCellId === null) {
      terrainSelect.disabled = true;
      return;
    }

    syncScene(setTerrainKind(selectedCellId, terrainSelect.value as "water" | "land"));
  });

  speedSlider.addEventListener("input", () => {
    speed = Number(speedSlider.value);
  });

  canvasElement.addEventListener("pointermove", (event) => {
    scene.setHoveredCell(scene.pickCellAtClientPoint(event.clientX, event.clientY));

    if (!isPaintMode || !isPointerPainting || (event.buttons & 1) === 0) {
      return;
    }

    paintAtClientPoint(event.clientX, event.clientY);
  });

  canvasElement.addEventListener("pointerleave", () => {
    scene.setHoveredCell(null);
  });

  canvasElement.addEventListener("pointerdown", (event) => {
    pointerDownClientX = event.clientX;
    pointerDownClientY = event.clientY;

    if (!isPaintMode || event.button !== 0) {
      return;
    }

    isPointerPainting = true;
    lastPaintedCellId = null;
    canvasElement.setPointerCapture(event.pointerId);
    paintAtClientPoint(event.clientX, event.clientY);
  });

  canvasElement.addEventListener("pointerup", (event) => {
    if (!isPaintMode) {
      if (event.button !== 0) {
        return;
      }

      const movedDistance = Math.hypot(
        event.clientX - pointerDownClientX,
        event.clientY - pointerDownClientY
      );
      if (movedDistance > CLICK_SELECTION_THRESHOLD) {
        return;
      }

      const pickedCellId = scene.pickCellAtClientPoint(event.clientX, event.clientY);
      selectedCellId = selectedCellId === pickedCellId ? null : pickedCellId;
      scene.setSelectedCell(selectedCellId);
      updateSelectionStats();
      return;
    }

    isPointerPainting = false;
    lastPaintedCellId = null;
    if (canvasElement.hasPointerCapture(event.pointerId)) {
      canvasElement.releasePointerCapture(event.pointerId);
    }
  });

  canvasElement.addEventListener("pointercancel", (event) => {
    isPointerPainting = false;
    lastPaintedCellId = null;
    if (canvasElement.hasPointerCapture(event.pointerId)) {
      canvasElement.releasePointerCapture(event.pointerId);
    }
  });

  const onResize = () => scene.resize();
  const onWindowPointerUp = () => {
    isPointerPainting = false;
    lastPaintedCellId = null;
  };
  window.addEventListener("resize", onResize);
  window.addEventListener("pointerup", onWindowPointerUp);

  const animate = (timestamp: number) => {
    requestAnimationFrame(animate);
    const interval = 1000 / speed;

    if (isPlaying && timestamp - lastTick >= interval) {
      syncScene(stepSimulation(cells, DEFAULT_RULE_CONFIG));
      lastTick = timestamp;
    }

    scene.render();
  };

  updateModeUI();
  updateSelectionStats();
  requestAnimationFrame(animate);

  window.addEventListener(
    "beforeunload",
    () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointerup", onWindowPointerUp);
      delete window.__goldbergTestState;
      scene.dispose();
    },
    { once: true }
  );
}
