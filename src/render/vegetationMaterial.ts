import { MeshStandardNodeMaterial } from "three/webgpu";
import {
  attribute,
  positionGeometry,
  positionLocal,
  time,
  vec3
} from "three/tsl";

const WEED_SWAY_SPEED = 1.65;
const WEED_SWAY_AMPLITUDE = 0.82;
const WEED_CROSS_SWAY_AMPLITUDE = 0.34;

export function createWeedMaterial() {
  const material = new MeshStandardNodeMaterial({
    color: "#ffffff",
    roughness: 0.88,
    metalness: 0.02
  });
  const heightWeight = positionGeometry.y.clamp(0, 1);
  const bendWeight = heightWeight.mul(heightWeight);
  const phase = time.mul(WEED_SWAY_SPEED).add(attribute("weedPhase", "float"));
  const sway = phase.sin().mul(WEED_SWAY_AMPLITUDE);
  const crossSway = phase
    .mul(1.37)
    .add(0.8)
    .sin()
    .mul(WEED_CROSS_SWAY_AMPLITUDE);

  material.positionNode = positionLocal.add(
    vec3(sway, 0, crossSway).mul(bendWeight)
  );

  return material;
}
