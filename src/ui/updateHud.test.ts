// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { createAppLayout } from "./createAppLayout";
import { updateHud } from "./updateHud";
import type { HudState } from "./types";

function createTestElements(initialHudState: HudState) {
  const root = document.createElement("div");
  document.body.append(root);

  const elements = createAppLayout(root, {
    cellCount: 42,
    pentagonCount: 12,
    hexagonCount: 30,
    frequency: 10,
    speed: initialHudState.speed
  }, initialHudState);

  return { root, elements };
}

describe("updateHud", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("view mode の HUD と未選択表示を更新する", () => {
    const initialHudState: HudState = {
      isPaintMode: false,
      isPlaying: true,
      autoRotate: false,
      speed: 6,
      brushTerrainKind: "land",
      selectedCellSummary: null
    };
    const { elements } = createTestElements(initialHudState);

    updateHud(elements, initialHudState);

    expect(elements.appShell.dataset.mode).toBe("view");
    expect(elements.toolModeStat.textContent).toBe("View");
    expect(elements.cameraStateStat.textContent).toBe("Free");
    expect(elements.paintStateStat.textContent).toBe("Surveying");
    expect(elements.viewportHintStat.textContent).toBe("Drag to orbit. Scroll to zoom.");
    expect(elements.toggleButton.textContent).toBe("Pause");
    expect(elements.rotateButton.textContent).toBe("Auto Rotate");
    expect(elements.viewModeButton.getAttribute("aria-pressed")).toBe("true");
    expect(elements.paintModeButton.getAttribute("aria-pressed")).toBe("false");
    expect(elements.viewportSelectionCard.dataset.state).toBe("empty");
    expect(elements.selectedStat.textContent).toBe("none");
    expect(elements.terrainStat.textContent).toBe("-");
    expect(elements.speedSlider.disabled).toBe(false);
  });

  it("paint mode の HUD と選択中セル表示を更新する", () => {
    const initialHudState: HudState = {
      isPaintMode: true,
      isPlaying: false,
      autoRotate: true,
      speed: 9,
      brushTerrainKind: "water",
      selectedCellSummary: {
        cellId: 7,
        terrainKind: "water",
        moisture: "1.00",
        vegetation: "0.00",
        waterAdjacency: "1.00",
        fertility: "0.50",
        geology: "0.60"
      }
    };
    const { elements } = createTestElements(initialHudState);

    updateHud(elements, initialHudState);

    expect(elements.appShell.dataset.mode).toBe("paint");
    expect(elements.toolModeStat.textContent).toBe("Paint");
    expect(elements.cameraStateStat.textContent).toBe("Locked");
    expect(elements.paintStateStat.textContent).toBe("Editing");
    expect(elements.viewportHintStat.textContent).toContain("Brush water.");
    expect(elements.toggleButton.textContent).toBe("Play");
    expect(elements.rotateButton.textContent).toBe("Stop Rotation");
    expect(elements.viewModeButton.getAttribute("aria-pressed")).toBe("false");
    expect(elements.paintModeButton.getAttribute("aria-pressed")).toBe("true");
    expect(elements.toggleButton.disabled).toBe(true);
    expect(elements.rotateButton.disabled).toBe(true);
    expect(elements.speedSlider.disabled).toBe(true);
    expect(elements.speedSlider.value).toBe("9");
    expect(elements.viewportSelectionCard.dataset.state).toBe("active");
    expect(elements.selectedStat.textContent).toBe("cell 7");
    expect(elements.selectionStateStat.textContent).toBe("Painting cell 7");
    expect(elements.terrainStat.textContent).toBe("water");
  });
});
