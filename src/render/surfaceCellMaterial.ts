import { MeshStandardNodeMaterial } from "three/webgpu";
import {
  color,
  float,
  mx_fractal_noise_float,
  normalLocal,
  normalWorldGeometry,
  positionLocal,
  positionWorld,
  sign,
  time,
  transformNormalToView,
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
  const baseWorldNormal = normalWorldGeometry.normalize();
  const waveHeight = createWaterHeight(positionWorld);
  const basisSign = sign(baseWorldNormal.z);
  const basisA = float(-1).div(basisSign.add(baseWorldNormal.z));
  const basisB = baseWorldNormal.x.mul(baseWorldNormal.y).mul(basisA);
  const tangentWorld = vec3(
    baseWorldNormal.x.mul(baseWorldNormal.x).mul(basisSign).mul(basisA).add(1),
    basisSign.mul(basisB),
    basisSign.mul(baseWorldNormal.x).negate()
  ).normalize();
  const bitangentWorld = vec3(
    basisB,
    baseWorldNormal.y.mul(baseWorldNormal.y).mul(basisA).add(basisSign),
    baseWorldNormal.y.negate()
  ).normalize();
  const sampleOffset = 0.045;
  const tangentSlope = createWaterHeight(positionWorld.add(tangentWorld.mul(sampleOffset)))
    .sub(createWaterHeight(positionWorld.sub(tangentWorld.mul(sampleOffset))))
    .div(sampleOffset * 2);
  const bitangentSlope = createWaterHeight(positionWorld.add(bitangentWorld.mul(sampleOffset)))
    .sub(createWaterHeight(positionWorld.sub(bitangentWorld.mul(sampleOffset))))
    .div(sampleOffset * 2);
  const localWaveNormal = vec3(
    tangentSlope.negate(),
    bitangentSlope.negate(),
    1
  ).normalize();
  const waveWorldNormal = tangentWorld.mul(localWaveNormal.x)
    .add(bitangentWorld.mul(localWaveNormal.y))
    .add(baseWorldNormal.mul(localWaveNormal.z))
    .normalize();

  material.colorNode = color("#1f5f95");
  material.positionNode = positionLocal.add(normalLocal.normalize().mul(waveHeight));
  material.normalNode = transformNormalToView(waveWorldNormal).normalize();

  return material;
}

function createLandNoise(positionNode: any) {
  const broadLandNoise = mx_fractal_noise_float(positionNode.mul(4.4), 4, 2.0, 0.55, 1);
  const detailLandNoise = mx_fractal_noise_float(positionNode.mul(12.5), 3, 2.4, 0.5, 1);

  return broadLandNoise.mul(0.72).add(detailLandNoise.mul(0.28));
}

function createWaterHeight(positionNode: any) {
  const wavePosition = positionNode.mul(4.8).add(vec3(0, 0, time.mul(0.45)));
  const waveNoise = mx_fractal_noise_float(wavePosition, 5, 2.0, 0.58, 1);

  return waveNoise.mul(0.01);
}
