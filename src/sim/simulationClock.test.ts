import { describe, expect, it } from "vitest";

import { getNextSimulationTick } from "./simulationClock";

describe("getNextSimulationTick", () => {
  it("フレーム間隔の余りを繰り越して Steps / sec の平均速度を保つ", () => {
    let lastTick = 0;
    let stepCount = 0;

    for (let frame = 1; frame <= 60; frame += 1) {
      const timestamp = frame * (1000 / 60);
      const nextTick = getNextSimulationTick(lastTick, timestamp, 24);
      if (nextTick === null) {
        continue;
      }

      lastTick = nextTick;
      stepCount += 1;
    }

    expect(stepCount).toBe(24);
    expect(lastTick).toBeCloseTo(1000);
  });

  it("更新間隔に達していなければ tick を進めない", () => {
    expect(getNextSimulationTick(100, 140, 20)).toBeNull();
  });

  it("長い遅延でも呼び出し1回につき1つの tick だけを返す", () => {
    const nextTick = getNextSimulationTick(0, 1010, 10);

    expect(nextTick).toBe(1000);
  });
});
