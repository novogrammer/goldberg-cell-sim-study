import { MeshStandardNodeMaterial } from "three/webgpu";
import {
  color,
  float,
  mx_fractal_noise_float,
  normalLocal,
  normalWorldGeometry,
  positionLocal,
  positionWorld,
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
  const landHeight = createLandHeight(positionWorld);

  material.colorNode = color(vec3(landShade));
  material.positionNode = positionLocal.add(normalLocal.normalize().mul(landHeight));

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
  const waveShade = createWaterShade(positionWorld);
  const basisSign = baseWorldNormal.z.greaterThanEqual(0).select(float(1), float(-1));
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
  const sampleOffset = 0.02;
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

  material.colorNode = color(
    vec3(0.12, 0.37, 0.58).mul(waveShade)
  );
  material.positionNode = positionLocal.add(normalLocal.normalize().mul(waveHeight));
  material.normalNode = transformNormalToView(waveWorldNormal).normalize();

  return material;
}

function createLandNoise(positionNode: any) {
  const broadLandNoise = mx_fractal_noise_float(positionNode.mul(4.4), 4, 2.0, 0.55, 1);
  const detailLandNoise = mx_fractal_noise_float(positionNode.mul(12.5), 3, 2.4, 0.5, 1);

  return broadLandNoise.mul(0.72).add(detailLandNoise.mul(0.28));
}

function createLandHeight(positionNode: any) {
  const landHeightNoise = mx_fractal_noise_float(positionNode.mul(20), 5, 2.0, 0.58, 1);

  return landHeightNoise.mul(0.006);
}

function createWaterHeight(positionNode: any) {
  const phase = time.mul(1.35);
  const swell = positionNode.x.mul(12.6)
    .add(positionNode.z.mul(6.2))
    .add(phase)
    .sin();
  const crossWave = positionNode.x.mul(-9.4)
    .add(positionNode.y.mul(11.2))
    .add(phase.mul(1.7))
    .sin();
  const ripple = positionNode.y.mul(18.4)
    .add(positionNode.z.mul(-14.6))
    .add(phase.mul(2.4))
    .sin();

  return swell.mul(0.0032)
    .add(crossWave.mul(0.0019))
    .add(ripple.mul(0.0009));
}

function createWaterShade(positionNode: any) {
  const phase = time.mul(1.05);
  const bandA = positionNode.x.mul(10.8)
    .add(positionNode.z.mul(-7.2))
    .add(phase)
    .sin();
  const bandB = positionNode.y.mul(15.6)
    .add(positionNode.x.mul(5.4))
    .add(phase.mul(1.6))
    .sin();

  return bandA.mul(0.05).add(bandB.mul(0.025)).add(1);
}
