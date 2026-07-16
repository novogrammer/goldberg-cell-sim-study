export function getNextSimulationTick(
  lastTick: number,
  timestamp: number,
  stepsPerSecond: number
): number | null {
  const interval = 1000 / stepsPerSecond;
  const elapsed = timestamp - lastTick;
  if (elapsed < interval) {
    return null;
  }

  return timestamp - (elapsed % interval);
}
