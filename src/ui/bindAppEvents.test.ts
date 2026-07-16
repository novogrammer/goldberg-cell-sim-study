// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { bindAppEvents } from "./bindAppEvents";
import { createAppLayout } from "./createAppLayout";
import type { AppEventHandlers, HudState } from "./types";

function createElements() {
  const root = document.createElement("div");
  document.body.append(root);

  return createAppLayout(root, {
    cellCount: 42,
    pentagonCount: 12,
    hexagonCount: 30,
    frequency: 10,
    speed: 6
  }, {
    isPaintMode: false,
    isPlaying: true,
    autoRotate: false,
    speed: 6,
    brushTerrainKind: "land",
    selectedCellSummary: null
  } satisfies HudState);
}

function createHandlers(): AppEventHandlers {
  let isPaintMode = false;

  return {
    getIsPaintMode: vi.fn(() => isPaintMode),
    onTogglePlay: vi.fn(),
    onSetMode: vi.fn((mode) => {
      isPaintMode = mode === "paint";
    }),
    onToggleAutoRotate: vi.fn(),
    onStep: vi.fn(),
    onRandomize: vi.fn(),
    onSetBrush: vi.fn(),
    onSetSpeed: vi.fn(),
    onCanvasHover: vi.fn(),
    onCanvasLeave: vi.fn(),
    onCanvasPaintStart: vi.fn(),
    onCanvasPaintMove: vi.fn(),
    onCanvasPaintEnd: vi.fn(),
    onCanvasSelect: vi.fn(),
    onCanvasRotate: vi.fn(),
    onCanvasCameraDragChange: vi.fn(),
    onCanvasZoom: vi.fn()
  };
}

function createPointerEvent(
  type: string,
  init: { button?: number; buttons?: number; clientX?: number; clientY?: number; pointerId?: number } = {}
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    button: init.button ?? 0,
    buttons: init.buttons ?? 0,
    clientX: init.clientX ?? 0,
    clientY: init.clientY ?? 0
  });

  Object.defineProperty(event, "pointerId", { value: init.pointerId ?? 1 });
  return event;
}

function attachPointerCaptureStubs(canvas: HTMLCanvasElement) {
  let capturedPointerId: number | null = null;

  Object.assign(canvas, {
    setPointerCapture: vi.fn((pointerId: number) => {
      capturedPointerId = pointerId;
    }),
    releasePointerCapture: vi.fn((pointerId: number) => {
      if (capturedPointerId === pointerId) {
        capturedPointerId = null;
      }
    }),
    hasPointerCapture: vi.fn((pointerId: number) => capturedPointerId === pointerId)
  });
}

describe("bindAppEvents", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("button, select, range の操作を対応 handler に配線する", () => {
    const elements = createElements();
    const canvas = document.createElement("canvas");
    attachPointerCaptureStubs(canvas);
    document.body.append(canvas);
    const handlers = createHandlers();
    const cleanup = bindAppEvents(elements, canvas, handlers);

    elements.toggleButton.click();
    elements.viewModeButton.click();
    elements.paintModeButton.click();
    elements.rotateButton.click();
    elements.stepButton.click();
    elements.randomizeButton.click();
    elements.brushSelect.value = "water";
    elements.brushSelect.dispatchEvent(new Event("change", { bubbles: true }));
    elements.speedSlider.value = "11";
    elements.speedSlider.dispatchEvent(new Event("input", { bubbles: true }));

    expect(handlers.onTogglePlay).toHaveBeenCalledTimes(1);
    expect(handlers.onSetMode).toHaveBeenNthCalledWith(1, "view");
    expect(handlers.onSetMode).toHaveBeenNthCalledWith(2, "paint");
    expect(handlers.onToggleAutoRotate).toHaveBeenCalledTimes(1);
    expect(handlers.onStep).toHaveBeenCalledTimes(1);
    expect(handlers.onRandomize).toHaveBeenCalledTimes(1);
    expect(handlers.onSetBrush).toHaveBeenCalledWith("water");
    expect(handlers.onSetSpeed).toHaveBeenCalledWith(11);

    cleanup();
  });

  it("view mode の短い pointer 操作ではセル選択を発火する", () => {
    const elements = createElements();
    const canvas = document.createElement("canvas");
    attachPointerCaptureStubs(canvas);
    document.body.append(canvas);
    const handlers = createHandlers();
    const cleanup = bindAppEvents(elements, canvas, handlers);

    canvas.dispatchEvent(createPointerEvent("pointerdown", { clientX: 50, clientY: 60 }));
    canvas.dispatchEvent(createPointerEvent("pointerup", { clientX: 53, clientY: 62 }));

    expect(handlers.onCanvasSelect).toHaveBeenCalledWith(53, 62);
    expect(handlers.onCanvasPaintStart).not.toHaveBeenCalled();

    cleanup();
  });

  it("view mode の大きいドラッグではセル選択を発火しない", () => {
    const elements = createElements();
    const canvas = document.createElement("canvas");
    attachPointerCaptureStubs(canvas);
    document.body.append(canvas);
    const handlers = createHandlers();
    const cleanup = bindAppEvents(elements, canvas, handlers);

    canvas.dispatchEvent(createPointerEvent("pointerdown", { clientX: 10, clientY: 10 }));
    canvas.dispatchEvent(createPointerEvent("pointerup", { clientX: 30, clientY: 30 }));

    expect(handlers.onCanvasSelect).not.toHaveBeenCalled();

    cleanup();
  });

  it("view mode のドラッグとホイールをカメラ handler へ渡す", () => {
    const elements = createElements();
    const canvas = document.createElement("canvas");
    attachPointerCaptureStubs(canvas);
    document.body.append(canvas);
    const handlers = createHandlers();
    const cleanup = bindAppEvents(elements, canvas, handlers);

    canvas.dispatchEvent(createPointerEvent("pointerdown", { clientX: 10, clientY: 10, buttons: 1 }));
    canvas.dispatchEvent(createPointerEvent("pointermove", { clientX: 20, clientY: 14, buttons: 1 }));
    canvas.dispatchEvent(createPointerEvent("pointermove", { clientX: 27, clientY: 19, buttons: 1 }));
    canvas.dispatchEvent(createPointerEvent("pointerup", { clientX: 27, clientY: 19 }));
    canvas.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 120 }));

    expect(handlers.onCanvasRotate).toHaveBeenCalledWith(7, 5);
    expect(handlers.onCanvasCameraDragChange).toHaveBeenNthCalledWith(1, true);
    expect(handlers.onCanvasCameraDragChange).toHaveBeenNthCalledWith(2, false);
    expect(handlers.onCanvasZoom).toHaveBeenCalledWith(120);
    expect(handlers.onCanvasSelect).not.toHaveBeenCalled();

    cleanup();
  });

  it("paint mode の pointer 操作では paint handler 群を発火する", () => {
    const elements = createElements();
    const canvas = document.createElement("canvas");
    attachPointerCaptureStubs(canvas);
    document.body.append(canvas);
    const handlers = createHandlers();
    const cleanup = bindAppEvents(elements, canvas, handlers);

    elements.paintModeButton.click();
    canvas.dispatchEvent(createPointerEvent("pointerdown", { clientX: 15, clientY: 25, buttons: 1 }));
    canvas.dispatchEvent(createPointerEvent("pointermove", { clientX: 20, clientY: 30, buttons: 1 }));
    canvas.dispatchEvent(createPointerEvent("pointerup", { clientX: 20, clientY: 30, buttons: 0 }));

    expect(handlers.onCanvasPaintStart).toHaveBeenCalledWith(15, 25);
    expect(handlers.onCanvasPaintMove).toHaveBeenCalledWith(20, 30);
    expect(handlers.onCanvasPaintEnd).toHaveBeenCalled();
    expect(handlers.onCanvasSelect).not.toHaveBeenCalled();

    cleanup();
  });

  it("外部で変更された paint mode を次の pointer 操作から参照する", () => {
    const elements = createElements();
    const canvas = document.createElement("canvas");
    attachPointerCaptureStubs(canvas);
    document.body.append(canvas);
    const handlers = createHandlers();
    handlers.getIsPaintMode = vi.fn(() => true);
    const cleanup = bindAppEvents(elements, canvas, handlers);

    canvas.dispatchEvent(createPointerEvent("pointerdown", {
      clientX: 15,
      clientY: 25,
      buttons: 1
    }));
    canvas.dispatchEvent(createPointerEvent("pointerup", {
      clientX: 15,
      clientY: 25,
      buttons: 0
    }));

    expect(handlers.onCanvasPaintStart).toHaveBeenCalledWith(15, 25);
    expect(handlers.onCanvasSelect).not.toHaveBeenCalled();

    cleanup();
  });
});
