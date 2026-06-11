import { Color } from "three/webgpu";

import type { Cell } from "../types";

export function colorForCell(cell: Cell): Color {
  if (cell.terrainKind === "water") {
    return new Color("#1d5ca8");
  }

  const barren = new Color("#8f6d37");
  const fertile = new Color("#6bbf4e");
  const moistureTint = new Color("#5f8fc8");
  const vegetationBlend = Math.pow(cell.vegetation, 0.78);
  const baseColor = barren.lerp(fertile, vegetationBlend);
  const moistureBlend = Math.pow(cell.moisture, 0.85) * 0.5;
  return baseColor.lerp(moistureTint, moistureBlend);
}
