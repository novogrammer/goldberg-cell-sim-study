import type { AppElements, AppEventHandlers } from "./types";

const CLICK_SELECTION_THRESHOLD = 6;

export function bindAppEvents(
  elements: AppElements,
  canvasElement: HTMLCanvasElement,
  handlers: AppEventHandlers
) {
  let isPaintMode = false;
  let isPointerPainting = false;
  let pointerDownClientX = 0;
  let pointerDownClientY = 0;

  const onTogglePlay = () => handlers.onTogglePlay();
  const onViewMode = () => {
    isPaintMode = false;
    isPointerPainting = false;
    handlers.onCanvasPaintEnd();
    handlers.onSetMode("view");
  };
  const onPaintMode = () => {
    isPaintMode = true;
    isPointerPainting = false;
    handlers.onCanvasPaintEnd();
    handlers.onSetMode("paint");
  };
  const onToggleAutoRotate = () => handlers.onToggleAutoRotate();
  const onStep = () => handlers.onStep();
  const onRandomize = () => handlers.onRandomize();
  const onBrushChange = () => handlers.onSetBrush(elements.brushSelect.value as "water" | "land");
  const onTerrainChange = () => handlers.onSetTerrain(elements.terrainSelect.value as "water" | "land");
  const onSpeedInput = () => handlers.onSetSpeed(Number(elements.speedSlider.value));
  const onPointerMove = (event: PointerEvent) => {
    handlers.onCanvasHover(event.clientX, event.clientY);
    if (!isPaintMode || !isPointerPainting || (event.buttons & 1) === 0) {
      return;
    }
    handlers.onCanvasPaintMove(event.clientX, event.clientY);
  };
  const onPointerLeave = () => handlers.onCanvasLeave();
  const onPointerDown = (event: PointerEvent) => {
    pointerDownClientX = event.clientX;
    pointerDownClientY = event.clientY;

    if (!isPaintMode || event.button !== 0) {
      return;
    }

    isPointerPainting = true;
    canvasElement.setPointerCapture(event.pointerId);
    handlers.onCanvasPaintStart(event.clientX, event.clientY);
  };
  const onPointerUp = (event: PointerEvent) => {
    if (!isPaintMode) {
      if (event.button !== 0) {
        return;
      }

      const movedDistance = Math.hypot(
        event.clientX - pointerDownClientX,
        event.clientY - pointerDownClientY
      );
      if (movedDistance > CLICK_SELECTION_THRESHOLD) {
        return;
      }

      handlers.onCanvasSelect(event.clientX, event.clientY);
      return;
    }

    isPointerPainting = false;
    handlers.onCanvasPaintEnd();
    if (canvasElement.hasPointerCapture(event.pointerId)) {
      canvasElement.releasePointerCapture(event.pointerId);
    }
  };
  const onPointerCancel = (event: PointerEvent) => {
    isPointerPainting = false;
    handlers.onCanvasPaintEnd();
    if (canvasElement.hasPointerCapture(event.pointerId)) {
      canvasElement.releasePointerCapture(event.pointerId);
    }
  };
  const onWindowPointerUp = () => {
    isPointerPainting = false;
    handlers.onCanvasPaintEnd();
  };

  elements.toggleButton.addEventListener("click", onTogglePlay);
  elements.viewModeButton.addEventListener("click", onViewMode);
  elements.paintModeButton.addEventListener("click", onPaintMode);
  elements.rotateButton.addEventListener("click", onToggleAutoRotate);
  elements.stepButton.addEventListener("click", onStep);
  elements.randomizeButton.addEventListener("click", onRandomize);
  elements.brushSelect.addEventListener("change", onBrushChange);
  elements.terrainSelect.addEventListener("change", onTerrainChange);
  elements.speedSlider.addEventListener("input", onSpeedInput);
  canvasElement.addEventListener("pointermove", onPointerMove);
  canvasElement.addEventListener("pointerleave", onPointerLeave);
  canvasElement.addEventListener("pointerdown", onPointerDown);
  canvasElement.addEventListener("pointerup", onPointerUp);
  canvasElement.addEventListener("pointercancel", onPointerCancel);
  window.addEventListener("pointerup", onWindowPointerUp);

  return () => {
    elements.toggleButton.removeEventListener("click", onTogglePlay);
    elements.viewModeButton.removeEventListener("click", onViewMode);
    elements.paintModeButton.removeEventListener("click", onPaintMode);
    elements.rotateButton.removeEventListener("click", onToggleAutoRotate);
    elements.stepButton.removeEventListener("click", onStep);
    elements.randomizeButton.removeEventListener("click", onRandomize);
    elements.brushSelect.removeEventListener("change", onBrushChange);
    elements.terrainSelect.removeEventListener("change", onTerrainChange);
    elements.speedSlider.removeEventListener("input", onSpeedInput);
    canvasElement.removeEventListener("pointermove", onPointerMove);
    canvasElement.removeEventListener("pointerleave", onPointerLeave);
    canvasElement.removeEventListener("pointerdown", onPointerDown);
    canvasElement.removeEventListener("pointerup", onPointerUp);
    canvasElement.removeEventListener("pointercancel", onPointerCancel);
    window.removeEventListener("pointerup", onWindowPointerUp);
  };
}
