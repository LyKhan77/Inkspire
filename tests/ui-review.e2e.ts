import { expect, test } from '@playwright/test';
import { chooseTheme, draw, ready, saveScene, mockMode, mockCalls, imageScene, importScene } from './browser-helpers';

test('language changes native editor and shell without resetting scene, undo or AI form; persists on reload', async ({ page }) => {
  await ready(page); await importScene(page, await imageScene()); await draw(page);
  await page.getByLabel('Nama workspace').fill('Catatan saya');
  const before = await saveScene(page);
  await page.getByRole('button', { name: 'AI image', exact: true }).click();
  await page.getByLabel('Prompt', { exact: true }).fill('Tinta saya — keep this text');
  await page.getByLabel('Bahasa', { exact: true }).selectOption('en', { timeout: 5000 });
  await expect(page.getByRole('radio', { name: 'Rectangle', exact: true })).toBeVisible();
  await expect(page.getByLabel('Workspace name')).toHaveValue('Catatan saya');
  await expect(page.getByLabel('Prompt', { exact: true })).toHaveValue('Tinta saya — keep this text');
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeEnabled();
  await expect(page.getByText('Draft saved in browser', { exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByLabel('Language', { exact: true })).toBeInViewport();
  await page.screenshot({ path: 'output/playwright/review-english-mobile.png' });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole('button', { name: 'Close AI panel' }).click();
  await page.getByLabel('Language', { exact: true }).selectOption('id');
  const afterSwitch = await saveScene(page);
  expect(afterSwitch.elements).toEqual(before.elements); expect(afterSwitch.files).toEqual(before.files);
  await page.getByLabel('Bahasa', { exact: true }).selectOption('en');
  await page.reload();
  await expect(page.getByLabel('Language', { exact: true })).toHaveValue('en');
  await expect(page.getByLabel('Workspace name')).toHaveValue('Catatan saya');
  await page.getByLabel('Language', { exact: true }).selectOption('id');
  const afterReload = await saveScene(page);
  // Native restore canonicalizes empty bindings from null to [].
  const normalize = (elements: { boundElements: unknown }[]) => elements.map(e => ({ ...e, boundElements: e.boundElements ?? [] }));
  expect(normalize(afterReload.elements)).toEqual(normalize(before.elements)); expect(afterReload.files).toEqual(before.files);
});

test('ink theme preview supports three animations, rapid clicks, keyboard and reduced motion', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/previews/ink-theme.html');
  const studio = page.locator('#studio'); const toggle = page.locator('#ink-toggle');
  for (const mode of ['bloom', 'wipe', 'quiet']) {
    await page.locator(`[name="motion"][value="${mode}"]`).check();
    await toggle.click();
    await expect(studio).toHaveAttribute('data-theme', 'dark');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.transition-layer')).toHaveCount(0);
    await toggle.click({ clickCount: 3 });
    await expect(studio).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('.transition-layer')).toHaveCount(0);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await toggle.focus(); await page.keyboard.press('Space');
  await expect(studio).toHaveAttribute('data-theme', 'dark');
  await expect(toggle).toBeFocused(); await expect(page.locator('.transition-layer')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'output/playwright/ink-theme-preview-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('language translates current AI error without changing prompt or retrying request', async ({ page, request }) => {
  await mockMode(request, 'status', 0, 401); await ready(page);
  const before = (await mockCalls(request)).length;
  await page.getByRole('button', { name: 'AI image', exact: true }).click();
  await page.getByLabel('Prompt', { exact: true }).fill('Ilustrasi tinta');
  await page.getByRole('button', { name: 'Generate image' }).click();
  await expect(page.getByText('Konfigurasi autentikasi layanan perlu diperiksa di backend.')).toBeVisible();
  await page.getByLabel('Bahasa', { exact: true }).selectOption('en', { timeout: 5000 });
  await expect(page.getByText('Check the service authentication configuration in the backend.')).toBeVisible();
  await expect(page.getByLabel('Prompt', { exact: true })).toHaveValue('Ilustrasi tinta');
  expect((await mockCalls(request)).length).toBe(before + 1);
});

test('selected text and stroke properties have a persistent outline in both themes', async ({ page }) => {
  await ready(page);
  for (const theme of ['light', 'dark']) {
    await chooseTheme(page, theme as 'light' | 'dark');
    await page.getByRole('radio', { name: 'Teks', exact: true }).locator('..').click();
    await page.getByTestId('fontSize-small').locator('..').click();
    await page.getByTestId('align-horizontal-center').locator('..').click();
    await page.getByTestId('font-family-normal').click();
    await page.getByTestId('color-top-pick-#e03131').first().click();
    await page.getByTestId('color-top-pick-#e03131').first().hover();
    await expect(page.getByTestId('color-top-pick-#e03131').first()).toHaveCSS('background-color', 'rgb(224, 49, 49)');
    await page.getByLabel('Nama workspace').focus();
    for (const selector of ['[data-testid="fontSize-small"]', '[data-testid="align-horizontal-center"]']) {
      const selected = page.locator(selector).locator('..');
      await expect(selected).toHaveClass('active');
      const style = await selected.evaluate(e => ({ outline: getComputedStyle(e).outlineStyle, width: parseFloat(getComputedStyle(e).outlineWidth) }));
      expect(style.outline).toBe('solid'); expect(style.width).toBeGreaterThanOrEqual(2);
    }
    await expect(page.getByTestId('font-family-normal')).toHaveCSS('outline-style', 'solid');
    await expect(page.getByTestId('fontSize-medium').locator('..')).not.toHaveCSS('outline-style', 'solid');
    await expect(page.locator('.color-picker__button.active .color-picker__button-outline').first()).toHaveCSS('outline-style', 'solid');
    await page.screenshot({ path: `output/playwright/review-text-${theme}.png` });
    await page.getByRole('radio', { name: 'Persegi', exact: true }).locator('..').click();
    const options = page.locator('.buttonList label.active');
    expect(await options.count()).toBeGreaterThan(0);
    for (const option of await options.all()) await expect(option).toHaveCSS('outline-style', 'solid');
    await page.screenshot({ path: `output/playwright/review-stroke-${theme}.png` });
  }
});
