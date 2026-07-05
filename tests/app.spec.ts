import { expect, test, type Page } from '@playwright/test';

async function gotoApp(page: Page) {
  await page.goto('/');
  await page.waitForFunction(() => window.__goldbergAppReady === true);
}

async function getCanvasCenter(page: Page) {
  const box = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height
    };
  });
  if (!box) {
    throw new Error('Canvas bounding box was not available.');
  }

  return {
    centerX: box.x + box.width / 2,
    centerY: box.y + box.height / 2,
    box,
  };
}

async function getCameraPosition(page: Page) {
  return page.evaluate(() => window.__goldbergTestState?.getCameraPosition() ?? null);
}

async function getInteractiveCanvasPoint(page: Page) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const point = await page.evaluate(() => window.__goldbergTestState?.getInteractiveCanvasPoint() ?? null);
    if (point) {
      return point;
    }
    await page.waitForTimeout(100);
  }

  return null;
}

async function setPaintMode(page: Page, enabled: boolean) {
  await page.evaluate((nextEnabled) => {
    window.__goldbergTestState?.setPaintMode(nextEnabled);
  }, enabled);
}

async function setPlaybackState(page: Page, isPlaying: boolean) {
  await page.evaluate((nextIsPlaying) => {
    window.__goldbergTestState?.setPlaybackState(nextIsPlaying);
  }, isPlaying);
}

async function setAutoRotateEnabled(page: Page, enabled: boolean) {
  await page.evaluate((nextEnabled) => {
    window.__goldbergTestState?.setAutoRotateEnabled(nextEnabled);
  }, enabled);
}

async function setBrushTerrainKind(page: Page, terrainKind: 'water' | 'land') {
  await page.evaluate((nextTerrainKind) => {
    window.__goldbergTestState?.setBrushTerrainKind(nextTerrainKind);
  }, terrainKind);
}

async function getSelectedCellSummary(page: Page) {
  return page.evaluate(() => window.__goldbergTestState?.getSelectedCellSummary() ?? null);
}

async function getCellTerrainKind(page: Page, cellId: number) {
  return page.evaluate((nextCellId) => window.__goldbergTestState?.getCellTerrainKind(nextCellId) ?? null, cellId);
}

async function enterPaintMode(page: Page) {
  const paintButton = page.locator('[data-action="paint-mode"]');
  const brush = page.locator('[data-action="brush"]');

  await setPaintMode(page, true);
  await expect(paintButton).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-stat="paint-state"]')).toHaveText('Editing');
  await expect(page.locator('[data-stat="tool-mode"]')).toHaveText('Paint');
  await expect(brush).toBeVisible();
  await expect(brush).toBeEnabled();

  return { paintButton, brush };
}

async function dragAcrossCanvas(
  page: Page,
  start: { x: number; y: number },
  end: { x: number; y: number },
  steps: number
) {
  await page.evaluate(
    ({ start, end, steps }) => {
      const canvas = document.querySelector('canvas');
      if (!(canvas instanceof HTMLCanvasElement)) {
        throw new Error('Canvas element was not available.');
      }

      const dispatchPointer = (
        target: EventTarget,
        type: string,
        clientX: number,
        clientY: number,
        buttons: number
      ) => {
        target.dispatchEvent(new PointerEvent(type, {
          bubbles: true,
          button: 0,
          buttons,
          clientX,
          clientY,
          pointerId: 1,
          pointerType: 'mouse'
        }));
      };

      dispatchPointer(canvas, 'pointermove', start.x, start.y, 0);
      dispatchPointer(canvas, 'pointerdown', start.x, start.y, 1);

      for (let step = 1; step <= steps; step += 1) {
        const progress = step / steps;
        const x = start.x + (end.x - start.x) * progress;
        const y = start.y + (end.y - start.y) * progress;
        dispatchPointer(canvas, 'pointermove', x, y, 1);
      }

      dispatchPointer(canvas, 'pointerup', end.x, end.y, 0);
      dispatchPointer(window, 'pointerup', end.x, end.y, 0);
    },
    { start, end, steps }
  );
}

function getVectorLength(position: [number, number, number]) {
  return Math.sqrt(position[0] ** 2 + position[1] ** 2 + position[2] ** 2);
}

test('Goldberg シミュレーション画面が表示される', async ({ page }) => {
  await gotoApp(page);

  await expect(
    page.getByRole('heading', { name: 'Shape rivers. Watch biomes spread.' })
  ).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByText('Planetary Cell Study')).toBeVisible();
  await expect(page.locator('[data-stat="frequency"]')).toHaveText('10');
});

test('セル未選択時は主要コントロールが表示される', async ({ page }) => {
  await gotoApp(page);

  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Auto Rotate' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'View' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Paint' })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: 'Step' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Randomize' })).toBeVisible();
  await expect(page.locator('[data-panel="simulation"]')).toBeVisible();
  await expect(page.locator('.overlay-tool')).toBeVisible();
  await expect(page.locator('.overlay-viewport-status')).toBeVisible();
  await expect(page.locator('[data-stat="selected"]')).toHaveText('none');
  await expect(page.locator('[data-stat="tool-mode"]')).toHaveText('View');
  await expect(page.locator('[data-stat="camera-state"]')).toHaveText('Free');
  await expect(page.locator('[data-stat="paint-state"]')).toHaveText('Surveying');
  await expect(page.locator('[data-stat="viewport-hint"]')).toHaveText('Drag to orbit. Scroll to zoom.');
});

test('モード切り替えに応じて viewport のガイドと操作状態が切り替わる', async ({ page }) => {
  await gotoApp(page);

  await enterPaintMode(page);

  await expect(page.locator('[data-panel="simulation"]')).toBeVisible();
  await expect(page.locator('.overlay-tool')).toBeVisible();
  await expect(page.locator('.overlay-viewport-status')).toBeVisible();
  await expect(page.locator('[data-stat="brush-state"]')).toHaveText('Brush: land');
  await expect(page.locator('[data-stat="tool-mode"]')).toHaveText('Paint');
  await expect(page.locator('[data-stat="viewport-hint"]')).toContainText('Brush land.');
  await expect(page.locator('[data-stat="camera-state"]')).toHaveText('Locked');

  await setPaintMode(page, false);

  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  await expect(page.locator('[data-panel="simulation"]')).toBeVisible();
  await expect(page.locator('.overlay-tool')).toBeVisible();
  await expect(page.locator('.overlay-viewport-status')).toBeVisible();
  await expect(page.locator('[data-stat="tool-mode"]')).toHaveText('View');
  await expect(page.locator('[data-stat="viewport-hint"]')).toHaveText('Drag to orbit. Scroll to zoom.');
});

test('一時停止と回転のコントロールを切り替えられる', async ({ page }) => {
  await gotoApp(page);

  await setPlaybackState(page, false);
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  await setPlaybackState(page, true);
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();

  await setAutoRotateEnabled(page, true);
  await expect(page.getByRole('button', { name: 'Stop Rotation' })).toBeVisible();
  await setAutoRotateEnabled(page, false);
  await expect(page.getByRole('button', { name: 'Auto Rotate' })).toBeVisible();
});

test('閲覧モードではドラッグしてカメラを回転できる', async ({ page }) => {
  await gotoApp(page);

  await setAutoRotateEnabled(page, false);
  const before = await getCameraPosition(page);
  if (!before) {
    throw new Error('Camera position hook was not available.');
  }

  await page.evaluate(() => {
    window.__goldbergTestState?.rotateCameraByPixels(140, 30);
  });
  await page.waitForTimeout(150);

  const after = await getCameraPosition(page);
  if (!after) {
    throw new Error('Camera position hook was not available after dragging.');
  }

  expect(after).not.toEqual(before);
});

test('閲覧モードで下方向にドラッグするとカメラは上方向へ回る', async ({ page }) => {
  await gotoApp(page);

  await setAutoRotateEnabled(page, false);
  const before = await getCameraPosition(page);
  if (!before) {
    throw new Error('Camera position hook was not available.');
  }

  await page.evaluate(() => {
    window.__goldbergTestState?.rotateCameraByPixels(0, 120);
  });
  await page.waitForTimeout(150);

  const after = await getCameraPosition(page);
  if (!after) {
    throw new Error('Camera position hook was not available after vertical dragging.');
  }

  expect(after[1]).toBeGreaterThan(before[1]);
});

test('閲覧モードではホイールでズームできる', async ({ page }) => {
  await gotoApp(page);

  await setAutoRotateEnabled(page, false);
  const before = await getCameraPosition(page);
  if (!before) {
    throw new Error('Camera position hook was not available.');
  }

  await page.evaluate(() => {
    window.__goldbergTestState?.zoomCameraByDelta(320);
  });
  await page.waitForTimeout(150);

  const after = await getCameraPosition(page);
  if (!after) {
    throw new Error('Camera position hook was not available after zooming.');
  }

  expect(getVectorLength(after)).toBeGreaterThan(getVectorLength(before));
});

test('canvas 上のセルを選択すると selection detail が更新される', async ({ page }) => {
  await gotoApp(page);

  await setAutoRotateEnabled(page, false);
  const target = await getInteractiveCanvasPoint(page);
  if (!target) {
    throw new Error('Interactive canvas point was not available.');
  }

  await page.mouse.click(target.x, target.y);

  await expect(page.locator('[data-stat="selected"]')).not.toHaveText('none');
  await expect(page.locator('[data-stat="terrain"]')).not.toHaveText('-');
});

test('ペイントモードで選択セルの terrain を直接切り替えられる', async ({ page }) => {
  await gotoApp(page);

  const target = await getInteractiveCanvasPoint(page);
  if (!target) {
    throw new Error('Interactive canvas point was not available.');
  }

  const currentTerrain = await getCellTerrainKind(page, target.cellId);
  const nextTerrain = currentTerrain === 'water' ? 'land' : 'water';

  await setPaintMode(page, true);
  await setBrushTerrainKind(page, nextTerrain);
  await page.evaluate((point) => {
    window.__goldbergTestState?.paintStroke([point]);
  }, target);

  const summary = await getSelectedCellSummary(page);
  expect(summary?.cellId).toBe(target.cellId);
  expect(summary?.terrainKind).toBe(nextTerrain);
});

test('ペイントモードではドラッグして複数セルにまたがる操作ができる', async ({ page }) => {
  await gotoApp(page);

  const { box } = await getCanvasCenter(page);
  const target = await getInteractiveCanvasPoint(page);
  if (!target) {
    throw new Error('Interactive canvas point was not available.');
  }

  const end = { x: box.x + box.width * 0.72, y: target.y };
  const points = Array.from({ length: 17 }, (_, index) => {
    const progress = index / 16;
    return {
      x: target.x + (end.x - target.x) * progress,
      y: target.y + (end.y - target.y) * progress
    };
  });

  await setPaintMode(page, true);
  await setBrushTerrainKind(page, 'land');
  await page.evaluate((strokePoints) => {
    window.__goldbergTestState?.paintStroke(strokePoints);
  }, points);

  const summary = await getSelectedCellSummary(page);
  expect(summary?.cellId).not.toBeNull();
  expect(summary?.terrainKind).toBe('land');
  expect(await getCellTerrainKind(page, target.cellId)).toBe('land');
});

test('ペイントモード中のドラッグではカメラが回転しない', async ({ page }) => {
  await gotoApp(page);

  const target = await getInteractiveCanvasPoint(page);
  if (!target) {
    throw new Error('Interactive canvas point was not available.');
  }

  await setPaintMode(page, true);
  const before = await getCameraPosition(page);
  if (!before) {
    throw new Error('Camera position hook was not available.');
  }

  await dragAcrossCanvas(
    page,
    { x: target.x, y: target.y },
    { x: target.x + 160, y: target.y },
    20
  );

  const after = await getCameraPosition(page);
  if (!after) {
    throw new Error('Camera position hook was not available after dragging.');
  }

  expect(after).toEqual(before);
});
