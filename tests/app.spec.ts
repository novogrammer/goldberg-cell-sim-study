import { expect, test, type Page } from '@playwright/test';

const APP_READY_TIMEOUT_MS = 8_000;
const CAMERA_SETTLE_TIMEOUT_MS = 2_000;
const CAMERA_POSITION_TOLERANCE = 0.0001;

type BrowserEventLog = {
  console: Array<{
    type: string;
    text: string;
    location: { url?: string; lineNumber?: number; columnNumber?: number };
  }>;
  pageErrors: string[];
  requestFailures: Array<{ url: string; failure: string | null }>;
};

type AppDiagnostics = {
  bootstrapStage: string | null;
  camera: { x: string | null; y: string | null; z: string | null };
  initError: string | null;
  ready: string | null;
  selected: string | null;
  terrain: string | null;
  toolMode: string | null;
  viewportHint: string | null;
};

type CameraPosition = [number, number, number];

type CanvasPoint = {
  absoluteX: number;
  absoluteY: number;
  relativeX: number;
  relativeY: number;
};

type SelectablePoint = CanvasPoint & {
  selectedLabel: string;
  terrain: string;
};

const pageLogs = new WeakMap<Page, BrowserEventLog>();

function getOrCreatePageLogs(page: Page): BrowserEventLog {
  const existing = pageLogs.get(page);
  if (existing) {
    return existing;
  }

  const created: BrowserEventLog = {
    console: [],
    pageErrors: [],
    requestFailures: []
  };
  pageLogs.set(page, created);
  return created;
}

async function collectAppDiagnostics(page: Page): Promise<AppDiagnostics> {
  const html = page.locator('html');
  return {
    bootstrapStage: await html.getAttribute('data-goldberg-bootstrap-stage'),
    camera: {
      x: await html.getAttribute('data-goldberg-camera-x'),
      y: await html.getAttribute('data-goldberg-camera-y'),
      z: await html.getAttribute('data-goldberg-camera-z')
    },
    initError: await html.getAttribute('data-goldberg-app-init-error'),
    ready: await html.getAttribute('data-goldberg-app-ready'),
    selected: await page.locator('[data-stat="selected"]').textContent(),
    terrain: await page.locator('[data-stat="terrain"]').textContent(),
    toolMode: await page.locator('[data-stat="tool-mode"]').textContent(),
    viewportHint: await page.locator('[data-stat="viewport-hint"]').textContent()
  };
}

async function gotoApp(page: Page) {
  await page.goto('/');
  const html = page.locator('html');
  await expect
    .poll(
      async () => {
        const ready = await html.getAttribute('data-goldberg-app-ready');
        const initError = await html.getAttribute('data-goldberg-app-init-error');
        if (initError === 'true') {
          return 'init-error';
        }
        return ready === 'true' ? 'ready' : 'booting';
      },
      { timeout: APP_READY_TIMEOUT_MS }
    )
    .toMatch(/^(ready|init-error)$/);
  const initError = await html.getAttribute('data-goldberg-app-init-error');
  if (initError === 'true') {
    throw new Error('Simulation app failed to initialize.');
  }
  await expect(html).toHaveAttribute('data-goldberg-app-ready', 'true', {
    timeout: APP_READY_TIMEOUT_MS
  });
}

test.beforeEach(async ({ page }) => {
  const logs = getOrCreatePageLogs(page);

  page.on('console', (message) => {
    logs.console.push({
      type: message.type(),
      text: message.text(),
      location: message.location()
    });
  });

  page.on('pageerror', (error) => {
    logs.pageErrors.push(error.stack ?? error.message);
  });

  page.on('requestfailed', (request) => {
    logs.requestFailures.push({
      url: request.url(),
      failure: request.failure()?.errorText ?? null
    });
  });
});

test.afterEach(async ({ page }, testInfo) => {
  const logs = getOrCreatePageLogs(page);
  const logBody = JSON.stringify(logs, null, 2);
  await testInfo.attach('browser-events', {
    body: logBody,
    contentType: 'application/json'
  });

  try {
    const diagnostics = await collectAppDiagnostics(page);
    await testInfo.attach('app-diagnostics', {
      body: JSON.stringify(diagnostics, null, 2),
      contentType: 'application/json'
    });
  } catch (error) {
    await testInfo.attach('app-diagnostics-error', {
      body: String(error),
      contentType: 'text/plain'
    });
  }

  if (testInfo.status !== testInfo.expectedStatus) {
    try {
      await testInfo.attach('failure-screenshot', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png'
      });
    } catch (error) {
      await testInfo.attach('failure-screenshot-error', {
        body: String(error),
        contentType: 'text/plain'
      });
    }
  }
});

async function getCanvasBox(page: Page) {
  const box = await page.locator('canvas').boundingBox();
  if (!box) {
    throw new Error('Canvas bounding box was not available.');
  }

  return box;
}

function parseCameraAxis(axis: string | null, name: string) {
  if (!axis) {
    throw new Error(`Camera telemetry ${name} was not available.`);
  }

  const parsed = Number(axis);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Camera telemetry ${name} was invalid: ${axis}`);
  }

  return parsed;
}

async function getCameraPosition(page: Page): Promise<CameraPosition> {
  const html = page.locator('html');
  return [
    parseCameraAxis(await html.getAttribute('data-goldberg-camera-x'), 'x'),
    parseCameraAxis(await html.getAttribute('data-goldberg-camera-y'), 'y'),
    parseCameraAxis(await html.getAttribute('data-goldberg-camera-z'), 'z')
  ];
}

function toCanvasPoint(box: Awaited<ReturnType<typeof getCanvasBox>>, u: number, v: number): CanvasPoint {
  return {
    absoluteX: box.x + box.width * u,
    absoluteY: box.y + box.height * v,
    relativeX: box.width * u,
    relativeY: box.height * v
  };
}

async function clickCanvasPoint(page: Page, point: CanvasPoint) {
  await page.locator('canvas').click({
    position: {
      x: point.relativeX,
      y: point.relativeY
    }
  });
}

async function findSelectablePoint(page: Page): Promise<SelectablePoint> {
  const box = await getCanvasBox(page);
  const probes = [
    toCanvasPoint(box, 0.5, 0.5),
    toCanvasPoint(box, 0.46, 0.5),
    toCanvasPoint(box, 0.54, 0.5),
    toCanvasPoint(box, 0.5, 0.44),
    toCanvasPoint(box, 0.5, 0.56),
    toCanvasPoint(box, 0.42, 0.46),
    toCanvasPoint(box, 0.58, 0.54),
    toCanvasPoint(box, 0.38, 0.5),
    toCanvasPoint(box, 0.62, 0.5)
  ];

  let fallback: SelectablePoint | null = null;

  for (const point of probes) {
    await clickCanvasPoint(page, point);
    const selectedLabel = (await page.locator('[data-stat="selected"]').textContent())?.trim() ?? '';
    if (selectedLabel === '' || selectedLabel === 'none') {
      continue;
    }

    const terrain = (await page.locator('[data-stat="terrain"]').textContent())?.trim() ?? '';
    const nextPoint: SelectablePoint = {
      ...point,
      selectedLabel,
      terrain
    };
    if (terrain === 'land') {
      return nextPoint;
    }
    fallback = nextPoint;
  }

  if (fallback) {
    throw new Error('Only water probe points were selectable.');
  }

  throw new Error('Interactive canvas point was not available.');
}

async function setPaintMode(page: Page, enabled: boolean) {
  const button = page.locator(enabled ? '[data-action="paint-mode"]' : '[data-action="view-mode"]');
  await button.click();
  await expect(page.getByRole('button', { name: enabled ? 'Paint' : 'View' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
}

async function setBrushTerrainKind(page: Page, terrainKind: 'water' | 'land') {
  await page.locator('[data-action="brush"]').selectOption(terrainKind);
}

async function setAutoRotateEnabled(page: Page, enabled: boolean) {
  const rotateButton = page.locator('[data-action="rotate"]');
  await expect(rotateButton).toHaveText(enabled ? 'Stop Rotation' : 'Auto Rotate');
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

async function dragAcrossCanvas(page: Page, start: CanvasPoint, end: CanvasPoint, steps: number) {
  await page.mouse.move(start.absoluteX, start.absoluteY);
  await page.mouse.down();

  for (let step = 1; step <= steps; step += 1) {
    const progress = step / steps;
    await page.mouse.move(
      start.absoluteX + (end.absoluteX - start.absoluteX) * progress,
      start.absoluteY + (end.absoluteY - start.absoluteY) * progress
    );
  }

  await page.mouse.up();
}

async function waitForCameraPositionChange(page: Page, before: CameraPosition) {
  await expect
    .poll(async () => getCameraPosition(page), { timeout: CAMERA_SETTLE_TIMEOUT_MS })
    .not.toEqual(before);
}

function cameraPositionsEqual(a: CameraPosition, b: CameraPosition) {
  return a.every((value, index) => Math.abs(value - b[index]) <= CAMERA_POSITION_TOLERANCE);
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

  await page.locator('[data-action="toggle"]').click();
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  await page.locator('[data-action="toggle"]').click();
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();

  await page.locator('[data-action="rotate"]').click();
  await expect(page.getByRole('button', { name: 'Stop Rotation' })).toBeVisible();
  await page.locator('[data-action="rotate"]').click();
  await expect(page.getByRole('button', { name: 'Auto Rotate' })).toBeVisible();
});

test('閲覧モードではドラッグしてカメラを回転できる', async ({ page }) => {
  await gotoApp(page);

  await setAutoRotateEnabled(page, false);
  const before = await getCameraPosition(page);

  const box = await getCanvasBox(page);
  await dragAcrossCanvas(page, toCanvasPoint(box, 0.45, 0.5), toCanvasPoint(box, 0.62, 0.56), 12);
  await waitForCameraPositionChange(page, before);
  const after = await getCameraPosition(page);
  expect(after).not.toEqual(before);
});

test('閲覧モードで下方向にドラッグするとカメラは上方向へ回る', async ({ page }) => {
  await gotoApp(page);

  await setAutoRotateEnabled(page, false);
  const before = await getCameraPosition(page);

  const box = await getCanvasBox(page);
  await dragAcrossCanvas(page, toCanvasPoint(box, 0.5, 0.42), toCanvasPoint(box, 0.5, 0.62), 12);
  await waitForCameraPositionChange(page, before);
  const after = await getCameraPosition(page);
  expect(after[1]).toBeGreaterThan(before[1]);
});

test('閲覧モードではホイールでズームできる', async ({ page }) => {
  await gotoApp(page);

  await setAutoRotateEnabled(page, false);
  const before = await getCameraPosition(page);

  const box = await getCanvasBox(page);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 320);
  await waitForCameraPositionChange(page, before);
  const after = await getCameraPosition(page);
  expect(getVectorLength(after)).toBeGreaterThan(getVectorLength(before));
});

test('canvas 上のセルを選択すると selection detail が更新される', async ({ page }) => {
  await gotoApp(page);

  await setAutoRotateEnabled(page, false);
  await findSelectablePoint(page);

  await expect(page.locator('[data-stat="selected"]')).not.toHaveText('none');
  await expect(page.locator('[data-stat="terrain"]')).not.toHaveText('-');
});

test('ペイントモードで選択セルの terrain を直接切り替えられる', async ({ page }) => {
  await gotoApp(page);

  const target = await findSelectablePoint(page);

  await setPaintMode(page, true);
  await setBrushTerrainKind(page, 'water');
  await clickCanvasPoint(page, target);
  await expect(page.locator('[data-stat="terrain"]')).toHaveText('water');
  await setBrushTerrainKind(page, 'land');
  await clickCanvasPoint(page, target);
  await expect(page.locator('[data-stat="terrain"]')).toHaveText('land');
});

test('ペイントモードではドラッグして複数セルにまたがる操作ができる', async ({ page }) => {
  await gotoApp(page);

  const target = await findSelectablePoint(page);
  const box = await getCanvasBox(page);
  const end = toCanvasPoint(box, 0.72, target.relativeY / box.height);

  await setPaintMode(page, true);
  await setBrushTerrainKind(page, 'land');
  await dragAcrossCanvas(page, target, end, 16);

  await expect(page.locator('[data-stat="selected"]')).not.toHaveText('none');
  await expect(page.locator('[data-stat="terrain"]')).toHaveText('land');
});

test('ペイントモード中のドラッグではカメラが回転しない', async ({ page }) => {
  await gotoApp(page);

  const target = await findSelectablePoint(page);
  await setPaintMode(page, true);
  const before = await getCameraPosition(page);
  await dragAcrossCanvas(page, target, {
    ...target,
    absoluteX: target.absoluteX + 160,
    relativeX: target.relativeX + 160
  }, 20);

  const after = await getCameraPosition(page);
  expect(cameraPositionsEqual(after, before)).toBe(true);
});
