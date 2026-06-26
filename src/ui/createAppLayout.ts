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
          <p class="eyebrow">Planetary Cell Study</p>
          <h1>Shape rivers. Watch biomes spread.</h1>
          <p class="hero-copy">
            Orbit the sphere, repaint terrain, and inspect how local water conditions reshape each cell.
          </p>
          <dl class="hero-stats" aria-label="Mesh summary">
            <div>
              <dt>Cells</dt>
              <dd data-stat="cells">${data.cellCount}</dd>
            </div>
            <div>
              <dt>Pentagons</dt>
              <dd data-stat="pentagons">${data.pentagonCount}</dd>
            </div>
            <div>
              <dt>Frequency</dt>
              <dd data-stat="frequency">${data.frequency}</dd>
            </div>
          </dl>
          <a
            class="hero-link"
            href="https://github.com/novogrammer/goldberg-cell-sim-study"
            target="_blank"
            rel="noreferrer"
          >
            View Source on GitHub
          </a>
        </div>
        <section class="panel" data-panel="simulation">
          <div class="panel-header">
            <div>
              <p class="panel-eyebrow">Active Tools</p>
              <h2>Planet Tools</h2>
            </div>
          </div>
          <p class="panel-copy">
            Keep the scene playable, then open the mesh details only when you need the topology.
          </p>
          <div class="controls">
            <button type="button" data-action="toggle">Pause</button>
            <button type="button" data-action="step">Step</button>
            <button type="button" data-action="randomize">Randomize</button>
            <label>
              <span>Steps / sec</span>
              <input type="range" min="1" max="24" step="1" value="${data.speed}" data-action="speed" />
            </label>
          </div>
          <details class="details-panel">
            <summary>Mesh details</summary>
            <dl class="stat-grid stat-grid-compact">
              <div><dt>Rule</dt><dd>Water + vegetation locality</dd></div>
              <div><dt>Hexagons</dt><dd data-stat="hexagons">${data.hexagonCount}</dd></div>
            </dl>
          </details>
        </section>
      </div>
      <div class="viewport-frame">
        <div class="viewport-overlay">
          <div class="viewport-overlay-top">
            <section class="overlay-card overlay-tool">
              <div class="overlay-card-header">
                <div>
                  <p class="overlay-eyebrow">Mode</p>
                  <h2 data-stat="tool-mode"></h2>
                </div>
                <span class="overlay-badge" data-stat="paint-state"></span>
              </div>
              <div class="overlay-section">
                <div class="segmented" role="group" aria-label="Mode switch">
                  <button type="button" data-action="view-mode" aria-pressed="true">View</button>
                  <button type="button" data-action="paint-mode" aria-pressed="false">Paint</button>
                </div>
                <p class="overlay-copy" data-stat="tool-mode-detail"></p>
              </div>
              <div class="overlay-section">
                <div class="overlay-section-header">
                  <span class="overlay-label">Paint</span>
                  <span class="overlay-value" data-stat="brush-state"></span>
                </div>
                <label class="overlay-field">
                  <span>Brush</span>
                  <select data-action="brush">
                    <option value="land">land</option>
                    <option value="water">water</option>
                  </select>
                </label>
              </div>
            </section>
            <section class="overlay-card overlay-viewport-status">
              <div class="overlay-card-header">
                <div>
                  <p class="overlay-eyebrow">Camera</p>
                  <h2>Orbit</h2>
                </div>
                <span class="overlay-badge" data-stat="camera-state"></span>
              </div>
              <div class="overlay-section">
                <span class="overlay-value" data-stat="rotation-state"></span>
                <button type="button" class="overlay-button" data-action="rotate"></button>
                <p class="overlay-copy" data-stat="viewport-hint"></p>
              </div>
            </section>
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
  const simulationPanel = root.querySelector<HTMLElement>("[data-panel='simulation']");
  const viewportSelectionCard = root.querySelector<HTMLElement>(".viewport-selection-card");
  const selectedStat = root.querySelector<HTMLElement>("[data-stat='selected']");
  const toolModeStat = root.querySelector<HTMLElement>("[data-stat='tool-mode']");
  const toolModeDetailStat = root.querySelector<HTMLElement>("[data-stat='tool-mode-detail']");
  const cameraStateStat = root.querySelector<HTMLElement>("[data-stat='camera-state']");
  const brushStateStat = root.querySelector<HTMLElement>("[data-stat='brush-state']");
  const rotationStateStat = root.querySelector<HTMLElement>("[data-stat='rotation-state']");
  const paintStateStat = root.querySelector<HTMLElement>("[data-stat='paint-state']");
  const selectionStateStat = root.querySelector<HTMLElement>("[data-stat='selection-state']");
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
    !simulationPanel ||
    !viewportSelectionCard ||
    !selectedStat ||
    !toolModeStat ||
    !toolModeDetailStat ||
    !cameraStateStat ||
    !brushStateStat ||
    !rotationStateStat ||
    !paintStateStat ||
    !selectionStateStat ||
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
    simulationPanel,
    viewportSelectionCard,
    selectedStat,
    toolModeStat,
    toolModeDetailStat,
    cameraStateStat,
    brushStateStat,
    rotationStateStat,
    paintStateStat,
    selectionStateStat,
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
