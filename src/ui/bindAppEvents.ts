import type { AppElements, AppEventHandlers } from "./types";

const CLICK_SELECTION_THRESHOLD = 6;
const CAMERA_DRAG_START_THRESHOLD = 4;

class AppEventController {
  private isPointerPainting = false;
  private activePointerId: number | null = null;
  private isPointerDragging = false;
  private pointerDownClientX = 0;
  private pointerDownClientY = 0;
  private lastPointerClientX = 0;
  private lastPointerClientY = 0;
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
    this.bindElement(this.canvasElement, "wheel", this.onWheel);
    this.bindElement(this.canvasElement, "contextmenu", this.onContextMenu);
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

  private endPointerInteraction(pointerId: number | null = this.activePointerId) {
    if (this.isPointerDragging) {
      this.handlers.onCanvasCameraDragChange(false);
    }
    if (pointerId !== null) {
      this.releasePointerCaptureIfHeld(pointerId);
    }
    this.activePointerId = null;
    this.isPointerDragging = false;
  }

  private releasePointerCaptureIfHeld(pointerId: number) {
    if (this.canvasElement.hasPointerCapture(pointerId)) {
      this.canvasElement.releasePointerCapture(pointerId);
    }
  }

  private capturePointerIfPossible(pointerId: number) {
    this.canvasElement.setPointerCapture(pointerId);
  }

  private onTogglePlay() {
    this.handlers.onTogglePlay();
  }

  private onViewMode() {
    this.endPainting();
    this.endPointerInteraction();
    this.handlers.onSetMode("view");
  }

  private onPaintMode() {
    this.endPainting();
    this.endPointerInteraction();
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
    if (this.handlers.getIsPaintMode()) {
      if (!this.isPointerPainting || (event.buttons & 1) === 0) {
        return;
      }
      this.handlers.onCanvasPaintMove(event.clientX, event.clientY);
      return;
    }

    if (this.activePointerId !== event.pointerId || (event.buttons & 1) === 0) {
      return;
    }

    if (!this.isPointerDragging) {
      const dragDistance = Math.hypot(
        event.clientX - this.pointerDownClientX,
        event.clientY - this.pointerDownClientY
      );
      if (dragDistance < CAMERA_DRAG_START_THRESHOLD) {
        return;
      }

      this.isPointerDragging = true;
      this.handlers.onCanvasCameraDragChange(true);
      this.lastPointerClientX = event.clientX;
      this.lastPointerClientY = event.clientY;
      this.capturePointerIfPossible(event.pointerId);
      return;
    }

    const deltaX = event.clientX - this.lastPointerClientX;
    const deltaY = event.clientY - this.lastPointerClientY;
    this.lastPointerClientX = event.clientX;
    this.lastPointerClientY = event.clientY;
    this.handlers.onCanvasRotate(deltaX, deltaY);
  }

  private onPointerLeave() {
    this.handlers.onCanvasLeave();
  }

  private onPointerDown(event: PointerEvent) {
    if (event.button !== 0) {
      return;
    }

    this.pointerDownClientX = event.clientX;
    this.pointerDownClientY = event.clientY;
    this.lastPointerClientX = event.clientX;
    this.lastPointerClientY = event.clientY;

    if (!this.handlers.getIsPaintMode()) {
      this.activePointerId = event.pointerId;
      this.isPointerDragging = false;
      return;
    }

    this.isPointerPainting = true;
    this.capturePointerIfPossible(event.pointerId);
    this.handlers.onCanvasPaintStart(event.clientX, event.clientY);
  }

  private onPointerUp(event: PointerEvent) {
    if (!this.handlers.getIsPaintMode()) {
      if (event.button !== 0 || this.activePointerId !== event.pointerId) {
        return;
      }

      const movedDistance = Math.hypot(
        event.clientX - this.pointerDownClientX,
        event.clientY - this.pointerDownClientY
      );
      const shouldSelect = !this.isPointerDragging && movedDistance <= CLICK_SELECTION_THRESHOLD;
      this.endPointerInteraction(event.pointerId);
      if (shouldSelect) {
        this.handlers.onCanvasSelect(event.clientX, event.clientY);
      }
      return;
    }

    this.endPainting();
    this.releasePointerCaptureIfHeld(event.pointerId);
  }

  private onPointerCancel(event: PointerEvent) {
    this.endPainting();
    this.endPointerInteraction(event.pointerId);
  }

  private onWindowPointerUp(event: PointerEvent) {
    this.endPainting();
    if (this.activePointerId === event.pointerId) {
      this.endPointerInteraction(event.pointerId);
    }
  }

  private onWheel(event: WheelEvent) {
    if (this.handlers.getIsPaintMode()) {
      return;
    }

    event.preventDefault();
    this.handlers.onCanvasZoom(event.deltaY);
  }

  private onContextMenu(event: MouseEvent) {
    event.preventDefault();
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
