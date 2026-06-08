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
  await expect(page.getByRole('button', { name: 'Stop Rotation' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Paint Mode: Off' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Step' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Randomize' })).toBeVisible();
  await expect(page.locator('[data-action="brush"]')).toHaveValue('land');
  await expect(page.locator('[data-action="terrain"]')).toBeDisabled();
  await expect(page.locator('[data-stat="selected"]')).toHaveText('none');
});

test('一時停止と回転のコントロールを切り替えられる', async ({ page }) => {
  await page.goto('/');

  const pauseButton = page.getByRole('button', { name: 'Pause' });
  const rotateButton = page.getByRole('button', { name: 'Stop Rotation' });

  await pauseButton.click();
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();

  await rotateButton.click();
  await expect(page.getByRole('button', { name: 'Auto Rotate' })).toBeVisible();
  await page.getByRole('button', { name: 'Auto Rotate' }).click();
  await expect(page.getByRole('button', { name: 'Stop Rotation' })).toBeVisible();
});

test('閲覧モードではドラッグしてカメラを回転できる', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Stop Rotation' }).click();
  const { centerX, centerY } = await getCanvasCenter(page);
  const before = await getCameraPosition(page);
  if (!before) {
    throw new Error('Camera position hook was not available.');
  }

  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX + 140, centerY + 30, { steps: 20 });
  await page.mouse.up();
  await page.waitForTimeout(150);

  const after = await getCameraPosition(page);
  if (!after) {
    throw new Error('Camera position hook was not available after dragging.');
  }

  expect(after).not.toEqual(before);
});

test('閲覧モードで下方向にドラッグするとカメラは上方向へ回る', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Stop Rotation' }).click();
  const { centerX, centerY } = await getCanvasCenter(page);
  const before = await getCameraPosition(page);
  if (!before) {
    throw new Error('Camera position hook was not available.');
  }

  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX, centerY + 120, { steps: 20 });
  await page.mouse.up();
  await page.waitForTimeout(150);

  const after = await getCameraPosition(page);
  if (!after) {
    throw new Error('Camera position hook was not available after vertical dragging.');
  }

  expect(after[1]).toBeGreaterThan(before[1]);
});

test('閲覧モードではホイールでズームできる', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Stop Rotation' }).click();
  const { centerX, centerY } = await getCanvasCenter(page);
  const before = await getCameraPosition(page);
  if (!before) {
    throw new Error('Camera position hook was not available.');
  }

  await page.mouse.move(centerX, centerY);
  await page.mouse.wheel(0, 320);
  await page.waitForTimeout(150);

  const after = await getCameraPosition(page);
  if (!after) {
    throw new Error('Camera position hook was not available after zooming.');
  }

  expect(getVectorLength(after)).toBeGreaterThan(getVectorLength(before));
});

test('canvas 上のセルを選択すると terrain 編集が有効になる', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Stop Rotation' }).click();
  const { centerX, centerY } = await getCanvasCenter(page);

  await page.mouse.click(centerX, centerY);

  await expect(page.locator('[data-stat="selected"]')).not.toHaveText('none');
  await expect(page.locator('[data-action="terrain"]')).toBeEnabled();
});

test('ペイントモードで選択セルの terrain を直接切り替えられる', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Stop Rotation' }).click();
  const { centerX, centerY } = await getCanvasCenter(page);

  await page.mouse.click(centerX, centerY);
  const terrainStat = page.locator('[data-stat="terrain"]');
  const currentTerrain = await terrainStat.textContent();
  const nextTerrain = currentTerrain === 'water' ? 'land' : 'water';

  await page.locator('[data-action="brush"]').selectOption(nextTerrain);
  await page.getByRole('button', { name: 'Paint Mode: Off' }).click();
  await expect(page.getByRole('button', { name: 'Paint Mode: On' })).toBeVisible();

  await page.mouse.click(centerX, centerY);

  await expect(terrainStat).toHaveText(nextTerrain);
});

test('ペイントモードではドラッグして複数セルにまたがる操作ができる', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Stop Rotation' }).click();
  const { centerX, centerY, box } = await getCanvasCenter(page);

  await page.locator('[data-action="brush"]').selectOption('land');
  await page.getByRole('button', { name: 'Paint Mode: Off' }).click();

  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await expect(page.locator('[data-stat="selected"]')).not.toHaveText('none');
  const firstSelected = await page.locator('[data-stat="selected"]').textContent();

  await page.mouse.move(box.x + box.width * 0.72, centerY, { steps: 16 });
  await page.mouse.up();

  await expect(page.locator('[data-stat="selected"]')).not.toHaveText(firstSelected ?? 'none');
  await expect(page.locator('[data-stat="terrain"]')).toHaveText('land');
});

test('ペイントモード中のドラッグではカメラが回転しない', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Stop Rotation' }).click();
  await expect(page.getByRole('button', { name: 'Auto Rotate' })).toBeVisible();
  const { centerX, centerY } = await getCanvasCenter(page);

  await page.getByRole('button', { name: 'Paint Mode: Off' }).click();
  await expect(page.getByRole('button', { name: 'Paint Mode: On' })).toBeVisible();
  await page.waitForTimeout(250);
  const before = await getCameraPosition(page);
  if (!before) {
    throw new Error('Camera position hook was not available.');
  }

  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX + 160, centerY, { steps: 20 });
  await page.mouse.up();
  await page.waitForTimeout(50);

  const after = await getCameraPosition(page);
  if (!after) {
    throw new Error('Camera position hook was not available after dragging.');
  }

  expect(after).toEqual(before);
});
