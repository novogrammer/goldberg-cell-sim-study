import "./style.css";

import { AppController, buildAppHudState, createInitialAppState } from "./appController";
import { createSimulationView } from "./render/createSimulationView";
import { createGoldbergMesh, randomizeCellState } from "./sim/goldberg";
import { bindAppEvents } from "./ui/bindAppEvents";
import { buildSelectedCellSummary } from "./ui/buildSelectedCellSummary";
import { createAppLayout } from "./ui/createAppLayout";
import type { Cell } from "./types";

const DISPLAY_FREQUENCY = 10;
const APP_READY_ATTRIBUTE = "data-goldberg-app-ready";
const APP_INIT_ERROR_ATTRIBUTE = "data-goldberg-app-init-error";
const APP_BOOTSTRAP_STAGE_ATTRIBUTE = "data-goldberg-bootstrap-stage";
const APP_CAMERA_X_ATTRIBUTE = "data-goldberg-camera-x";
const APP_CAMERA_Y_ATTRIBUTE = "data-goldberg-camera-y";
const APP_CAMERA_Z_ATTRIBUTE = "data-goldberg-camera-z";

declare global {
  interface Window {
    __goldbergBootstrapHistory?: string[];
    __goldbergBootstrapStage?: string;
    __goldbergAppInitError?: string;
    __goldbergAppReady?: boolean;
    __goldbergTestState?: {
      setPlaybackState: (isPlaying: boolean) => void;
      setAutoRotateEnabled: (enabled: boolean) => void;
      getCameraPosition: () => [number, number, number];
      rotateCameraByPixels: (deltaX: number, deltaY: number) => void;
      zoomCameraByDelta: (deltaY: number) => void;
      getInteractiveCanvasPoint: () => { x: number; y: number; cellId: number } | null;
      setPaintMode: (enabled: boolean) => void;
      setBrushTerrainKind: (terrainKind: Cell["terrainKind"]) => void;
      paintStroke: (points: Array<{ x: number; y: number }>) => void;
      getSelectedCellSummary: () => ReturnType<typeof buildSelectedCellSummary>;
      getCellTerrainKind: (cellId: number) => Cell["terrainKind"] | null;
    };
  }
}

export function mountApp(root: HTMLElement): () => void {
  const meshData = createGoldbergMesh(DISPLAY_FREQUENCY);
  const initialState = createInitialAppState(randomizeCellState(meshData.cells));

  const elements = createAppLayout(root, {
    cellCount: initialState.cells.length,
    pentagonCount: meshData.pentagonCount,
    hexagonCount: meshData.hexagonCount,
    frequency: meshData.frequency,
    speed: initialState.speed
  }, buildAppHudState(initialState));

  const view = createSimulationView(elements.viewport, meshData, initialState.cells);

  const setBootstrapStage = (stage: string) => {
    window.__goldbergBootstrapStage = stage;
    window.__goldbergBootstrapHistory ??= [];
    window.__goldbergBootstrapHistory.push(stage);
    document.documentElement.setAttribute(APP_BOOTSTRAP_STAGE_ATTRIBUTE, stage);
  };

  const setAppStatusAttributes = (status: "booting" | "ready" | "init-error") => {
    if (status === "ready") {
      document.documentElement.setAttribute(APP_READY_ATTRIBUTE, "true");
      document.documentElement.removeAttribute(APP_INIT_ERROR_ATTRIBUTE);
      return;
    }

    document.documentElement.setAttribute(APP_READY_ATTRIBUTE, "false");
    if (status === "booting") {
      document.documentElement.removeAttribute(APP_INIT_ERROR_ATTRIBUTE);
      return;
    }

    document.documentElement.setAttribute(APP_INIT_ERROR_ATTRIBUTE, "true");
  };

  let lastCameraTelemetry: [string, string, string] | null = null;

  const writeCameraTelemetry = () => {
    const [x, y, z] = view.getCameraPosition();
    const nextTelemetry: [string, string, string] = [
      x.toFixed(4),
      y.toFixed(4),
      z.toFixed(4)
    ];

    if (
      lastCameraTelemetry &&
      lastCameraTelemetry[0] === nextTelemetry[0] &&
      lastCameraTelemetry[1] === nextTelemetry[1] &&
      lastCameraTelemetry[2] === nextTelemetry[2]
    ) {
      return;
    }

    document.documentElement.setAttribute(APP_CAMERA_X_ATTRIBUTE, nextTelemetry[0]);
    document.documentElement.setAttribute(APP_CAMERA_Y_ATTRIBUTE, nextTelemetry[1]);
    document.documentElement.setAttribute(APP_CAMERA_Z_ATTRIBUTE, nextTelemetry[2]);
    lastCameraTelemetry = nextTelemetry;
  };

  let isDisposed = false;
  let cleanupEvents = () => { };
  let isBootstrapped = false;
  const onResize = () => view.resize();
  const controller = new AppController({
    elements,
    initialState,
    meshData,
    view,
    onAfterRender: writeCameraTelemetry
  });
  window.__goldbergBootstrapHistory = [];
  setBootstrapStage("bootstrap-started");
  delete window.__goldbergAppInitError;
  window.__goldbergAppReady = false;
  setAppStatusAttributes("booting");

  const bootstrap = async () => {
    try {
      setBootstrapStage("whenReady-waiting");
      await view.whenReady();
      setBootstrapStage("whenReady-resolved");
      if (isDisposed) {
        setBootstrapStage("disposed-before-bootstrap-complete");
        return;
      }

      view.setAutoRotate(false);
      setBootstrapStage("auto-rotate-configured");

      cleanupEvents = bindAppEvents(elements, view.canvasElement, {
        onTogglePlay: () => controller.onTogglePlay(),
        onSetMode: (mode) => controller.onSetMode(mode),
        onToggleAutoRotate: () => controller.onToggleAutoRotate(),
        onStep: () => controller.onStep(),
        onRandomize: () => controller.onRandomize(),
        onSetBrush: (terrainKind) => controller.onSetBrush(terrainKind),
        onSetSpeed: (nextSpeed) => controller.onSetSpeed(nextSpeed),
        onCanvasHover: (clientX, clientY) => controller.onCanvasHover(clientX, clientY),
        onCanvasLeave: () => controller.onCanvasLeave(),
        onCanvasPaintStart: (clientX, clientY) => controller.onCanvasPaintStart(clientX, clientY),
        onCanvasPaintMove: (clientX, clientY) => controller.onCanvasPaintMove(clientX, clientY),
        onCanvasPaintEnd: () => controller.onCanvasPaintEnd(),
        onCanvasSelect: (clientX, clientY) => controller.onCanvasSelect(clientX, clientY)
      });
      setBootstrapStage("events-bound");

      window.__goldbergTestState = {
        setPlaybackState: (isPlaying) => controller.setPlaybackState(isPlaying),
        setAutoRotateEnabled: (enabled) => controller.setAutoRotateEnabled(enabled),
        getCameraPosition: () => controller.getCameraPosition(),
        rotateCameraByPixels: (deltaX, deltaY) => controller.rotateCameraByPixels(deltaX, deltaY),
        zoomCameraByDelta: (deltaY) => controller.zoomCameraByDelta(deltaY),
        getInteractiveCanvasPoint: () => controller.getInteractiveCanvasPoint(),
        setPaintMode: (enabled) => controller.setPaintMode(enabled),
        setBrushTerrainKind: (terrainKind) => controller.setBrushTerrainKind(terrainKind),
        paintStroke: (points) => controller.paintStroke(points),
        getSelectedCellSummary: () => controller.getSelectedCellSummary(),
        getCellTerrainKind: (cellId) => controller.getCellTerrainKind(cellId)
      };
      setBootstrapStage("test-state-published");

      window.addEventListener("resize", onResize);
      setBootstrapStage("resize-listener-bound");
      isBootstrapped = true;
      writeCameraTelemetry();
      delete window.__goldbergAppInitError;
      window.__goldbergAppReady = true;
      setAppStatusAttributes("ready");
      setBootstrapStage("ready");
      await view.setAnimationLoop((timestamp) => {
        if (isDisposed) {
          return;
        }
        controller.animate(timestamp);
      });
      setBootstrapStage("animation-loop-started");
    } catch (error) {
      setBootstrapStage("init-error");
      window.__goldbergAppInitError = error instanceof Error ? error.stack ?? error.message : String(error);
      window.__goldbergAppReady = false;
      setAppStatusAttributes("init-error");
      console.error("Failed to initialize simulation view.", error);
    }
  };

  void bootstrap();

  return () => {
    if (isDisposed) {
      return;
    }

    isDisposed = true;
    setBootstrapStage("disposed");
    delete window.__goldbergAppInitError;
    window.__goldbergAppReady = false;
    document.documentElement.removeAttribute(APP_READY_ATTRIBUTE);
    document.documentElement.removeAttribute(APP_INIT_ERROR_ATTRIBUTE);
    document.documentElement.removeAttribute(APP_CAMERA_X_ATTRIBUTE);
    document.documentElement.removeAttribute(APP_CAMERA_Y_ATTRIBUTE);
    document.documentElement.removeAttribute(APP_CAMERA_Z_ATTRIBUTE);
    if (isBootstrapped) {
      void view.setAnimationLoop(null);
      cleanupEvents();
      window.removeEventListener("resize", onResize);
    }
    delete window.__goldbergTestState;
    view.dispose();
  };
}
