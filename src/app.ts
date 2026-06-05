import "./style.css";

import { createSimulationScene } from "./render/scene";
import { createGoldbergMesh, randomizeCellState } from "./sim/goldberg";
import { DEFAULT_RULE_CONFIG, stepSimulation } from "./sim/simulation";
import type { Cell } from "./types";

export function mountApp(root: HTMLElement): void {
  const meshData = createGoldbergMesh();
  let cells = randomizeCellState(meshData.cells);
  let speed = 6;
  let isPlaying = true;
  let lastTick = 0;

  root.innerHTML = `
    <div class="app-shell">
      <div class="hud">
        <div>
          <p class="eyebrow">Goldberg Polyhedron Cell Simulation</p>
          <h1>42 cells, 12 pentagons, neighbor-average updates</h1>
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
          <div><dt>Cells</dt><dd data-stat="cells">${cells.length}</dd></div>
          <div><dt>Pentagons</dt><dd data-stat="pentagons">${meshData.pentagonCount}</dd></div>
          <div><dt>Hexagons</dt><dd data-stat="hexagons">${meshData.hexagonCount}</dd></div>
          <div><dt>Rule</dt><dd>Neighbor average</dd></div>
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

  if (!toggleButton || !stepButton || !randomizeButton || !speedSlider) {
    throw new Error("Control elements were not created.");
  }

  const syncScene = (nextCells: Cell[]) => {
    cells = nextCells;
    scene.updateCells(cells);
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
