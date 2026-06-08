import type { AppElements, HudState } from "./types";

export function updateHud(elements: AppElements, hudState: HudState) {
  const {
    isPaintMode,
    isPlaying,
    autoRotate,
    speed,
    brushTerrainKind,
    selectedCellSummary
  } = hudState;

  elements.appShell.dataset.mode = isPaintMode ? "paint" : "view";
  elements.modeLabelStat.textContent = isPaintMode ? "Paint mode" : "View mode";
  elements.modeBadgeStat.textContent = isPaintMode ? "Editing terrain" : "Orbit camera";
  elements.modeDetailStat.textContent = isPaintMode
    ? "Switch the sphere into editing mode, then paint water or land directly without moving the camera."
    : "Use the sphere as a viewer: orbit, zoom, and inspect whichever cell you select.";
  elements.cameraStateStat.textContent = isPaintMode ? "Camera locked for painting" : "Camera unlocked";
  elements.brushStateStat.textContent = `Brush: ${brushTerrainKind}`;
  elements.rotationStateStat.textContent = autoRotate ? "Auto rotate on" : "Auto rotate off";
  elements.paintStateStat.textContent = isPaintMode ? "Active" : "Inactive";
  elements.viewportModeStat.textContent = isPaintMode ? "Paint mode" : "View mode";
  elements.viewportHintStat.textContent = isPaintMode
    ? `Brush ${brushTerrainKind}. Click or drag across the sphere to paint.`
    : "Drag to orbit and scroll to zoom.";
  elements.viewModeButton.setAttribute("aria-pressed", String(!isPaintMode));
  elements.paintModeButton.setAttribute("aria-pressed", String(isPaintMode));
  elements.modePanel.dataset.mode = isPaintMode ? "paint" : "view";
  elements.simulationPanel.dataset.emphasis = isPaintMode ? "muted" : "normal";
  elements.cameraPanel.dataset.emphasis = isPaintMode ? "muted" : "normal";
  elements.paintPanel.dataset.active = String(isPaintMode);
  elements.toggleButton.disabled = isPaintMode;
  elements.rotateButton.disabled = isPaintMode;
  elements.speedSlider.disabled = isPaintMode;
  elements.speedSlider.value = String(speed);
  elements.toggleButton.textContent = isPlaying ? "Pause" : "Play";
  elements.rotateButton.textContent = autoRotate ? "Stop Rotation" : "Auto Rotate";
  elements.brushSelect.value = brushTerrainKind;

  if (!selectedCellSummary) {
    elements.selectedStat.textContent = "none";
    elements.selectionStateStat.textContent = isPaintMode ? "Pick a cell or drag to paint" : "Pick a cell to inspect";
    elements.selectionPanel.dataset.emphasis = "normal";
    elements.viewportSelectionStat.textContent = isPaintMode
      ? "Pick a cell or drag across the sphere to paint terrain."
      : "Click a cell to inspect it.";
    elements.terrainStat.textContent = "-";
    elements.moistureStat.textContent = "-";
    elements.vegetationStat.textContent = "-";
    elements.waterAdjStat.textContent = "-";
    elements.fertilityStat.textContent = "-";
    elements.geologyStat.textContent = "-";
    elements.terrainSelect.disabled = true;
    return;
  }

  elements.selectedStat.textContent = `cell ${selectedCellSummary.cellId}`;
  elements.selectionStateStat.textContent = isPaintMode
    ? `Painting cell ${selectedCellSummary.cellId}`
    : `Inspecting cell ${selectedCellSummary.cellId}`;
  elements.viewportSelectionStat.textContent = `Selected cell ${selectedCellSummary.cellId} · ${selectedCellSummary.terrainKind}`;
  elements.terrainStat.textContent = selectedCellSummary.terrainKind;
  elements.moistureStat.textContent = selectedCellSummary.moisture;
  elements.vegetationStat.textContent = selectedCellSummary.vegetation;
  elements.waterAdjStat.textContent = selectedCellSummary.waterAdjacency;
  elements.fertilityStat.textContent = selectedCellSummary.fertility;
  elements.geologyStat.textContent = selectedCellSummary.geology;
  elements.terrainSelect.value = selectedCellSummary.terrainKind;
  elements.terrainSelect.disabled = false;
  elements.selectionPanel.dataset.emphasis = "active";
}
