import { expect, test } from '@playwright/test';

test('renders the Goldberg simulation shell', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'Water basins drive vegetation across the planet' })
  ).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByText('Goldberg多面体セルシミュレーション')).toBeVisible();
  await expect(page.locator('[data-stat="frequency"]')).toHaveText('10');
});

test('shows the main controls with terrain editing disabled before selection', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Stop Rotation' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Step' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Randomize' })).toBeVisible();
  await expect(page.locator('[data-action="terrain"]')).toBeDisabled();
  await expect(page.locator('[data-stat="selected"]')).toHaveText('none');
});

test('toggles pause and rotation controls', async ({ page }) => {
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

test('selects a cell from the canvas and enables terrain editing', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Stop Rotation' }).click();
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();

  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error('Canvas bounding box was not available.');
  }

  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

  await expect(page.locator('[data-stat="selected"]')).not.toHaveText('none');
  await expect(page.locator('[data-action="terrain"]')).toBeEnabled();
});
