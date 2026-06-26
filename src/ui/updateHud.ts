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
  elements.toolModeStat.textContent = isPaintMode ? "Paint" : "View";
  elements.toolModeDetailStat.textContent = isPaintMode
    ? "Brush water or land directly onto the sphere."
    : "Orbit freely, then click a cell to inspect it.";
  elements.cameraStateStat.textContent = isPaintMode ? "Locked" : "Free";
  elements.brushStateStat.textContent = `Brush: ${brushTerrainKind}`;
  elements.rotationStateStat.textContent = autoRotate ? "Auto drift on" : "Auto drift off";
  elements.paintStateStat.textContent = isPaintMode ? "Editing" : "Surveying";
  elements.viewportHintStat.textContent = isPaintMode
    ? `Brush ${brushTerrainKind}. Click or drag across the globe to repaint terrain.`
    : "Drag to orbit. Scroll to zoom.";
  elements.viewModeButton.setAttribute("aria-pressed", String(!isPaintMode));
  elements.paintModeButton.setAttribute("aria-pressed", String(isPaintMode));
  elements.toggleButton.disabled = isPaintMode;
  elements.rotateButton.disabled = isPaintMode;
  elements.speedSlider.disabled = isPaintMode;
  elements.speedSlider.value = String(speed);
  elements.toggleButton.textContent = isPlaying ? "Pause" : "Play";
  elements.rotateButton.textContent = autoRotate ? "Stop Rotation" : "Auto Rotate";
  elements.brushSelect.value = brushTerrainKind;

  if (!selectedCellSummary) {
    elements.viewportSelectionCard.dataset.state = "empty";
    elements.selectedStat.textContent = "none";
    elements.selectionStateStat.textContent = isPaintMode
      ? "Pick a cell or drag to start painting."
      : "Select a cell to inspect its local climate.";
    elements.terrainStat.textContent = "-";
    elements.moistureStat.textContent = "-";
    elements.vegetationStat.textContent = "-";
    elements.waterAdjStat.textContent = "-";
    elements.fertilityStat.textContent = "-";
    elements.geologyStat.textContent = "-";
    return;
  }

  elements.viewportSelectionCard.dataset.state = "active";
  elements.selectedStat.textContent = `cell ${selectedCellSummary.cellId}`;
  elements.selectionStateStat.textContent = isPaintMode
    ? `Painting cell ${selectedCellSummary.cellId}`
    : `Inspecting cell ${selectedCellSummary.cellId}`;
  elements.terrainStat.textContent = selectedCellSummary.terrainKind;
  elements.moistureStat.textContent = selectedCellSummary.moisture;
  elements.vegetationStat.textContent = selectedCellSummary.vegetation;
  elements.waterAdjStat.textContent = selectedCellSummary.waterAdjacency;
  elements.fertilityStat.textContent = selectedCellSummary.fertility;
  elements.geologyStat.textContent = selectedCellSummary.geology;
}
