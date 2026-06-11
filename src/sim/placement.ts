import { Vector3 } from "three/webgpu";

import type { CellFaceGeometry, CellPlacement, CellPlacementTransform, GoldbergMeshData } from "../types";

function toTuple(vector: Vector3): [number, number, number] {
  return [vector.x, vector.y, vector.z];
}

export function getCellFaceGeometry(
  meshData: GoldbergMeshData,
  cellId: number
): CellFaceGeometry {
  const face = meshData.geometry.faces.find((entry) => entry.cellId === cellId);

  if (!face) {
    throw new Error(`Cell face geometry not found for cell ${cellId}.`);
  }

  return face;
}

export function createCellPlacementTransform(
  meshData: GoldbergMeshData,
  placement: CellPlacement
): CellPlacementTransform {
  const face = getCellFaceGeometry(meshData, placement.cellId);
  const center = new Vector3(...face.center);
  const normal = new Vector3(...face.normal);
  const tangent = new Vector3(...face.tangent);
  const bitangent = new Vector3(...face.bitangent);

  const position = center
    .clone()
    .add(tangent.clone().multiplyScalar(placement.offsetU))
    .add(bitangent.clone().multiplyScalar(placement.offsetV))
    .add(normal.clone().multiplyScalar(placement.height));

  const rotatedTangent = tangent
    .clone()
    .multiplyScalar(Math.cos(placement.yaw))
    .add(bitangent.clone().multiplyScalar(Math.sin(placement.yaw)))
    .normalize();
  const rotatedBitangent = new Vector3().crossVectors(normal, rotatedTangent).normalize();

  return {
    position: toTuple(position),
    normal: toTuple(normal),
    tangent: toTuple(rotatedTangent),
    bitangent: toTuple(rotatedBitangent),
    yaw: placement.yaw
  };
}
