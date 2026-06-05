import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
  AmbientLight,
  DirectionalLight
} from "three";

import type { Cell, GoldbergMeshData } from "../types";

interface CellVisual {
  mesh: Mesh;
  material: MeshStandardMaterial;
  overlayMesh: Mesh;
}

export interface SimulationScene {
  renderer: WebGLRenderer;
  resize: () => void;
  render: () => void;
  updateCells: (cells: Cell[]) => void;
  pickCellAtClientPoint: (clientX: number, clientY: number) => number | null;
  setHoveredCell: (cellId: number | null) => void;
  setSelectedCell: (cellId: number | null) => void;
  dispose: () => void;
}

function colorForCell(cell: Cell): Color {
  const cool = new Color("#10395f");
  const warm = new Color(cell.isPentagon ? "#ff8f00" : "#7ce2ff");
  return cool.lerp(warm, cell.state);
}

const OVERLAY_INSET = 0.08;
const OVERLAY_LIFT = 0.006;
const HOVER_COLOR = "#fff2a8";
const SELECTED_COLOR = "#ffffff";
const HOVER_OPACITY = 0.42;
const SELECTED_OPACITY = 0.82;

function createCellGeometry(points: Vector3[]): BufferGeometry {
  const positions: number[] = [];

  for (let index = 1; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    positions.push(
      points[0].x,
      points[0].y,
      points[0].z,
      current.x,
      current.y,
      current.z,
      next.x,
      next.y,
      next.z
    );
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function createInsetOverlayGeometry(
  points: Vector3[],
  normal: Vector3,
  center: Vector3,
  insetRatio: number
): BufferGeometry {
  const liftedOuter = points.map((point) => point.clone().add(normal.clone().multiplyScalar(OVERLAY_LIFT)));
  const inner = points.map((point) =>
    point.clone().lerp(center, insetRatio).add(normal.clone().multiplyScalar(OVERLAY_LIFT))
  );
  const positions: number[] = [];

  for (let index = 0; index < points.length; index += 1) {
    const outerCurrent = liftedOuter[index];
    const outerNext = liftedOuter[(index + 1) % points.length];
    const innerCurrent = inner[index];
    const innerNext = inner[(index + 1) % points.length];

    positions.push(
      outerCurrent.x,
      outerCurrent.y,
      outerCurrent.z,
      outerNext.x,
      outerNext.y,
      outerNext.z,
      innerCurrent.x,
      innerCurrent.y,
      innerCurrent.z
    );

    positions.push(
      innerCurrent.x,
      innerCurrent.y,
      innerCurrent.z,
      outerNext.x,
      outerNext.y,
      outerNext.z,
      innerNext.x,
      innerNext.y,
      innerNext.z
    );
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function createSimulationScene(
  mount: HTMLElement,
  meshData: GoldbergMeshData,
  cells: Cell[]
): SimulationScene {
  const scene = new Scene();
  scene.background = new Color("#06131f");
  const raycaster = new Raycaster();
  const pointer = new Vector2();

  const camera = new PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 4.4);

  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  mount.appendChild(renderer.domElement);

  const ambientLight = new AmbientLight("#ffffff", 1.2);
  const directionalLight = new DirectionalLight("#d6f0ff", 2.4);
  directionalLight.position.set(3, 2, 4);
  scene.add(ambientLight, directionalLight);

  const group = new Group();
  scene.add(group);

  const cellVisuals = new Map<number, CellVisual>();
  let hoveredCellId: number | null = null;
  let selectedCellId: number | null = null;
  const geometryVertices = meshData.geometry.vertices.map((vertex) => new Vector3(...vertex));

  const applyOverlayState = (cellId: number) => {
    const visual = cellVisuals.get(cellId);
    if (!visual) {
      return;
    }

    const overlayMaterial = visual.overlayMesh.material;
    if (!(overlayMaterial instanceof MeshBasicMaterial)) {
      return;
    }

    if (cellId === selectedCellId) {
      overlayMaterial.visible = true;
      overlayMaterial.color.set(SELECTED_COLOR);
      overlayMaterial.opacity = SELECTED_OPACITY;
      return;
    }

    if (cellId === hoveredCellId) {
      overlayMaterial.visible = true;
      overlayMaterial.color.set(HOVER_COLOR);
      overlayMaterial.opacity = HOVER_OPACITY;
      return;
    }

    overlayMaterial.visible = false;
    overlayMaterial.opacity = 0;
  };

  for (const face of meshData.geometry.faces) {
    const cell = cells[face.cellId];
    const polygonPoints = face.vertexIndices.map((vertexId) => geometryVertices[vertexId].clone());
    const geometry = createCellGeometry(polygonPoints);
    const material = new MeshStandardMaterial({
      color: colorForCell(cell),
      roughness: 0.5,
      metalness: 0.08
    });
    const mesh = new Mesh(geometry, material);
    mesh.userData.cellId = face.cellId;
    const faceCenter = new Vector3(...face.center);
    const faceNormal = new Vector3(...face.normal);
    const insetRatio = Math.min(OVERLAY_INSET / face.circumradius, 0.35);
    const overlayMaterial = new MeshBasicMaterial({
      color: HOVER_COLOR,
      transparent: true,
      opacity: 0,
      depthWrite: false
    });
    overlayMaterial.visible = false;
    const overlayMesh = new Mesh(
      createInsetOverlayGeometry(
        polygonPoints,
        faceNormal,
        faceCenter,
        insetRatio
      ),
      overlayMaterial
    );

    mesh.add(overlayMesh);
    group.add(mesh);
    cellVisuals.set(face.cellId, { mesh, material, overlayMesh });
    applyOverlayState(face.cellId);
  }

  const resize = () => {
    const width = mount.clientWidth;
    const height = mount.clientHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  const updateCells = (nextCells: Cell[]) => {
    for (const cell of nextCells) {
      const visual = cellVisuals.get(cell.id);
      if (!visual) {
        continue;
      }
      visual.material.color.copy(colorForCell(cell));
    }
  };

  const pickCellAtClientPoint = (clientX: number, clientY: number): number | null => {
    const rect = renderer.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return null;
    }

    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const intersections = raycaster.intersectObjects(
      Array.from(cellVisuals.values()).map((visual) => visual.mesh),
      false
    );

    const hit = intersections[0];
    if (!hit) {
      return null;
    }

    return typeof hit.object.userData.cellId === "number" ? hit.object.userData.cellId : null;
  };

  const setHoveredCell = (cellId: number | null) => {
    const previous = hoveredCellId;
    hoveredCellId = cellId;
    if (previous !== null) {
      applyOverlayState(previous);
    }
    if (cellId !== null) {
      applyOverlayState(cellId);
    }
  };

  const setSelectedCell = (cellId: number | null) => {
    const previous = selectedCellId;
    selectedCellId = cellId;
    if (previous !== null) {
      applyOverlayState(previous);
    }
    if (cellId !== null) {
      applyOverlayState(cellId);
    }
  };

  const render = () => {
    group.rotation.y += 0.0035;
    group.rotation.x = Math.sin(performance.now() * 0.00015) * 0.08;
    renderer.render(scene, camera);
  };

  const dispose = () => {
    for (const visual of cellVisuals.values()) {
      visual.mesh.geometry.dispose();
      visual.material.dispose();
      visual.overlayMesh.geometry.dispose();
      if (Array.isArray(visual.overlayMesh.material)) {
        for (const material of visual.overlayMesh.material) {
          material.dispose();
        }
      } else {
        visual.overlayMesh.material.dispose();
      }
    }
    renderer.dispose();
    mount.removeChild(renderer.domElement);
  };

  resize();

  return {
    renderer,
    resize,
    render,
    updateCells,
    pickCellAtClientPoint,
    setHoveredCell,
    setSelectedCell,
    dispose
  };
}
