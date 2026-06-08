import { expect, test, type Page } from '@playwright/test';

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
  return page.evaluate(() => window.__goldbergTestState?.getInteractiveCanvasPoint() ?? null);
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

test('セル未選択時は主要コントロールが表示され terrain 編集が無効になっている', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Auto Rotate' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'View' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Paint' })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: 'Step' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Randomize' })).toBeVisible();
  await expect(page.locator('[data-action="brush"]')).toHaveValue('land');
  await expect(page.locator('[data-action="terrain"]')).toBeDisabled();
  await expect(page.locator('[data-stat="selected"]')).toHaveText('none');
  await expect(page.locator('[data-stat="mode-label"]')).toHaveText('View mode');
  await expect(page.locator('[data-stat="camera-state"]')).toHaveText('Camera unlocked');
  await expect(page.locator('[data-stat="viewport-mode"]')).toHaveText('View mode');
  await expect(page.locator('[data-stat="viewport-hint"]')).toHaveText('Drag to orbit and scroll to zoom.');
});

test('モード切り替えに応じて viewport のガイドと操作状態が切り替わる', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Paint' }).click();

  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  await expect(page.locator('[data-stat="viewport-mode"]')).toHaveText('Paint mode');
  await expect(page.locator('[data-stat="viewport-hint"]')).toContainText('Brush land.');
  await expect(page.locator('[data-stat="camera-state"]')).toHaveText('Camera locked for painting');
  await expect(page.getByRole('button', { name: 'Auto Rotate' })).toBeDisabled();
  await expect(page.locator('[data-action="speed"]')).toBeDisabled();

  await page.getByRole('button', { name: 'View' }).click();

  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  await expect(page.locator('[data-stat="viewport-mode"]')).toHaveText('View mode');
  await expect(page.locator('[data-stat="viewport-hint"]')).toHaveText('Drag to orbit and scroll to zoom.');
  await expect(page.getByRole('button', { name: 'Auto Rotate' })).toBeEnabled();
  await expect(page.locator('[data-action="speed"]')).toBeEnabled();
});

test('一時停止と回転のコントロールを切り替えられる', async ({ page }) => {
  await page.goto('/');

  const pauseButton = page.getByRole('button', { name: 'Pause' });
  const rotateButton = page.getByRole('button', { name: 'Auto Rotate' });

  await pauseButton.click();
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();

  await rotateButton.click();
  await expect(page.getByRole('button', { name: 'Stop Rotation' })).toBeVisible();
  await page.getByRole('button', { name: 'Stop Rotation' }).click();
  await expect(page.getByRole('button', { name: 'Auto Rotate' })).toBeVisible();
});

test('閲覧モードではドラッグしてカメラを回転できる', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Auto Rotate' }).click();
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

  await page.getByRole('button', { name: 'Auto Rotate' }).click();
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

  await page.getByRole('button', { name: 'Auto Rotate' }).click();
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

test('canvas 上のセルを選択すると terrain 編集が有効になる', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Auto Rotate' }).click();
  const target = await getInteractiveCanvasPoint(page);
  if (!target) {
    throw new Error('Interactive canvas point was not available.');
  }

  await page.mouse.click(target.x, target.y);

  await expect(page.locator('[data-stat="selected"]')).not.toHaveText('none');
  await expect(page.locator('[data-action="terrain"]')).toBeEnabled();
});

test('ペイントモードで選択セルの terrain を直接切り替えられる', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Auto Rotate' }).click();
  const target = await getInteractiveCanvasPoint(page);
  if (!target) {
    throw new Error('Interactive canvas point was not available.');
  }

  await page.mouse.click(target.x, target.y);
  const terrainStat = page.locator('[data-stat="terrain"]');
  const currentTerrain = await terrainStat.textContent();
  const nextTerrain = currentTerrain === 'water' ? 'land' : 'water';

  await page.locator('[data-action="brush"]').selectOption(nextTerrain);
  await page.getByRole('button', { name: 'Paint' }).click();
  await expect(page.getByRole('button', { name: 'Paint' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-stat="paint-state"]')).toHaveText('Active');

  await page.mouse.click(target.x, target.y);

  await expect(terrainStat).toHaveText(nextTerrain);
});

test('ペイントモードではドラッグして複数セルにまたがる操作ができる', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Auto Rotate' }).click();
  const { box } = await getCanvasCenter(page);
  const target = await getInteractiveCanvasPoint(page);
  if (!target) {
    throw new Error('Interactive canvas point was not available.');
  }

  await page.locator('[data-action="brush"]').selectOption('land');
  await page.getByRole('button', { name: 'Paint' }).click();

  await page.mouse.move(target.x, target.y);
  await page.mouse.down();
  await expect(page.locator('[data-stat="selected"]')).not.toHaveText('none');
  const firstSelected = await page.locator('[data-stat="selected"]').textContent();

  await page.mouse.move(box.x + box.width * 0.72, target.y, { steps: 16 });
  await page.mouse.up();

  await expect(page.locator('[data-stat="selected"]')).not.toHaveText(firstSelected ?? 'none');
  await expect(page.locator('[data-stat="terrain"]')).toHaveText('land');
});

test('ペイントモード中のドラッグではカメラが回転しない', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('button', { name: 'Auto Rotate' })).toBeVisible();
  const target = await getInteractiveCanvasPoint(page);
  if (!target) {
    throw new Error('Interactive canvas point was not available.');
  }

  await page.getByRole('button', { name: 'Paint' }).click();
  await expect(page.getByRole('button', { name: 'Paint' })).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(250);
  const before = await getCameraPosition(page);
  if (!before) {
    throw new Error('Camera position hook was not available.');
  }

  await page.mouse.move(target.x, target.y);
  await page.mouse.down();
  await page.mouse.move(target.x + 160, target.y, { steps: 20 });
  await page.mouse.up();
  await page.waitForTimeout(50);

  const after = await getCameraPosition(page);
  if (!after) {
    throw new Error('Camera position hook was not available after dragging.');
  }

  expect(after).toEqual(before);
});
