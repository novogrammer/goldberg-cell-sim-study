import { MeshStandardNodeMaterial } from "three/webgpu";
import {
  color,
  float,
  mx_fractal_noise_float,
  mix,
  positionWorld,
  time,
  vec3
} from "three/tsl";

const LAND_SURFACE_ROUGHNESS = 0.66;
const WATER_SURFACE_ROUGHNESS = 0.15;

export function createLandSurfaceMaterial() {
  const material = new MeshStandardNodeMaterial({
    color: "#ffffff",
    roughness: LAND_SURFACE_ROUGHNESS,
    metalness: 0.08
  });
  const landNoise = createLandNoise(positionWorld);
  const landShade = landNoise.mul(0.18).add(0.92);

  material.colorNode = color(vec3(landShade));

  return material;
}

export function createWaterSurfaceMaterial() {
  const material = new MeshStandardNodeMaterial({
    color: "#ffffff",
    roughness: WATER_SURFACE_ROUGHNESS,
    metalness: 0.08
  });
  const wavePosition = positionWorld.mul(4.8).add(vec3(0, 0, time.mul(0.45)));
  const waveNoise = mx_fractal_noise_float(wavePosition, 5, 2.0, 0.58, 1);
  const waveBlend = waveNoise.mul(0.5).add(0.5);
  const deepWater = color("#123f74");
  const crestWater = color("#58a6d8");

  material.colorNode = mix(deepWater, crestWater, waveBlend.mul(0.42).add(0.08));
  material.roughnessNode = mix(
    float(0.08),
    float(0.24),
    waveBlend
  );

  return material;
}

function createLandNoise(positionNode: any) {
  const broadLandNoise = mx_fractal_noise_float(positionNode.mul(4.4), 4, 2.0, 0.55, 1);
  const detailLandNoise = mx_fractal_noise_float(positionNode.mul(12.5), 3, 2.4, 0.5, 1);

  return broadLandNoise.mul(0.72).add(detailLandNoise.mul(0.28));
}
