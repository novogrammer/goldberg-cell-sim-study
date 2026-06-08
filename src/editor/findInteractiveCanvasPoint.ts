export function findInteractiveCanvasPoint(
  canvasElement: HTMLCanvasElement,
  pickCellAtClientPoint: (clientX: number, clientY: number) => number | null
): { x: number; y: number; cellId: number } | null {
  const rect = canvasElement.getBoundingClientRect();
  const probes: Array<[number, number]> = [
    [0.5, 0.5],
    [0.46, 0.5],
    [0.54, 0.5],
    [0.5, 0.44],
    [0.5, 0.56],
    [0.42, 0.46],
    [0.58, 0.54],
    [0.38, 0.5],
    [0.62, 0.5]
  ];

  for (const [u, v] of probes) {
    const clientX = rect.left + rect.width * u;
    const clientY = rect.top + rect.height * v;
    const targetElement = document.elementFromPoint(clientX, clientY);
    if (targetElement !== canvasElement) {
      continue;
    }

    const cellId = pickCellAtClientPoint(clientX, clientY);
    if (cellId !== null) {
      return { x: clientX, y: clientY, cellId };
    }
  }

  return null;
}
