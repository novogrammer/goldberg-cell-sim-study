import "./style.css";

import { createSimulationScene } from "./render/scene";
import { createGoldbergMesh, randomizeCellState } from "./sim/goldberg";
import { DEFAULT_RULE_CONFIG, getAdjacentWaterInfluence, stepSimulation } from "./sim/simulation";
import type { Cell } from "./types";

const DISPLAY_FREQUENCY = 3;

export function mountApp(root: HTMLElement): void {
  const meshData = createGoldbergMesh(DISPLAY_FREQUENCY);
  let cells = randomizeCellState(meshData.cells);
  let speed = 6;
  let isPlaying = true;
  let lastTick = 0;
  let selectedCellId: number | null = null;

  root.innerHTML = `
    <div class="app-shell">
      <div class="hud">
        <div>
          <p class="eyebrow">Goldberg多面体セルシミュレーション</p>
          <h1>Water basins drive vegetation across the planet</h1>
        </div>
        <div class="controls">
          <button type="button" data-action="toggle">Pause</button>
          <button type="button" data-action="step">Step</button>
          <button type="button" data-action="randomize">Randomize</button>
          <label>
            <span>Speed</span>
            <input type="range" min="1" max="24" step="1" value="${speed}" data-action="speed" />
          </label>
        </div>
        <dl class="stats">
          <div><dt>Frequency</dt><dd data-stat="frequency">${meshData.frequency}</dd></div>
          <div><dt>Cells</dt><dd data-stat="cells">${cells.length}</dd></div>
          <div><dt>Pentagons</dt><dd data-stat="pentagons">${meshData.pentagonCount}</dd></div>
          <div><dt>Hexagons</dt><dd data-stat="hexagons">${meshData.hexagonCount}</dd></div>
          <div><dt>Rule</dt><dd>Water + vegetation locality</dd></div>
          <div><dt>Selected</dt><dd data-stat="selected">none</dd></div>
          <div><dt>Terrain</dt><dd data-stat="terrain">-</dd></div>
          <div><dt>Moisture</dt><dd data-stat="moisture">-</dd></div>
          <div><dt>Vegetation</dt><dd data-stat="vegetation">-</dd></div>
          <div><dt>Water Adj.</dt><dd data-stat="water-adj">-</dd></div>
          <div><dt>Fertility</dt><dd data-stat="fertility">-</dd></div>
          <div><dt>Geology</dt><dd data-stat="geology">-</dd></div>
        </dl>
      </div>
      <div class="viewport" data-role="viewport"></div>
    </div>
  `;

  const viewport = root.querySelector<HTMLElement>("[data-role='viewport']");
  if (!viewport) {
    throw new Error("Viewport element was not created.");
  }

  const scene = createSimulationScene(viewport, meshData, cells);

  const toggleButton = root.querySelector<HTMLButtonElement>("[data-action='toggle']");
  const stepButton = root.querySelector<HTMLButtonElement>("[data-action='step']");
  const randomizeButton = root.querySelector<HTMLButtonElement>("[data-action='randomize']");
  const speedSlider = root.querySelector<HTMLInputElement>("[data-action='speed']");
  const selectedStat = root.querySelector<HTMLElement>("[data-stat='selected']");
  const terrainStat = root.querySelector<HTMLElement>("[data-stat='terrain']");
  const moistureStat = root.querySelector<HTMLElement>("[data-stat='moisture']");
  const vegetationStat = root.querySelector<HTMLElement>("[data-stat='vegetation']");
  const waterAdjStat = root.querySelector<HTMLElement>("[data-stat='water-adj']");
  const fertilityStat = root.querySelector<HTMLElement>("[data-stat='fertility']");
  const geologyStat = root.querySelector<HTMLElement>("[data-stat='geology']");

  if (
    !toggleButton ||
    !stepButton ||
    !randomizeButton ||
    !speedSlider ||
    !selectedStat ||
    !terrainStat ||
    !moistureStat ||
    !vegetationStat ||
    !waterAdjStat ||
    !fertilityStat ||
    !geologyStat
  ) {
    throw new Error("Control elements were not created.");
  }

  const syncScene = (nextCells: Cell[]) => {
    cells = nextCells;
    scene.updateCells(cells);
    if (selectedCellId !== null) {
      const selectedCell = cells[selectedCellId];
      if (selectedCell) {
        const waterAdjacency = getAdjacentWaterInfluence(selectedCell, cells);
        selectedStat.textContent = `cell ${selectedCellId}`;
        terrainStat.textContent = selectedCell.terrainKind;
        moistureStat.textContent = selectedCell.moisture.toFixed(2);
        vegetationStat.textContent = selectedCell.vegetation.toFixed(2);
        waterAdjStat.textContent = waterAdjacency.toFixed(2);
        fertilityStat.textContent = selectedCell.fertility.toFixed(2);
        geologyStat.textContent = selectedCell.geology.toFixed(2);
      }
    }
  };

  toggleButton.addEventListener("click", () => {
    isPlaying = !isPlaying;
    toggleButton.textContent = isPlaying ? "Pause" : "Play";
  });

  stepButton.addEventListener("click", () => {
    syncScene(stepSimulation(cells, DEFAULT_RULE_CONFIG));
  });

  randomizeButton.addEventListener("click", () => {
    syncScene(randomizeCellState(meshData.cells, Math.random() * 1000));
  });

  speedSlider.addEventListener("input", () => {
    speed = Number(speedSlider.value);
  });

  viewport.addEventListener("pointermove", (event) => {
    scene.setHoveredCell(scene.pickCellAtClientPoint(event.clientX, event.clientY));
  });

  viewport.addEventListener("pointerleave", () => {
    scene.setHoveredCell(null);
  });

  viewport.addEventListener("click", (event) => {
    const pickedCellId = scene.pickCellAtClientPoint(event.clientX, event.clientY);
    selectedCellId = selectedCellId === pickedCellId ? null : pickedCellId;
    scene.setSelectedCell(selectedCellId);
    if (selectedCellId === null) {
      selectedStat.textContent = "none";
      terrainStat.textContent = "-";
      moistureStat.textContent = "-";
      vegetationStat.textContent = "-";
      waterAdjStat.textContent = "-";
      fertilityStat.textContent = "-";
      geologyStat.textContent = "-";
      return;
    }

    const selectedCell = cells[selectedCellId];
    const waterAdjacency = getAdjacentWaterInfluence(selectedCell, cells);
    selectedStat.textContent = `cell ${selectedCellId}`;
    terrainStat.textContent = selectedCell.terrainKind;
    moistureStat.textContent = selectedCell.moisture.toFixed(2);
    vegetationStat.textContent = selectedCell.vegetation.toFixed(2);
    waterAdjStat.textContent = waterAdjacency.toFixed(2);
    fertilityStat.textContent = selectedCell.fertility.toFixed(2);
    geologyStat.textContent = selectedCell.geology.toFixed(2);
  });

  const onResize = () => scene.resize();
  window.addEventListener("resize", onResize);

  const animate = (timestamp: number) => {
    requestAnimationFrame(animate);
    const interval = 1000 / speed;

    if (isPlaying && timestamp - lastTick >= interval) {
      syncScene(stepSimulation(cells, DEFAULT_RULE_CONFIG));
      lastTick = timestamp;
    }

    scene.render();
  };

  requestAnimationFrame(animate);

  window.addEventListener(
    "beforeunload",
    () => {
      window.removeEventListener("resize", onResize);
      scene.dispose();
    },
    { once: true }
  );
}
