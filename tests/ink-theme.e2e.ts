import { expect, test } from '@playwright/test';
import { draw, ready, saveScene, mockMode, mockCalls, imageScene, importScene } from './browser-helpers';

test('Ink bloom switches both themes while preserving assets, undo and pending AI; persists manual preference', async ({ page, request }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await mockMode(request, 'held'); await ready(page);
  await importScene(page, await imageScene()); await draw(page);
  const before = await saveScene(page);
  const toggle = page.getByRole('button', { name: 'Aktifkan dark mode', exact: true });
  await expect(toggle).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: 'AI image', exact: true }).click();
  await page.getByLabel('Prompt', { exact: true }).fill('Tinta tetap berjalan');
  await page.getByRole('button', { name: 'Generate image' }).click();
  await expect(page.getByText('Menunggu hasil MaPic…', { exact: true })).toBeVisible();
  await toggle.click({ clickCount: 3 });
  await expect(page.locator('.inkspire')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).not.toHaveAttribute('data-ink-transition');
  await expect(page.getByRole('button', { name: 'Aktifkan light mode' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Urungkan', exact: true })).toBeEnabled();
  await expect(page.getByLabel('Prompt', { exact: true })).toHaveValue('Tinta tetap berjalan');
  await expect(page.getByText('Menunggu hasil MaPic…', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Tutup panel AI' }).click();
  await page.getByRole('button', { name: 'Aktifkan light mode' }).click();
  await expect(page.locator('.inkspire')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('html')).not.toHaveAttribute('data-ink-transition');
  const after = await saveScene(page); expect(after.elements).toEqual(before.elements); expect(after.files).toEqual(before.files);
  expect((await mockCalls(request)).length).toBe(1);
  await request.post('http://127.0.0.1:4184/__test/release');
  await page.getByRole('button', { name: 'AI image', exact: true }).click();
  await expect(page.getByAltText('Hasil MaPic')).toBeVisible();
  await page.getByRole('button', { name: 'Tutup panel AI' }).click();
  await page.getByRole('button', { name: 'Aktifkan dark mode' }).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-ink-transition');
  await page.reload();
  await expect(page.locator('.inkspire')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' }); await expect(page.locator('.inkspire')).toHaveAttribute('data-theme', 'dark');
  await page.getByLabel('Ikuti sistem', { exact: true }).check();
  await expect(page.locator('.inkspire')).toHaveAttribute('data-theme', 'light');
  await page.emulateMedia({ colorScheme: 'dark' }); await expect(page.locator('.inkspire')).toHaveAttribute('data-theme', 'dark');
});

test('Ink keyboard toggle supports English and reduced motion on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' }); await ready(page);
  await page.getByLabel('Bahasa', { exact: true }).selectOption('en');
  const toggle = page.getByRole('button', { name: 'Switch to dark mode' });
  await expect(toggle).toBeVisible({ timeout: 5000 });
  await toggle.focus(); await page.keyboard.press('Space');
  await expect(page.locator('.inkspire')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: 'Switch to light mode' })).toBeFocused();
  await expect(page.locator('html')).not.toHaveAttribute('data-ink-transition');
  expect(await page.evaluate(() => document.getAnimations().filter(a => (a.effect as KeyframeEffect | null)?.pseudoElement?.startsWith('::view-transition-')).length)).toBe(0);
  expect(await page.locator('.ink-toggle').evaluate(button => button.getAnimations({ subtree: true }).length)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'output/playwright/ink-header-mobile.png' });
  await page.keyboard.press('Enter'); await expect(page.locator('.inkspire')).toHaveAttribute('data-theme', 'light');
});

test('Ink toggle falls back when View Transition API is unavailable', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(document, 'startViewTransition', { value: undefined, configurable: true }); });
  await ready(page);
  await page.getByRole('button', { name: 'Aktifkan dark mode' }).click({ timeout: 5000 });
  await expect(page.locator('.inkspire')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).not.toHaveAttribute('data-ink-transition');
  await page.getByRole('button', { name: 'Aktifkan light mode' }).click();
  await expect(page.locator('.inkspire')).toHaveAttribute('data-theme', 'light');
});

test('Ink bloom renders an organic reveal from the header on desktop and mobile', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' }); await ready(page);
  await draw(page);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
    const start = await page.locator('.inkspire').getAttribute('data-theme');
    await page.locator('.ink-toggle').click();
    await page.waitForFunction(() => document.getAnimations().some(a => (a.effect as KeyframeEffect | null)?.pseudoElement === '::view-transition-new(root)'));
    const clip = await page.evaluate(() => {
      for (const a of document.getAnimations()) { a.pause(); a.currentTime = 100; }
      return getComputedStyle(document.documentElement, '::view-transition-new(root)').clipPath;
    });
    expect(clip).toMatch(/^polygon\(/);
    await page.screenshot({ path: `output/playwright/ink-header-${width}-bloom.png` });
    await page.evaluate(() => { for (const a of document.getAnimations()) a.play(); });
    await expect(page.locator('html')).not.toHaveAttribute('data-ink-transition');
    await expect(page.locator('.inkspire')).toHaveAttribute('data-theme', start === 'light' ? 'dark' : 'light');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  expect(errors).toEqual([]);
});

test('skipped or interrupted bloom releases its guard and honors the system preference', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ colorScheme: 'light' }); await ready(page);
  await page.evaluate(() => {
    const start = document.startViewTransition.bind(document);
    document.startViewTransition = ((update: () => void) => { const view = start(update); view.skipTransition(); return view; }) as typeof document.startViewTransition;
  });
  await page.getByRole('button', { name: 'Aktifkan dark mode' }).click();
  await expect(page.locator('.inkspire')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).not.toHaveAttribute('data-ink-transition');
  await page.reload(); await expect(page.getByRole('button', { name: 'Aktifkan light mode' })).toBeVisible();
  await page.getByRole('button', { name: 'Aktifkan light mode' }).click();
  await page.waitForFunction(() => document.getAnimations().some(a => (a.effect as KeyframeEffect | null)?.pseudoElement === '::view-transition-new(root)'));
  await page.getByLabel('Ikuti sistem', { exact: true }).evaluate(input => (input as HTMLInputElement).click());
  await expect(page.locator('html')).not.toHaveAttribute('data-ink-transition');
  await expect(page.getByLabel('Ikuti sistem', { exact: true })).toBeChecked();
  await page.emulateMedia({ colorScheme: 'dark' }); await expect(page.locator('.inkspire')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Aktifkan light mode' }).click();
  await expect(page.locator('.inkspire')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('html')).not.toHaveAttribute('data-ink-transition');
  expect(errors).toEqual([]);
});
