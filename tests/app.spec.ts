import { expect, test, type Page } from '@playwright/test';

const APP_READY_TIMEOUT_MS = 8_000;
const AFTER_EACH_TIMEOUT_MS = 750;
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
  pageClosed: boolean;
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

async function getLocatorAttribute(locator: ReturnType<Page['locator']>, name: string) {
  try {
    return await locator.getAttribute(name, { timeout: AFTER_EACH_TIMEOUT_MS });
  } catch {
    return null;
  }
}

async function getLocatorText(locator: ReturnType<Page['locator']>) {
  try {
    return await locator.textContent({ timeout: AFTER_EACH_TIMEOUT_MS });
  } catch {
    return null;
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms.`)), timeoutMs);
      })
    ]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

async function collectAppDiagnostics(page: Page): Promise<AppDiagnostics> {
  if (page.isClosed()) {
    return {
      bootstrapStage: null,
      camera: { x: null, y: null, z: null },
      initError: null,
      pageClosed: true,
      ready: null,
      selected: null,
      terrain: null,
      toolMode: null,
      viewportHint: null
    };
  }

  const html = page.locator('html');
  return {
    bootstrapStage: await getLocatorAttribute(html, 'data-goldberg-bootstrap-stage'),
    camera: {
      x: await getLocatorAttribute(html, 'data-goldberg-camera-x'),
      y: await getLocatorAttribute(html, 'data-goldberg-camera-y'),
      z: await getLocatorAttribute(html, 'data-goldberg-camera-z')
    },
    initError: await getLocatorAttribute(html, 'data-goldberg-app-init-error'),
    pageClosed: false,
    ready: await getLocatorAttribute(html, 'data-goldberg-app-ready'),
    selected: await getLocatorText(page.locator('[data-stat="selected"]')),
    terrain: await getLocatorText(page.locator('[data-stat="terrain"]')),
    toolMode: await getLocatorText(page.locator('[data-stat="tool-mode"]')),
    viewportHint: await getLocatorText(page.locator('[data-stat="viewport-hint"]'))
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
    const diagnostics = await withTimeout(
      collectAppDiagnostics(page),
      AFTER_EACH_TIMEOUT_MS,
      'app diagnostics collection'
    );
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
    if (page.isClosed()) {
      await testInfo.attach('failure-screenshot-error', {
        body: 'Skipped screenshot because the page was already closed.',
        contentType: 'text/plain'
      });
      return;
    }

    try {
      await testInfo.attach('failure-screenshot', {
        body: await withTimeout(
          page.screenshot({ fullPage: true }),
          AFTER_EACH_TIMEOUT_MS,
          'failure screenshot capture'
        ),
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

async function setAutoRotateEnabled(page: Page, enabled: boolean) {
  const rotateButton = page.locator('[data-action="rotate"]');
  await expect(rotateButton).toHaveText(enabled ? 'Stop Rotation' : 'Auto Rotate');
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
