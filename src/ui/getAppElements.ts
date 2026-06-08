import type { AppElements } from "./types";

export function getAppElements(root: HTMLElement): AppElements {
  const appShell = root.querySelector<HTMLElement>(".app-shell");
  const viewport = root.querySelector<HTMLElement>("[data-role='viewport']");
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
    !appShell ||
    !viewport ||
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

  return {
    appShell,
    viewport,
    toggleButton,
    viewModeButton,
    rotateButton,
    paintModeButton,
    stepButton,
    randomizeButton,
    brushSelect,
    terrainSelect,
    speedSlider,
    modePanel,
    simulationPanel,
    cameraPanel,
    paintPanel,
    selectionPanel,
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
    viewportSelectionStat,
    terrainStat,
    moistureStat,
    vegetationStat,
    waterAdjStat,
    fertilityStat,
    geologyStat
  };
}
