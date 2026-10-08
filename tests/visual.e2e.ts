import { expect, test } from '@playwright/test';
import { chooseTheme, ready, draw, mockMode, saveScene } from './browser-helpers';
import { readFile } from 'node:fs/promises';
for (const viewport of [{ width: 1280, height: 800 }, { width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`visual ${viewport.width}x${viewport.height}: local assets, theme, selection, drawer and mobile file access`, async ({ page, request }) => {
    await page.setViewportSize(viewport); const errors: string[] = []; const external: string[] = [];
    page.on('pageerror', error => errors.push(error.message)); page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.route('**/*', route => { const url = route.request().url(); if (url.startsWith('http:') && !url.startsWith('http://127.0.0.1:4183/')) { external.push(url); return route.abort(); } return route.continue(); });
    await mockMode(request, 'delayed', 1200); await ready(page); await page.evaluate(() => document.fonts.ready);
    await expect(page.getByRole('complementary', { name: 'AI image' })).toBeHidden();
    const selectedIcon = page.locator('.ToolIcon_type_radio:checked + .ToolIcon__icon svg').first();
    const colors = await selectedIcon.evaluate(icon => ({ foreground: getComputedStyle(icon).color, background: getComputedStyle(icon.parentElement!).backgroundColor }));
    expect(colors.foreground).not.toBe(colors.background);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `output/playwright/${viewport.width}-light-canvas.png` });
    await page.getByRole('button', { name: 'Workspace', exact: true }).click(); await expect(page.getByRole('button', { name: 'Buka / import file' })).toBeVisible(); await page.getByRole('button', { name: 'Canvas baru', exact: true }).click();
    const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible(); await page.keyboard.press('Tab'); expect(await dialog.evaluate(d => d.contains(document.activeElement))).toBe(true); await page.getByRole('button', { name: 'Batal', exact: true }).click();
    await chooseTheme(page, 'dark'); await page.getByRole('button', { name: 'AI image', exact: true }).click(); await page.getByLabel('Prompt', { exact: true }).fill('Tinta'); await page.getByRole('button', { name: 'Generate image' }).click(); await expect(page.getByText('Menunggu hasil MaPic…', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tutup panel AI' })).toBeInViewport();
    await page.screenshot({ path: `output/playwright/${viewport.width}-dark-pending.png` });
    await page.getByRole('button', { name: 'Tutup panel AI' }).click(); await expect(page.getByRole('button', { name: 'AI image', exact: true })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (viewport.width > 600) { await draw(page); await page.screenshot({ path: `output/playwright/${viewport.width}-dark-selection.png` }); }
    await page.getByRole('button', { name: 'AI image', exact: true }).click(); await expect(page.getByAltText('Hasil MaPic')).toBeVisible();
    expect(external).toEqual([]); expect(errors).toEqual([]);
  });
}
test('offline native text and selection export, system theme and reduced motion', async ({ page }) => {
  const external: string[] = []; const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('**/*', route => { const url = route.request().url(); if (/^https?:/.test(url) && !url.startsWith('http://127.0.0.1:4183/')) { external.push(url); return route.abort(); } return route.continue(); });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' }); await ready(page);
  await expect(page.locator('.inkspire')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' }); await expect(page.locator('.inkspire')).toHaveAttribute('data-theme', 'light');
  await chooseTheme(page, 'dark'); await page.emulateMedia({ colorScheme: 'light' }); await expect(page.locator('.inkspire')).toHaveAttribute('data-theme', 'dark');
  await chooseTheme(page, 'system'); await expect(page.locator('.inkspire')).toHaveAttribute('data-theme', 'light');
  expect(await page.getByRole('button', { name: 'AI image', exact: true }).evaluate(button => getComputedStyle(button).transitionDuration)).toBe('0s');
  await page.getByTestId('editor').click({ position: { x: 600, y: 450 } }); await page.keyboard.press('t');
  await page.getByTestId('editor').click({ position: { x: 300, y: 240 } });
  const text = page.locator('.excalidraw textarea'); await expect(text).toBeVisible(); await text.fill('Tinta lokal — font native'); await page.keyboard.press('Escape');
  await page.evaluate(() => document.fonts.ready);
  expect((await saveScene(page)).elements.some((e: { type: string; text?: string }) => e.type === 'text' && e.text === 'Tinta lokal — font native')).toBe(true);
  await page.getByTestId('editor').click({ position: { x: 700, y: 450 } }); await page.keyboard.press('Meta+a');
  for (const format of ['PNG', 'SVG']) {
    await page.getByRole('button', { name: 'Export', exact: true }).click(); await page.getByLabel('Seleksi saja').check();
    const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export ' + format, exact: true }).click();
    const bytes = await readFile((await (await pending).path())!); expect(bytes.length).toBeGreaterThan(100);
    if (format === 'SVG') { expect(bytes.toString()).toContain('Tinta lokal'); expect(bytes.toString()).toContain('data:font/woff2;base64,'); }
  }
  expect(external).toEqual([]); expect(errors).toEqual([]);
});
