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
