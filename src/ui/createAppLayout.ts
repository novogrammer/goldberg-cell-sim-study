import type { AppElements } from "./types";
import type { HudState } from "./types";
import { updateHud } from "./updateHud";

interface AppLayoutData {
  cellCount: number;
  pentagonCount: number;
  hexagonCount: number;
  frequency: number;
  speed: number;
}

export function createAppLayout(
  root: HTMLElement,
  data: AppLayoutData,
  initialHudState: HudState
): AppElements {
  root.innerHTML = `
    <div class="app-shell" data-mode="view">
      <div class="hud">
        <div class="hero-block">
          <p class="eyebrow">Goldberg Polyhedron Cell Simulation</p>
          <h1>Water basins drive vegetation across the planet</h1>
          <p class="hero-copy">
            Orbit the planet, then paint water or land directly on the sphere.
          </p>
          <a
            class="hero-link"
            href="https://github.com/novogrammer/goldberg-cell-sim-study"
            target="_blank"
            rel="noreferrer"
          >
            View Source on GitHub
          </a>
        </div>
        <section class="panel panel-mode" data-panel="mode">
          <div class="panel-header">
            <div>
              <p class="panel-eyebrow">Mode</p>
              <h2 data-stat="mode-label"></h2>
            </div>
            <span class="mode-badge" data-stat="mode-badge"></span>
          </div>
          <p class="panel-copy" data-stat="mode-detail"></p>
          <div class="segmented" role="group" aria-label="Mode switch">
            <button type="button" data-action="view-mode" aria-pressed="true">View</button>
            <button type="button" data-action="paint-mode" aria-pressed="false">Paint</button>
          </div>
          <div class="state-row">
            <span class="state-chip" data-stat="camera-state"></span>
            <span class="state-chip" data-stat="brush-state"></span>
          </div>
        </section>

        <section class="panel panel-paint" data-panel="paint">
          <div class="panel-header">
            <div>
              <p class="panel-eyebrow">Paint</p>
              <h2>Brush</h2>
            </div>
            <span class="panel-status" data-stat="paint-state"></span>
          </div>
          <p class="panel-copy">
            Paint mode changes how the sphere responds. Pick the active terrain, then click or drag directly on the planet.
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
            <label>
              <span>Steps / sec</span>
              <input type="range" min="1" max="24" step="1" value="${data.speed}" data-action="speed" />
            </label>
          </div>
          <dl class="stat-grid stat-grid-compact">
            <div><dt>Rule</dt><dd>Water + vegetation locality</dd></div>
            <div><dt>Cells</dt><dd data-stat="cells">${data.cellCount}</dd></div>
            <div><dt>Pentagons</dt><dd data-stat="pentagons">${data.pentagonCount}</dd></div>
            <div><dt>Hexagons</dt><dd data-stat="hexagons">${data.hexagonCount}</dd></div>
            <div><dt>Frequency</dt><dd data-stat="frequency">${data.frequency}</dd></div>
          </dl>
        </section>

        <section class="panel" data-panel="camera">
          <div class="panel-header">
            <div>
              <p class="panel-eyebrow">Camera</p>
              <h2>Movement</h2>
            </div>
            <span class="panel-status" data-stat="rotation-state"></span>
          </div>
          <div class="controls">
            <button type="button" data-action="rotate"></button>
          </div>
        </section>
      </div>
      <div class="viewport-frame">
        <div class="viewport-overlay" aria-hidden="true">
          <div class="viewport-guide">
            <span class="viewport-guide-badge" data-stat="viewport-mode"></span>
            <p class="viewport-guide-text" data-stat="viewport-hint"></p>
          </div>
          <div class="viewport-selection-card" data-state="empty">
            <p class="viewport-selection-title" data-stat="selection-state"></p>
            <dl class="viewport-selection-grid">
              <div><dt>Selected</dt><dd data-stat="selected"></dd></div>
              <div><dt>Terrain</dt><dd data-stat="terrain"></dd></div>
              <div><dt>Moisture</dt><dd data-stat="moisture"></dd></div>
              <div><dt>Vegetation</dt><dd data-stat="vegetation"></dd></div>
              <div><dt>Water Adj.</dt><dd data-stat="water-adj"></dd></div>
              <div><dt>Fertility</dt><dd data-stat="fertility"></dd></div>
              <div><dt>Geology</dt><dd data-stat="geology"></dd></div>
            </dl>
          </div>
        </div>
        <div class="viewport" data-role="viewport"></div>
      </div>
    </div>
  `;

  const appShell = root.querySelector<HTMLElement>(".app-shell");
  const viewport = root.querySelector<HTMLElement>("[data-role='viewport']");
  const toggleButton = root.querySelector<HTMLButtonElement>("[data-action='toggle']");
  const viewModeButton = root.querySelector<HTMLButtonElement>("[data-action='view-mode']");
  const rotateButton = root.querySelector<HTMLButtonElement>("[data-action='rotate']");
  const paintModeButton = root.querySelector<HTMLButtonElement>("[data-action='paint-mode']");
  const stepButton = root.querySelector<HTMLButtonElement>("[data-action='step']");
  const randomizeButton = root.querySelector<HTMLButtonElement>("[data-action='randomize']");
  const brushSelect = root.querySelector<HTMLSelectElement>("[data-action='brush']");
  const speedSlider = root.querySelector<HTMLInputElement>("[data-action='speed']");
  const modePanel = root.querySelector<HTMLElement>("[data-panel='mode']");
  const simulationPanel = root.querySelector<HTMLElement>("[data-panel='simulation']");
  const cameraPanel = root.querySelector<HTMLElement>("[data-panel='camera']");
  const paintPanel = root.querySelector<HTMLElement>("[data-panel='paint']");
  const viewportSelectionCard = root.querySelector<HTMLElement>(".viewport-selection-card");
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
  const terrainStat = root.querySelector<HTMLElement>("[data-stat='terrain']");
  const moistureStat = root.querySelector<HTMLElement>("[data-stat='moisture']");
  const vegetationStat = root.querySelector<HTMLElement>("[data-stat='vegetation']");
  const waterAdjStat = root.querySelector<HTMLElement>("[data-stat='water-adj']");
  const fertilityStat = root.querySelector<HTMLElement>("[data-stat='fertility']");
  const geologyStat = root.querySelector<HTMLElement>("[data-stat='geology']");

  if (
    !appShell ||
    !viewport ||
    !toggleButton ||
    !viewModeButton ||
    !rotateButton ||
    !paintModeButton ||
    !stepButton ||
    !randomizeButton ||
    !brushSelect ||
    !speedSlider ||
    !modePanel ||
    !simulationPanel ||
    !cameraPanel ||
    !paintPanel ||
    !viewportSelectionCard ||
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
    !terrainStat ||
    !moistureStat ||
    !vegetationStat ||
    !waterAdjStat ||
    !fertilityStat ||
    !geologyStat
  ) {
    throw new Error("Control elements were not created.");
  }

  const elements = {
    appShell,
    viewport,
    toggleButton,
    viewModeButton,
    rotateButton,
    paintModeButton,
    stepButton,
    randomizeButton,
    brushSelect,
    speedSlider,
    modePanel,
    simulationPanel,
    cameraPanel,
    paintPanel,
    viewportSelectionCard,
    selectedStat,
    modeLabelStat,
    modeBadgeStat,
    modeDetailStat,
    cameraStateStat,
    brushStateStat,
    rotationStateStat,
    paintStateStat,
    selectionStateStat,
    viewportModeStat,
    viewportHintStat,
    terrainStat,
    moistureStat,
    vegetationStat,
    waterAdjStat,
    fertilityStat,
    geologyStat
  };

  updateHud(elements, initialHudState);
  return elements;
}
