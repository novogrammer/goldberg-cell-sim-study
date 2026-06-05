import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineLoop,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
  AmbientLight,
  DirectionalLight
} from "three";

import type { Cell, GoldbergMeshData } from "../types";

interface CellVisual {
  mesh: Mesh;
  material: MeshStandardMaterial;
}

export interface SimulationScene {
  renderer: WebGLRenderer;
  resize: () => void;
  render: () => void;
  updateCells: (cells: Cell[]) => void;
  dispose: () => void;
}

function colorForCell(cell: Cell): Color {
  const cool = new Color("#10395f");
  const warm = new Color(cell.isPentagon ? "#ff8f00" : "#7ce2ff");
  return cool.lerp(warm, cell.state);
}

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

export function createSimulationScene(
  mount: HTMLElement,
  meshData: GoldbergMeshData,
  cells: Cell[]
): SimulationScene {
  const scene = new Scene();
  scene.background = new Color("#06131f");

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
  const geometryVertices = meshData.geometry.vertices.map((vertex) => new Vector3(...vertex));

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

    const borderGeometry = new BufferGeometry().setFromPoints(polygonPoints);
    const border = new LineLoop(
      borderGeometry,
      new LineBasicMaterial({
        color: cell.isPentagon ? "#ffe082" : "#0d2234",
        transparent: true,
        opacity: 0.9
      })
    );

    mesh.add(border);
    group.add(mesh);
    cellVisuals.set(face.cellId, { mesh, material });
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

  const render = () => {
    group.rotation.y += 0.0035;
    group.rotation.x = Math.sin(performance.now() * 0.00015) * 0.08;
    renderer.render(scene, camera);
  };

  const dispose = () => {
    for (const visual of cellVisuals.values()) {
      visual.mesh.geometry.dispose();
      visual.material.dispose();
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
    dispose
  };
}
