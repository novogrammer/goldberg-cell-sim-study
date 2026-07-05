export interface SimulationRendererEnvironment {
  isAutomation: boolean;
}

export function buildSimulationRendererOptions(environment: SimulationRendererEnvironment) {
  return {
    antialias: true,
    // Headless automation on CI exposes WebGPU inconsistently, so force the stable fallback there.
    forceWebGL: environment.isAutomation
  };
}
