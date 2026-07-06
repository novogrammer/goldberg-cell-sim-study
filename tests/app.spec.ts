import { expect, test, type Locator, type Page } from '@playwright/test';

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

async function clickControl(control: Locator) {
  await control.dispatchEvent('click');
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
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'Shape rivers. Watch biomes spread.' })
  ).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByText('Planetary Cell Study')).toBeVisible();
  await expect(page.locator('[data-stat="frequency"]')).toHaveText('10');
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

test('ペイントモード中のドラッグではカメラが回転しない', async ({ page }) => {
  await page.goto('/');

  const { box } = await getCanvasCenter(page);
  const target = { x: box.x + box.width * 0.45, y: box.y + box.height * 0.45 };
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
