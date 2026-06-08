export interface AppLayoutData {
  cellCount: number;
  pentagonCount: number;
  hexagonCount: number;
  frequency: number;
  speed: number;
}

export function createAppLayout(root: HTMLElement, data: AppLayoutData) {
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
            <span class="panel-status" data-stat="rotation-state">Auto rotate on</span>
          </div>
          <div class="controls">
            <button type="button" data-action="rotate">Stop Rotation</button>
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
}
