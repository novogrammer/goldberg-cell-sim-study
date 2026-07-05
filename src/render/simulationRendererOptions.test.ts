import { describe, expect, it } from "vitest";

import { buildSimulationRendererOptions } from "./simulationRendererOptions";

describe("buildSimulationRendererOptions", () => {
  it("keeps WebGPU enabled for interactive sessions", () => {
    expect(buildSimulationRendererOptions({ isAutomation: false })).toEqual({
      antialias: true,
      forceWebGL: false
    });
  });

  it("forces WebGL for automated browsers", () => {
    expect(buildSimulationRendererOptions({ isAutomation: true })).toEqual({
      antialias: true,
      forceWebGL: true
    });
  });
});
