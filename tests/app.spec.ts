import { expect, test, type Locator, type Page } from '@playwright/test';

async function getCanvasCenter(page: Page) {
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();

  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error('Canvas bounding box was not available.');
  }

  return {
    canvas,
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

async function clickControl(control: Locator) {
  await control.dispatchEvent('click');
}

async function enterPaintMode(page: Page) {
  const paintButton = page.getByRole('button', { name: 'Paint' });
  const brush = page.locator('[data-action="brush"]');

  await clickControl(paintButton);
  await expect(paintButton).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-stat="paint-state"]')).toHaveText('Active');
  await expect(page.locator('[data-stat="viewport-mode"]')).toHaveText('Paint mode');
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
  await page.locator('canvas').evaluate(
    (canvas, { start, end, steps }) => {
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
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'Water basins drive vegetation across the planet' })
  ).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByText('Goldberg Polyhedron Cell Simulation')).toBeVisible();
  await expect(page.locator('[data-stat="frequency"]')).toHaveText('10');
});

test('セル未選択時は主要コントロールが表示される', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Auto Rotate' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'View' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Paint' })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: 'Step' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Randomize' })).toBeVisible();
  await expect(page.locator('[data-panel="simulation"]')).toBeVisible();
  await expect(page.locator('[data-panel="camera"]')).toBeVisible();
  await expect(page.locator('[data-panel="paint"]')).toBeHidden();
  await expect(page.locator('[data-action="terrain"]')).toHaveCount(0);
  await expect(page.locator('[data-stat="selected"]')).toHaveText('none');
  await expect(page.locator('[data-stat="mode-label"]')).toHaveText('View mode');
  await expect(page.locator('[data-stat="camera-state"]')).toHaveText('Camera unlocked');
  await expect(page.locator('[data-stat="viewport-mode"]')).toHaveText('View mode');
  await expect(page.locator('[data-stat="viewport-hint"]')).toHaveText('Drag to orbit and scroll to zoom.');
});

test('モード切り替えに応じて viewport のガイドと操作状態が切り替わる', async ({ page }) => {
  await page.goto('/');

  await enterPaintMode(page);

  await expect(page.locator('[data-panel="simulation"]')).toBeHidden();
  await expect(page.locator('[data-panel="camera"]')).toBeHidden();
  await expect(page.locator('[data-panel="paint"]')).toBeVisible();
  await expect(page.locator('[data-action="brush"]')).toHaveValue('land');
  await expect(page.locator('[data-stat="viewport-mode"]')).toHaveText('Paint mode');
  await expect(page.locator('[data-stat="viewport-hint"]')).toContainText('Brush land.');
  await expect(page.locator('[data-stat="camera-state"]')).toHaveText('Camera locked for painting');
  await expect(page.getByRole('button', { name: 'Auto Rotate' })).toBeHidden();
  await expect(page.locator('[data-action="speed"]')).toBeHidden();

  await clickControl(page.getByRole('button', { name: 'View' }));

  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  await expect(page.locator('[data-panel="simulation"]')).toBeVisible();
  await expect(page.locator('[data-panel="camera"]')).toBeVisible();
  await expect(page.locator('[data-panel="paint"]')).toBeHidden();
  await expect(page.locator('[data-stat="viewport-mode"]')).toHaveText('View mode');
  await expect(page.locator('[data-stat="viewport-hint"]')).toHaveText('Drag to orbit and scroll to zoom.');
  await expect(page.getByRole('button', { name: 'Auto Rotate' })).toBeEnabled();
  await expect(page.locator('[data-action="speed"]')).toBeEnabled();
});

test('一時停止と回転のコントロールを切り替えられる', async ({ page }) => {
  await page.goto('/');

  const pauseButton = page.getByRole('button', { name: 'Pause' });
  const rotateButton = page.getByRole('button', { name: 'Auto Rotate' });

  await clickControl(pauseButton);
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  await clickControl(page.getByRole('button', { name: 'Play' }));
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();

  await clickControl(rotateButton);
  await expect(page.getByRole('button', { name: 'Stop Rotation' })).toBeVisible();
  await clickControl(page.getByRole('button', { name: 'Stop Rotation' }));
  await expect(page.getByRole('button', { name: 'Auto Rotate' })).toBeVisible();
});

test('閲覧モードではドラッグしてカメラを回転できる', async ({ page }) => {
  await page.goto('/');

  await clickControl(page.getByRole('button', { name: 'Auto Rotate' }));
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
  await page.goto('/');

  await clickControl(page.getByRole('button', { name: 'Auto Rotate' }));
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
  await page.goto('/');

  await clickControl(page.getByRole('button', { name: 'Auto Rotate' }));
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
  await page.goto('/');

  await clickControl(page.getByRole('button', { name: 'Auto Rotate' }));
  const target = await getInteractiveCanvasPoint(page);
  if (!target) {
    throw new Error('Interactive canvas point was not available.');
  }

  await page.mouse.click(target.x, target.y);

  await expect(page.locator('[data-stat="selected"]')).not.toHaveText('none');
  await expect(page.locator('[data-stat="terrain"]')).not.toHaveText('-');
});

test('ペイントモードで選択セルの terrain を直接切り替えられる', async ({ page }) => {
  await page.goto('/');

  await clickControl(page.getByRole('button', { name: 'Auto Rotate' }));
  const target = await getInteractiveCanvasPoint(page);
  if (!target) {
    throw new Error('Interactive canvas point was not available.');
  }

  await page.mouse.click(target.x, target.y);
  const terrainStat = page.locator('[data-stat="terrain"]');
  const currentTerrain = await terrainStat.textContent();
  const nextTerrain = currentTerrain === 'water' ? 'land' : 'water';

  const { brush } = await enterPaintMode(page);
  await brush.selectOption(nextTerrain);

  await page.mouse.click(target.x, target.y);

  await expect(terrainStat).toHaveText(nextTerrain);
});

test('ペイントモードではドラッグして複数セルにまたがる操作ができる', async ({ page }) => {
  await page.goto('/');

  await clickControl(page.getByRole('button', { name: 'Auto Rotate' }));
  const { box } = await getCanvasCenter(page);
  const target = await getInteractiveCanvasPoint(page);
  if (!target) {
    throw new Error('Interactive canvas point was not available.');
  }

  const { brush } = await enterPaintMode(page);
  await brush.selectOption('land');
  await dragAcrossCanvas(
    page,
    { x: target.x, y: target.y },
    { x: box.x + box.width * 0.72, y: target.y },
    16
  );

  await expect(page.locator('[data-stat="selected"]')).not.toHaveText('none');
  await expect(page.locator('[data-stat="terrain"]')).toHaveText('land');
});

test('ペイントモード中のドラッグではカメラが回転しない', async ({ page }) => {
  await page.goto('/');

  await clickControl(page.getByRole('button', { name: 'Auto Rotate' }));
  const target = await getInteractiveCanvasPoint(page);
  if (!target) {
    throw new Error('Interactive canvas point was not available.');
  }

  await enterPaintMode(page);
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
  await page.waitForTimeout(50);

  const after = await getCameraPosition(page);
  if (!after) {
    throw new Error('Camera position hook was not available after dragging.');
  }

  expect(after).toEqual(before);
});
