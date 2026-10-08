import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { importScene, ready, saveScene } from './browser-helpers';
import { emptyScene } from './fixtures';

const production = process.env.INKSPIRE_TEST_MODE === 'production';
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Flowchart', exact: true });
const mermaidBox = (page: Page) => dialog(page).getByRole('textbox', { name: 'Mermaid', exact: true });

/** Active content, links and non-flowchart grammar must never reach a renderer. */
const hostile = [
  ['click callback', 'flowchart TD\nA([Start]) --> B[Work]\nclick B "https://example.com"'],
  ['raw html image', 'flowchart TD\nA["<img src=https://example.com/x onerror=alert(1)>"]'],
  ['encoded script', 'flowchart TD\nA["#60;script#62;alert(1)#60;/script#62;"]'],
  ['init directive security override', 'flowchart TD\n%%{init: {"securityLevel":"loose"}}%%\nA([Start])'],
  ['frontmatter', '---\nconfig:\n  securityLevel: loose\n---\nflowchart TD\nA([Start])'],
  ['link statement', 'flowchart TD\nA([Start]) --> B\nlinkStyle 0 stroke:red'],
  ['class style', 'flowchart TD\nA([Start]) --> B[Work]:::danger'],
  ['subgraph', 'flowchart TD\nsubgraph inner\nA([Start]) --> B[Work]\nend'],
  ['image shape', 'flowchart TD\nA@{ shape: image, img: "https://example.com/x.png" }'],
  ['other diagram type', 'gantt\n  title Unsupported\n  section a\n  task :0, 1d'],
  ['sequence diagram', 'sequenceDiagram\n  A->>B: hello'],
  ['statement separator', 'flowchart TD\nA([Start]); B[Work]'],
];

function watchNetwork(page: Page) {
  const outside: string[] = [];
  const downstream: string[] = [];
  const sourceMaps: string[] = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol) && !['127.0.0.1', 'localhost'].includes(url.hostname)) outside.push(`${url.origin}${url.pathname}`);
    if (url.pathname.startsWith('/api/')) downstream.push(url.pathname);
    if (url.pathname.startsWith('/src/')) sourceMaps.push(url.pathname);
  });
  return { outside, downstream, sourceMaps };
}

function watchNativeDialog(page: Page) {
  return page.addInitScript(() => {
    const watch = { mounts: 0 };
    Object.defineProperty(window, 'inkspireNativeTtd', { value: watch });
    const start = () => new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) {
        if (node instanceof HTMLElement && (node.classList.contains('ttd-dialog') || !!node.querySelector?.('.ttd-dialog'))) watch.mounts++;
      }
    }).observe(document.body, { childList: true, subtree: true });
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  });
}

const nativeMounts = (page: Page) => page.evaluate(() => (window as unknown as { inkspireNativeTtd: { mounts: number } }).inkspireNativeTtd.mounts);

/**
 * Defers the final canvas export so a converter result can be left pending and released on demand. Unlike delaying the
 * converter module import, this also works in production, where the bundler inlines that module.
 */
function holdCanvasExports(page: Page) {
  return page.addInitScript(() => {
    const hold = { armed: false, deferred: [] as (() => void)[] };
    const toBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (this: HTMLCanvasElement, callback: BlobCallback, type?: string, quality?: number) {
      const canvas = this;
      const invoke = () => toBlob.call(canvas, callback, type, quality);
      if (hold.armed) hold.deferred.push(invoke); else invoke();
    };
    Object.defineProperty(window, 'inkspireCanvasHold', { value: hold });
  });
}

const heldExports = (page: Page) => page.evaluate(() => (window as unknown as { inkspireCanvasHold: { deferred: (() => void)[] } }).inkspireCanvasHold.deferred.length);

const controlCanvasExports = (page: Page, armed: boolean) => page.evaluate(arm => {
  const hold = (window as unknown as { inkspireCanvasHold: { armed: boolean; deferred: (() => void)[] } }).inkspireCanvasHold;
  hold.armed = arm;
  if (!arm) for (const invoke of hold.deferred.splice(0)) invoke();
}, armed);

test('a converter result released after closing and workspace replacement is never published', async ({ page }) => {
  await holdCanvasExports(page);
  await ready(page);
  await page.locator('.App-toolbar__extra-tools-trigger').click();
  await page.locator('[data-inkspire-flowchart-trigger]').click();
  await dialog(page).getByRole('button', { name: 'Muat contoh', exact: true }).click();
  await controlCanvasExports(page, true);
  await dialog(page).getByRole('button', { name: 'Buat preview', exact: true }).click();
  await expect(dialog(page).getByRole('status')).toContainText('Menyiapkan flowchart');
  await expect.poll(() => heldExports(page), { timeout: 25_000, message: 'the canvas export must really be pending' }).toBeGreaterThan(0);

  await page.keyboard.press('Escape');
  await importScene(page, emptyScene, 'Pengganti.excalidraw');
  await page.locator('.App-toolbar__extra-tools-trigger').click();
  await page.locator('[data-inkspire-flowchart-trigger]').click();
  await controlCanvasExports(page, false);

  await expect(dialog(page).getByAltText('Preview flowchart', { exact: true })).toHaveCount(0);
  await expect(dialog(page).getByRole('button', { name: 'Tambahkan ke canvas', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  expect((await saveScene(page) as { elements: unknown[] }).elements).toHaveLength(0);
});

test('both native entries route to the same bounded local validator with no external traffic', async ({ page }) => {
  const traffic = watchNetwork(page);
  await watchNativeDialog(page);
  let alerts = 0;
  page.on('dialog', browserDialog => { alerts++; void browserDialog.dismiss(); });
  await ready(page);
  await page.locator('.App-toolbar__extra-tools-trigger').click();
  await page.locator('[data-inkspire-flowchart-trigger]').click();
  await expect(dialog(page)).toBeVisible();
  await dialog(page).getByRole('tab', { name: 'Mermaid', exact: true }).click();
  for (const [name, source] of hostile) {
    await mermaidBox(page).fill(source);
    await dialog(page).getByRole('button', { name: 'Buat preview', exact: true }).click();
    await expect(dialog(page).getByRole('alert'), name).toBeVisible();
    await expect(dialog(page).getByRole('button', { name: 'Tambahkan ke canvas', exact: true }), name).toBeDisabled();
    await expect(dialog(page).getByAltText('Preview flowchart', { exact: true }), name).toHaveCount(0);
  }
  await mermaidBox(page).fill('flowchart TD\nA([Start]) --> B[Process]\nB --> C([End])');
  await dialog(page).getByRole('button', { name: 'Buat preview', exact: true }).click();
  await expect(dialog(page).getByAltText('Preview flowchart', { exact: true })).toBeVisible({ timeout: 25_000 });
  await page.keyboard.press('Escape');

  await page.locator('.App-toolbar__extra-tools-trigger').click();
  await page.locator('.App-toolbar__extra-tools-dropdown .dropdown-menu-item').filter({ hasText: /Mermaid/i }).click();
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).getByRole('tab', { name: 'Mermaid', exact: true })).toHaveAttribute('aria-selected', 'true');
  await dialog(page).getByRole('button', { name: 'Buat preview', exact: true }).click();
  await expect(dialog(page).getByAltText('Preview flowchart', { exact: true })).toBeVisible({ timeout: 25_000 });
  await page.keyboard.press('Escape');

  expect(traffic.outside).toEqual([]);
  expect(traffic.downstream).toEqual([]);
  if (production) expect(traffic.sourceMaps).toEqual([]);
  expect(alerts).toBe(0);
  expect(await nativeMounts(page)).toBe(0);
  expect((await saveScene(page) as { elements: unknown[] }).elements).toHaveLength(0);
});

test('native validator cannot be bypassed by adversarial labels that survive parsing', async ({ page }) => {
  await watchNativeDialog(page);
  await ready(page);
  await page.locator('.App-toolbar__extra-tools-trigger').click();
  await page.locator('[data-inkspire-flowchart-trigger]').click();
  await dialog(page).getByRole('tab', { name: 'Mermaid', exact: true }).click();
  // These labels decode into markup only after entity expansion, which the boundary must reject before rendering.
  const payloads = [
    'flowchart TD\nA["#60;img src#61;x#62;"]',
    'flowchart TD\nA["#60;iframe src#61;https#58;//example.com#62;"]',
    'flowchart TD\nA["javascript#58;alert(1)"]',
    'flowchart TD\nA["on#35;error#61;alert(1)"]',
  ];
  for (const payload of payloads) {
    await mermaidBox(page).fill(payload);
    await dialog(page).getByRole('button', { name: 'Buat preview', exact: true }).click();
    const alert = dialog(page).getByRole('alert');
    if (await alert.count()) await expect(alert).toBeVisible();
    else await expect(dialog(page).getByAltText('Preview flowchart', { exact: true })).toBeVisible({ timeout: 25_000 });
  }
  expect(await nativeMounts(page)).toBe(0);
  await page.keyboard.press('Escape');
  expect((await saveScene(page) as { elements: unknown[] }).elements).toHaveLength(0);
});

test('a converter module import still pending after closing and workspace replacement is never published', async ({ page }) => {
  test.skip(production, 'shaping converter module latency needs the dev code-splitting, which the production bundle inlines');
  await page.route('**/*mermaid*', async route => { await new Promise(resolve => setTimeout(resolve, 2500)); await route.continue(); });
  await ready(page);
  await page.locator('.App-toolbar__extra-tools-trigger').click();
  await page.locator('[data-inkspire-flowchart-trigger]').click();
  await dialog(page).getByRole('button', { name: 'Muat contoh', exact: true }).click();
  await dialog(page).getByRole('button', { name: 'Buat preview', exact: true }).click();
  await expect(dialog(page).getByRole('status')).toContainText('Menyiapkan flowchart');
  await page.keyboard.press('Escape');
  await importScene(page, emptyScene, 'Pengganti.excalidraw');
  await page.waitForTimeout(4000);
  await page.locator('.App-toolbar__extra-tools-trigger').click();
  await page.locator('[data-inkspire-flowchart-trigger]').click();
  await expect(dialog(page).getByAltText('Preview flowchart', { exact: true })).toHaveCount(0);
  await expect(dialog(page).getByRole('button', { name: 'Tambahkan ke canvas', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  expect((await saveScene(page) as { elements: unknown[] }).elements).toHaveLength(0);
});
