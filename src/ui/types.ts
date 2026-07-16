import type { Cell } from "../types";

export interface SelectedCellSummary {
  cellId: number;
  terrainKind: Cell["terrainKind"];
  moisture: string;
  vegetation: string;
  waterAdjacency: string;
  fertility: string;
  geology: string;
}

export interface HudState {
  isPaintMode: boolean;
  isPlaying: boolean;
  autoRotate: boolean;
  speed: number;
  brushTerrainKind: Cell["terrainKind"];
  selectedCellSummary: SelectedCellSummary | null;
}

export interface AppElements {
  appShell: HTMLElement;
  viewport: HTMLElement;
  toggleButton: HTMLButtonElement;
  viewModeButton: HTMLButtonElement;
  rotateButton: HTMLButtonElement;
  paintModeButton: HTMLButtonElement;
  stepButton: HTMLButtonElement;
  randomizeButton: HTMLButtonElement;
  brushSelect: HTMLSelectElement;
  speedSlider: HTMLInputElement;
  simulationPanel: HTMLElement;
  viewportSelectionCard: HTMLElement;
  selectedStat: HTMLElement;
  toolModeStat: HTMLElement;
  toolModeDetailStat: HTMLElement;
  cameraStateStat: HTMLElement;
  brushStateStat: HTMLElement;
  rotationStateStat: HTMLElement;
  paintStateStat: HTMLElement;
  selectionStateStat: HTMLElement;
  viewportHintStat: HTMLElement;
  terrainStat: HTMLElement;
  moistureStat: HTMLElement;
  vegetationStat: HTMLElement;
  waterAdjStat: HTMLElement;
  fertilityStat: HTMLElement;
  geologyStat: HTMLElement;
}

export interface AppEventHandlers {
  getIsPaintMode: () => boolean;
  onTogglePlay: () => void;
  onSetMode: (mode: "view" | "paint") => void;
  onToggleAutoRotate: () => void;
  onStep: () => void;
  onRandomize: () => void;
  onSetBrush: (terrainKind: Cell["terrainKind"]) => void;
  onSetSpeed: (speed: number) => void;
  onCanvasHover: (clientX: number, clientY: number) => void;
  onCanvasLeave: () => void;
  onCanvasPaintStart: (clientX: number, clientY: number) => void;
  onCanvasPaintMove: (clientX: number, clientY: number) => void;
  onCanvasPaintEnd: () => void;
  onCanvasSelect: (clientX: number, clientY: number) => void;
  onCanvasRotate: (deltaX: number, deltaY: number) => void;
  onCanvasCameraDragChange: (isDragging: boolean) => void;
  onCanvasZoom: (deltaY: number) => void;
}
