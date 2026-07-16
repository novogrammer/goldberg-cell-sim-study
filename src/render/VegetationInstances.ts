import {
  BoxGeometry,
  ConeGeometry,
  InstancedMesh,
  MeshStandardMaterial
} from "three/webgpu";

import type { Cell } from "../types";
import {
  TREE_INSTANCE_COUNT,
  WEED_INSTANCE_COUNT,
  syncPackedVegetationInstances,
  type CellVegetationLayout
} from "./cellVegetationAppearance";

export class VegetationInstances {
  readonly treeMesh: InstancedMesh;
  readonly weedMesh: InstancedMesh;

  private readonly treeGeometry = new ConeGeometry(1, 1, 5);
  private readonly treeMaterial = new MeshStandardMaterial({
    color: "#ffffff",
    roughness: 0.88,
    metalness: 0.02
  });
  private readonly weedGeometry = new BoxGeometry(1, 1, 0.2);
  private readonly weedMaterial = new MeshStandardMaterial({
    color: "#ffffff",
    roughness: 0.88,
    metalness: 0.02
  });

  constructor(maxCellCount: number) {
    this.treeMesh = new InstancedMesh(
      this.treeGeometry,
      this.treeMaterial,
      maxCellCount * TREE_INSTANCE_COUNT
    );
    this.weedMesh = new InstancedMesh(
      this.weedGeometry,
      this.weedMaterial,
      maxCellCount * WEED_INSTANCE_COUNT
    );
    this.treeMesh.count = 0;
    this.weedMesh.count = 0;
  }

  sync(
    cells: Cell[],
    getLayout: (cellId: number) => CellVegetationLayout | undefined
  ) {
    syncPackedVegetationInstances(
      this.treeMesh,
      this.weedMesh,
      cells,
      getLayout
    );
    this.treeMesh.instanceMatrix.needsUpdate = true;
    this.weedMesh.instanceMatrix.needsUpdate = true;
    if (this.treeMesh.instanceColor) {
      this.treeMesh.instanceColor.needsUpdate = true;
    }
    if (this.weedMesh.instanceColor) {
      this.weedMesh.instanceColor.needsUpdate = true;
    }
  }

  dispose() {
    this.treeGeometry.dispose();
    this.treeMaterial.dispose();
    this.weedGeometry.dispose();
    this.weedMaterial.dispose();
  }
}
