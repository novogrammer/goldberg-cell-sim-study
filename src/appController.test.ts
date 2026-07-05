// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { AppController, buildAppHudState, createInitialAppState } from "./appController";
import { createGoldbergMesh } from "./sim/goldberg";
import { createAppLayout } from "./ui/createAppLayout";
import type { SimulationView } from "./render/createSimulationView";

function createCells() {
  const mesh = createGoldbergMesh(1);
  const cells = mesh.cells.map((cell) => ({
    ...cell,
    terrainKind: "land" as "land" | "water",
    moisture: 0,
    nextMoisture: 0,
    vegetation: 0,
    nextVegetation: 0,
    state: 0,
    nextState: 0,
    fertility: cell.baseFertility
  }));

  cells[1] = {
    ...cells[1],
    terrainKind: "water",
    moisture: 1,
    nextMoisture: 1
  };

  return { cells, mesh };
}

function createElements(cells = createCells().cells) {
  const root = document.createElement("div");
  document.body.append(root);
  const initialState = createInitialAppState(cells);

  const elements = createAppLayout(root, {
    cellCount: cells.length,
    pentagonCount: 12,
    hexagonCount: cells.length - 12,
    frequency: 1,
    speed: initialState.speed
  }, buildAppHudState(initialState));

  return { elements, initialState };
}

function createFakeView() {
  let pickResult: number | null = 0;

  const view: Pick<
    SimulationView,
    | "clearHoveredCell"
    | "getCameraPosition"
    | "getInteractiveCanvasPoint"
    | "pickCellAtClientPoint"
    | "render"
    | "rotateCameraByPixels"
    | "setAutoRotate"
    | "setControlsEnabled"
    | "setHoveredFromClientPoint"
    | "setSelectedCell"
    | "syncCameraImmediately"
    | "syncCells"
    | "zoomCameraByDelta"
  > = {
    clearHoveredCell: vi.fn(),
    getCameraPosition: vi.fn<() => [number, number, number]>(() => [0, 0, 5]),
    getInteractiveCanvasPoint: vi.fn(() => null),
    pickCellAtClientPoint: vi.fn(() => pickResult),
    render: vi.fn(),
    rotateCameraByPixels: vi.fn(),
    setAutoRotate: vi.fn(),
    setControlsEnabled: vi.fn(),
    setHoveredFromClientPoint: vi.fn(),
    setSelectedCell: vi.fn(),
    syncCameraImmediately: vi.fn(),
    syncCells: vi.fn(),
    zoomCameraByDelta: vi.fn()
  };

  return {
    view,
    setPickResult(nextPickResult: number | null) {
      pickResult = nextPickResult;
    }
  };
}

describe("AppController", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("play/pause toggle で HUD を切り替える", () => {
    const { cells, mesh } = createCells();
    const { elements, initialState } = createElements(cells);
    const { view } = createFakeView();
    const controller = new AppController({ elements, initialState, meshData: mesh, view });

    controller.onTogglePlay();
    expect(elements.toggleButton.textContent).toBe("Play");

    controller.onTogglePlay();
    expect(elements.toggleButton.textContent).toBe("Pause");
  });

  it("auto rotate toggle で view 呼び出しと HUD を同期する", () => {
    const { cells, mesh } = createCells();
    const { elements, initialState } = createElements(cells);
    const { view } = createFakeView();
    const controller = new AppController({ elements, initialState, meshData: mesh, view });

    controller.onToggleAutoRotate();

    expect(view.setAutoRotate).toHaveBeenCalledWith(true);
    expect(elements.rotateButton.textContent).toBe("Stop Rotation");
    expect(elements.rotationStateStat.textContent).toBe("Auto drift on");
  });

  it("mode 切り替えで controls と HUD を同期する", () => {
    const { cells, mesh } = createCells();
    const { elements, initialState } = createElements(cells);
    const { view } = createFakeView();
    const controller = new AppController({ elements, initialState, meshData: mesh, view });

    controller.onSetMode("paint");

    expect(view.setControlsEnabled).toHaveBeenCalledWith(false);
    expect(elements.appShell.dataset.mode).toBe("paint");
    expect(elements.cameraStateStat.textContent).toBe("Locked");
    expect(elements.toggleButton.disabled).toBe(true);

    controller.onSetMode("view");

    expect(view.setControlsEnabled).toHaveBeenLastCalledWith(true);
    expect(elements.appShell.dataset.mode).toBe("view");
    expect(elements.toggleButton.disabled).toBe(false);
  });

  it("selection で view 選択と summary を同期する", () => {
    const { cells, mesh } = createCells();
    const { elements, initialState } = createElements(cells);
    const fakeView = createFakeView();
    fakeView.setPickResult(0);
    const controller = new AppController({ elements, initialState, meshData: mesh, view: fakeView.view });

    controller.onCanvasSelect(100, 120);

    expect(fakeView.view.setSelectedCell).toHaveBeenCalledWith(0);
    expect(elements.selectedStat.textContent).toBe("cell 0");
    expect(elements.terrainStat.textContent).toBe("land");
  });

  it("brush と paint で terrain と HUD 表示を更新する", () => {
    const { cells, mesh } = createCells();
    const { elements, initialState } = createElements(cells);
    const fakeView = createFakeView();
    fakeView.setPickResult(0);
    const controller = new AppController({ elements, initialState, meshData: mesh, view: fakeView.view });

    controller.onSetMode("paint");
    controller.onSetBrush("water");
    controller.onCanvasPaintStart(10, 20);

    expect(fakeView.view.syncCells).toHaveBeenCalled();
    expect(fakeView.view.setSelectedCell).toHaveBeenCalledWith(0);
    expect(elements.terrainStat.textContent).toBe("water");
    expect(controller.getCellTerrainKind(0)).toBe("water");
  });

  it("drag paint で複数セル更新と同一セルの再計算抑制を両立する", () => {
    const { cells, mesh } = createCells();
    const { elements, initialState } = createElements(cells);
    const fakeView = createFakeView();
    const picks = [0, 0, 2];
    fakeView.view.pickCellAtClientPoint = vi.fn(() => picks.shift() ?? null);
    const controller = new AppController({ elements, initialState, meshData: mesh, view: fakeView.view });

    controller.onSetMode("paint");
    controller.onSetBrush("land");
    controller.onCanvasPaintStart(10, 10);
    controller.onCanvasPaintMove(11, 11);
    controller.onCanvasPaintMove(12, 12);
    controller.onCanvasPaintEnd();

    expect(fakeView.view.syncCells).toHaveBeenCalledTimes(2);
    expect(controller.getCellTerrainKind(0)).toBe("land");
    expect(controller.getCellTerrainKind(2)).toBe("land");
    expect(elements.selectedStat.textContent).toBe("cell 2");
  });
});
