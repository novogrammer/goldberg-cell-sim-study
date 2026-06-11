import type { AppElements, AppEventHandlers } from "./types";

const CLICK_SELECTION_THRESHOLD = 6;

class AppEventController {
  private isPaintMode = false;
  private isPointerPainting = false;
  private pointerDownClientX = 0;
  private pointerDownClientY = 0;
  private readonly cleanupCallbacks: Array<() => void> = [];

  constructor(
    private readonly elements: AppElements,
    private readonly canvasElement: HTMLCanvasElement,
    private readonly handlers: AppEventHandlers
  ) {}

  bind() {
    this.bindElement(this.elements.toggleButton, "click", this.onTogglePlay);
    this.bindElement(this.elements.viewModeButton, "click", this.onViewMode);
    this.bindElement(this.elements.paintModeButton, "click", this.onPaintMode);
    this.bindElement(this.elements.rotateButton, "click", this.onToggleAutoRotate);
    this.bindElement(this.elements.stepButton, "click", this.onStep);
    this.bindElement(this.elements.randomizeButton, "click", this.onRandomize);
    this.bindElement(this.elements.brushSelect, "change", this.onBrushChange);
    this.bindElement(this.elements.speedSlider, "input", this.onSpeedInput);
    this.bindElement(this.canvasElement, "pointermove", this.onPointerMove);
    this.bindElement(this.canvasElement, "pointerleave", this.onPointerLeave);
    this.bindElement(this.canvasElement, "pointerdown", this.onPointerDown);
    this.bindElement(this.canvasElement, "pointerup", this.onPointerUp);
    this.bindElement(this.canvasElement, "pointercancel", this.onPointerCancel);
    this.bindWindow("pointerup", this.onWindowPointerUp);
  }

  dispose() {
    for (const cleanup of this.cleanupCallbacks) {
      cleanup();
    }
  }

  private endPainting() {
    this.isPointerPainting = false;
    this.handlers.onCanvasPaintEnd();
  }

  private releasePointerCaptureIfHeld(pointerId: number) {
    if (this.canvasElement.hasPointerCapture(pointerId)) {
      this.canvasElement.releasePointerCapture(pointerId);
    }
  }

  private onTogglePlay() {
    this.handlers.onTogglePlay();
  }

  private onViewMode() {
    this.isPaintMode = false;
    this.endPainting();
    this.handlers.onSetMode("view");
  }

  private onPaintMode() {
    this.isPaintMode = true;
    this.endPainting();
    this.handlers.onSetMode("paint");
  }

  private onToggleAutoRotate() {
    this.handlers.onToggleAutoRotate();
  }

  private onStep() {
    this.handlers.onStep();
  }

  private onRandomize() {
    this.handlers.onRandomize();
  }

  private onBrushChange() {
    this.handlers.onSetBrush(this.elements.brushSelect.value as "water" | "land");
  }

  private onSpeedInput() {
    this.handlers.onSetSpeed(Number(this.elements.speedSlider.value));
  }

  private onPointerMove(event: PointerEvent) {
    this.handlers.onCanvasHover(event.clientX, event.clientY);
    if (!this.isPaintMode || !this.isPointerPainting || (event.buttons & 1) === 0) {
      return;
    }
    this.handlers.onCanvasPaintMove(event.clientX, event.clientY);
  }

  private onPointerLeave() {
    this.handlers.onCanvasLeave();
  }

  private onPointerDown(event: PointerEvent) {
    this.pointerDownClientX = event.clientX;
    this.pointerDownClientY = event.clientY;

    if (!this.isPaintMode || event.button !== 0) {
      return;
    }

    this.isPointerPainting = true;
    this.canvasElement.setPointerCapture(event.pointerId);
    this.handlers.onCanvasPaintStart(event.clientX, event.clientY);
  }

  private onPointerUp(event: PointerEvent) {
    if (!this.isPaintMode) {
      if (event.button !== 0) {
        return;
      }

      const movedDistance = Math.hypot(
        event.clientX - this.pointerDownClientX,
        event.clientY - this.pointerDownClientY
      );
      if (movedDistance > CLICK_SELECTION_THRESHOLD) {
        return;
      }

      this.handlers.onCanvasSelect(event.clientX, event.clientY);
      return;
    }

    this.endPainting();
    this.releasePointerCaptureIfHeld(event.pointerId);
  }

  private onPointerCancel(event: PointerEvent) {
    this.endPainting();
    this.releasePointerCaptureIfHeld(event.pointerId);
  }

  private onWindowPointerUp() {
    this.endPainting();
  }

  private bindElement<K extends keyof HTMLElementEventMap>(
    target: HTMLElement,
    type: K,
    listener: (event: HTMLElementEventMap[K]) => void
  ) {
    const boundListener = listener.bind(this) as EventListener;
    target.addEventListener(type, boundListener);
    this.cleanupCallbacks.push(() => target.removeEventListener(type, boundListener));
  }

  private bindWindow<K extends keyof WindowEventMap>(
    type: K,
    listener: (event: WindowEventMap[K]) => void
  ) {
    const boundListener = listener.bind(this) as EventListener;
    window.addEventListener(type, boundListener);
    this.cleanupCallbacks.push(() => window.removeEventListener(type, boundListener));
  }
}

export function bindAppEvents(
  elements: AppElements,
  canvasElement: HTMLCanvasElement,
  handlers: AppEventHandlers
) {
  const controller = new AppEventController(elements, canvasElement, handlers);
  controller.bind();

  return () => {
    controller.dispose();
  };
}
