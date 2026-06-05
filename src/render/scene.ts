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
  if (cell.terrainKind === "water") {
    return new Color("#1d5ca8");
  }

  const barren = new Color("#8f6d37");
  const fertile = new Color("#6bbf4e");
  const vegetationBlend = Math.pow(cell.vegetation, 0.78);
  return barren.lerp(fertile, vegetationBlend);
}

function roughnessForCell(cell: Cell): number {
  if (cell.terrainKind === "water") {
    return 0.15;
  }

  return Math.max(0.38, Math.min(0.92, 0.92 - cell.moisture * 0.47));
}

const OVERLAY_LIFT = 0.006;
const OVERLAY_WIDTH = 0.055;
const TILE_DEPTH = 0.12;
const TILE_SURFACE_LIFT = 0.08;
const TILE_TOP_INSET = 0.04;
const TILE_BEVEL_DROP_RATIO = 0.18;
const HOVER_COLOR = "#fff2a8";
const SELECTED_COLOR = "#ffffff";
const HOVER_OPACITY = 0.42;
const SELECTED_OPACITY = 0.82;

function createTileSurfaceProfile(
  points: Vector3[],
  normal: Vector3,
  insetRatio: number,
  bevelDrop: number
) {
  const surfacePoints = points.map((point) =>
    point.clone().add(point.clone().normalize().multiplyScalar(TILE_SURFACE_LIFT))
  );
  const topCenter = surfacePoints
    .reduce((sum, point) => sum.add(point.clone()), new Vector3())
    .divideScalar(surfacePoints.length);
  const insetTopPoints = surfacePoints.map((point) =>
    point
      .clone()
      .lerp(topCenter, insetRatio)
  );
  const outerTopPoints = surfacePoints.map((point) =>
    point.clone().sub(normal.clone().multiplyScalar(bevelDrop))
  );
  return {
    surfacePoints,
    outerTopPoints,
    insetTopPoints,
    topCenter
  };
}

function createCellGeometry(
  points: Vector3[],
  normal: Vector3,
  insetRatio: number,
  bevelDrop: number
): BufferGeometry {
  const { outerTopPoints, insetTopPoints } = createTileSurfaceProfile(
    points,
    normal,
    insetRatio,
    bevelDrop
  );
  const bottomPoints = outerTopPoints.map((point) =>
    point.clone().sub(normal.clone().multiplyScalar(TILE_DEPTH))
  );
  const positions: number[] = [];

  for (let index = 1; index < insetTopPoints.length - 1; index += 1) {
    const current = insetTopPoints[index];
    const next = insetTopPoints[index + 1];
    positions.push(
      insetTopPoints[0].x,
      insetTopPoints[0].y,
      insetTopPoints[0].z,
      current.x,
      current.y,
      current.z,
      next.x,
      next.y,
      next.z
    );
  }

  for (let index = 1; index < bottomPoints.length - 1; index += 1) {
    const current = bottomPoints[index];
    const next = bottomPoints[index + 1];
    positions.push(
      bottomPoints[0].x,
      bottomPoints[0].y,
      bottomPoints[0].z,
      next.x,
      next.y,
      next.z,
      current.x,
      current.y,
      current.z
    );
  }

  for (let index = 0; index < points.length; index += 1) {
    const outerTopCurrent = outerTopPoints[index];
    const outerTopNext = outerTopPoints[(index + 1) % points.length];
    const insetTopCurrent = insetTopPoints[index];
    const insetTopNext = insetTopPoints[(index + 1) % points.length];
    const bottomCurrent = bottomPoints[index];
    const bottomNext = bottomPoints[(index + 1) % points.length];

    positions.push(
      outerTopCurrent.x,
      outerTopCurrent.y,
      outerTopCurrent.z,
      outerTopNext.x,
      outerTopNext.y,
      outerTopNext.z,
      insetTopCurrent.x,
      insetTopCurrent.y,
      insetTopCurrent.z
    );

    positions.push(
      insetTopCurrent.x,
      insetTopCurrent.y,
      insetTopCurrent.z,
      outerTopNext.x,
      outerTopNext.y,
      outerTopNext.z,
      insetTopNext.x,
      insetTopNext.y,
      insetTopNext.z
    );

    positions.push(
      outerTopCurrent.x,
      outerTopCurrent.y,
      outerTopCurrent.z,
      outerTopNext.x,
      outerTopNext.y,
      outerTopNext.z,
      bottomCurrent.x,
      bottomCurrent.y,
      bottomCurrent.z
    );

    positions.push(
      bottomCurrent.x,
      bottomCurrent.y,
      bottomCurrent.z,
      outerTopNext.x,
      outerTopNext.y,
      outerTopNext.z,
      bottomNext.x,
      bottomNext.y,
      bottomNext.z
    );
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function averageHexagonInradius(meshData: GoldbergMeshData): number {
  const hexagonFaces = meshData.geometry.faces.filter((face) => !meshData.cells[face.cellId].isPentagon);
  const total = hexagonFaces.reduce((sum, face) => sum + face.inradius, 0);
  return total / hexagonFaces.length;
}

function createInsetOverlayGeometry(
  topPoints: Vector3[],
  topCenter: Vector3,
  overlayWidthRatio: number
): BufferGeometry {
  const liftedOuter = topPoints.map((point) =>
    point
      .clone()
      .add(point.clone().normalize().multiplyScalar(OVERLAY_LIFT))
  );
  const inner = topPoints.map((point) =>
    point
      .clone()
      .lerp(topCenter, overlayWidthRatio)
      .add(
        point
          .clone()
          .lerp(topCenter, overlayWidthRatio)
          .normalize()
          .multiplyScalar(OVERLAY_LIFT)
      )
  );
  const positions: number[] = [];

  for (let index = 0; index < topPoints.length; index += 1) {
    const outerCurrent = liftedOuter[index];
    const outerNext = liftedOuter[(index + 1) % topPoints.length];
    const innerCurrent = inner[index];
    const innerNext = inner[(index + 1) % topPoints.length];

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
  const bevelDrop = averageHexagonInradius(meshData) * TILE_BEVEL_DROP_RATIO;

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
    const faceNormal = new Vector3(...face.normal);
    const tileInsetRatio = Math.min(TILE_TOP_INSET / face.circumradius, 0.35);
    const { surfacePoints, topCenter } = createTileSurfaceProfile(
      polygonPoints,
      faceNormal,
      tileInsetRatio,
      bevelDrop
    );
    const geometry = createCellGeometry(polygonPoints, faceNormal, tileInsetRatio, bevelDrop);
    const material = new MeshStandardMaterial({
      color: colorForCell(cell),
      roughness: roughnessForCell(cell),
      metalness: 0.08
    });
    const mesh = new Mesh(geometry, material);
    mesh.userData.cellId = face.cellId;
    const overlayWidthRatio = Math.min(OVERLAY_WIDTH / face.circumradius, 0.18);
    const overlayMaterial = new MeshBasicMaterial({
      color: HOVER_COLOR,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false
    });
    overlayMaterial.visible = false;
    const overlayMesh = new Mesh(
      createInsetOverlayGeometry(
        surfacePoints,
        topCenter,
        overlayWidthRatio
      ),
      overlayMaterial
    );
    overlayMesh.renderOrder = 10;

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
      visual.material.roughness = roughnessForCell(cell);
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
