import { PerspectiveCamera } from "three/webgpu";

const MIN_CAMERA_DISTANCE = 2.4;
const MAX_CAMERA_DISTANCE = 7.5;
const ROTATION_SENSITIVITY = 0.005;
const ZOOM_SENSITIVITY = 0.0012;
const CAMERA_DAMPING_SPEED = 10.5;
const AUTO_ROTATE_SPEED = 0.6;
const POLAR_EPSILON = 0.32;

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
  private isDragging = false;
  constructor(private readonly camera: PerspectiveCamera) {}

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

  setDragging(isDragging: boolean) {
    this.isDragging = isDragging;
  }

  zoomByWheelDelta(deltaY: number) {
    this.targetRadius = clampRadius(this.targetRadius * Math.exp(deltaY * ZOOM_SENSITIVITY));
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
