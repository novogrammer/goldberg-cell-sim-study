import { PerspectiveCamera } from "three/webgpu";

const MIN_CAMERA_DISTANCE = 2.4;
const MAX_CAMERA_DISTANCE = 7.5;
const ROTATION_SENSITIVITY = 0.005;
const ZOOM_SENSITIVITY = 0.0012;
const CAMERA_DAMPING_SPEED = 10.5;
const AUTO_ROTATE_SPEED = 0.6;
const POLAR_EPSILON = 0.32;
const DRAG_START_THRESHOLD = 4;

function clampPolar(value: number) {
  return Math.max(POLAR_EPSILON, Math.min(Math.PI - POLAR_EPSILON, value));
}

function clampRadius(value: number) {
  return Math.max(MIN_CAMERA_DISTANCE, Math.min(MAX_CAMERA_DISTANCE, value));
}

export class GoldbergCameraControls {
  enabled = true;
  autoRotate = false;

  private currentAzimuth = 0;
  private targetAzimuth = 0;
  private currentPolar = Math.PI / 2;
  private targetPolar = Math.PI / 2;
  private currentRadius = 4.4;
  private targetRadius = 4.4;
  private activePointerId: number | null = null;
  private pointerDownX = 0;
  private pointerDownY = 0;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private isDragging = false;
  private readonly onPointerDownBound: (event: PointerEvent) => void;
  private readonly onPointerMoveBound: (event: PointerEvent) => void;
  private readonly onPointerUpBound: (event: PointerEvent) => void;
  private readonly onWheelBound: (event: WheelEvent) => void;
  private readonly onContextMenuBound: (event: MouseEvent) => void;

  constructor(
    private readonly camera: PerspectiveCamera,
    private readonly domElement: HTMLElement
  ) {
    this.onPointerDownBound = (event) => this.onPointerDown(event);
    this.onPointerMoveBound = (event) => this.onPointerMove(event);
    this.onPointerUpBound = (event) => this.finishPointerInteraction(event);
    this.onWheelBound = (event) => this.onWheel(event);
    this.onContextMenuBound = (event) => this.onContextMenu(event);

    this.domElement.addEventListener("pointerdown", this.onPointerDownBound);
    this.domElement.addEventListener("pointermove", this.onPointerMoveBound);
    this.domElement.addEventListener("pointerup", this.onPointerUpBound);
    this.domElement.addEventListener("pointercancel", this.onPointerUpBound);
    this.domElement.addEventListener("wheel", this.onWheelBound, { passive: false });
    this.domElement.addEventListener("contextmenu", this.onContextMenuBound);
  }

  update(deltaSeconds: number) {
    if (!this.enabled) {
      return;
    }

    if (this.autoRotate && !this.isDragging) {
      this.targetAzimuth += AUTO_ROTATE_SPEED * deltaSeconds;
    }

    const damping = 1 - Math.exp(-CAMERA_DAMPING_SPEED * deltaSeconds);
    this.currentAzimuth += (this.targetAzimuth - this.currentAzimuth) * damping;
    this.currentPolar += (this.targetPolar - this.currentPolar) * damping;
    this.currentRadius += (this.targetRadius - this.currentRadius) * damping;

    this.applyCameraTransform();
  }

  syncCameraImmediately() {
    this.currentAzimuth = this.targetAzimuth;
    this.currentPolar = this.targetPolar;
    this.currentRadius = this.targetRadius;
    this.applyCameraTransform();
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) {
      this.syncTargetsToCurrentState();
      if (
        this.activePointerId !== null &&
        this.domElement.hasPointerCapture(this.activePointerId)
      ) {
        this.domElement.releasePointerCapture(this.activePointerId);
      }
      this.isDragging = false;
      this.activePointerId = null;
    }
  }

  setAutoRotate(enabled: boolean) {
    this.autoRotate = enabled;
    if (!enabled) {
      this.syncTargetsToCurrentState();
    }
  }

  getCameraPosition(): [number, number, number] {
    return [
      this.camera.position.x,
      this.camera.position.y,
      this.camera.position.z
    ];
  }

  rotateByPointerDelta(deltaX: number, deltaY: number) {
    this.targetAzimuth -= deltaX * ROTATION_SENSITIVITY;
    this.targetPolar = clampPolar(this.targetPolar - deltaY * ROTATION_SENSITIVITY);
  }

  zoomByWheelDelta(deltaY: number) {
    this.targetRadius = clampRadius(this.targetRadius * Math.exp(deltaY * ZOOM_SENSITIVITY));
  }

  dispose() {
    this.domElement.removeEventListener("pointerdown", this.onPointerDownBound);
    this.domElement.removeEventListener("pointermove", this.onPointerMoveBound);
    this.domElement.removeEventListener("pointerup", this.onPointerUpBound);
    this.domElement.removeEventListener("pointercancel", this.onPointerUpBound);
    this.domElement.removeEventListener("wheel", this.onWheelBound);
    this.domElement.removeEventListener("contextmenu", this.onContextMenuBound);
  }

  private onPointerDown(event: PointerEvent) {
    if (!this.enabled || event.button !== 0) {
      return;
    }

    this.activePointerId = event.pointerId;
    this.pointerDownX = event.clientX;
    this.pointerDownY = event.clientY;
    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;
    this.isDragging = false;
  }

  private onPointerMove(event: PointerEvent) {
    if (!this.enabled || this.activePointerId !== event.pointerId) {
      return;
    }

    if (!this.isDragging) {
      const dragDistance = Math.hypot(
        event.clientX - this.pointerDownX,
        event.clientY - this.pointerDownY
      );
      if (dragDistance < DRAG_START_THRESHOLD) {
        return;
      }

      this.isDragging = true;
      this.lastPointerX = event.clientX;
      this.lastPointerY = event.clientY;
      this.domElement.setPointerCapture(event.pointerId);
      return;
    }

    const deltaX = event.clientX - this.lastPointerX;
    const deltaY = event.clientY - this.lastPointerY;
    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;
    this.rotateByPointerDelta(deltaX, deltaY);
  }

  private finishPointerInteraction(event: PointerEvent) {
    if (this.activePointerId !== event.pointerId) {
      return;
    }

    if (this.isDragging && this.domElement.hasPointerCapture(event.pointerId)) {
      this.domElement.releasePointerCapture(event.pointerId);
    }

    this.activePointerId = null;
    this.isDragging = false;
  }

  private onWheel(event: WheelEvent) {
    if (!this.enabled) {
      return;
    }

    event.preventDefault();
    this.zoomByWheelDelta(event.deltaY);
  }

  private onContextMenu(event: MouseEvent) {
    event.preventDefault();
  }

  private syncTargetsToCurrentState() {
    this.targetAzimuth = this.currentAzimuth;
    this.targetPolar = this.currentPolar;
    this.targetRadius = this.currentRadius;
  }

  private applyCameraTransform() {
    const sinPolar = Math.sin(this.currentPolar);
    this.camera.position.set(
      Math.sin(this.currentAzimuth) * sinPolar * this.currentRadius,
      Math.cos(this.currentPolar) * this.currentRadius,
      Math.cos(this.currentAzimuth) * sinPolar * this.currentRadius
    );
    this.camera.lookAt(0, 0, 0);
  }
}
