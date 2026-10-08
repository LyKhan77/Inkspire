import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { chooseTheme, ready, draw, saveScene, importScene, imageScene } from './browser-helpers';
async function save(page: import('@playwright/test').Page) { const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Simpan file', exact: true }).click(); const file = await pending; return JSON.parse(await readFile((await file.path())!, 'utf8')); }
test('file native, invalid import preserves scene, replace choices and restore', async ({ page }) => {
  await page.goto('/'); await expect(page.getByTestId('editor')).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Persegi', exact: true })).toBeVisible();
  await page.getByTestId('editor').click({ position: { x: 600, y: 450 } }); await page.keyboard.press('r');
  const box = (await page.getByTestId('editor').boundingBox())!;
  await page.mouse.move(box.x + 300, box.y + 180); await page.mouse.down(); await page.mouse.move(box.x + 470, box.y + 290); await page.mouse.up();
  await expect(page.getByRole('button', { name: 'Urungkan', exact: true })).toBeEnabled();
  const scene = await save(page); expect(scene.type).toBe('excalidraw'); expect(scene.elements).toHaveLength(1);
  await page.getByTestId('workspace-input').setInputFiles({ name: 'bad.excalidraw', mimeType: 'application/json', buffer: Buffer.from('{}') });
  await expect(page.getByRole('alert')).toContainText('tidak valid'); expect((await save(page)).elements).toEqual(scene.elements);
  await page.getByRole('button', { name: 'Workspace', exact: true }).click(); await page.getByRole('button', { name: 'Canvas baru', exact: true }).click();
  await page.getByRole('button', { name: 'Batal', exact: true }).click(); expect((await save(page)).elements).toEqual(scene.elements);
  await expect(page.getByText('Draft tersimpan di browser', { exact: true })).toBeVisible(); await page.reload(); await expect(page.getByRole('radio', { name: 'Persegi', exact: true })).toBeVisible(); expect((await save(page)).elements).toEqual(scene.elements.map((e: Record<string, unknown>) => ({ ...e, boundElements: e.boundElements ?? [] })));
});
test('native clear shortcut and workspace drop use Inkspire replacement guard', async ({ page }) => {
  await ready(page); await draw(page); const original = await saveScene(page);
  await page.getByTestId('editor').click({ position: { x: 700, y: 450 } }); await page.keyboard.press('Meta+Backspace');
  await expect(page.getByRole('dialog', { name: 'Ganti workspace?' })).toBeVisible(); await page.getByRole('button', { name: 'Batal', exact: true }).click(); expect((await saveScene(page)).elements).toEqual(original.elements);
  await page.getByTestId('editor').click({ position: { x: 700, y: 450 } }); await page.keyboard.press('Meta+/');
  await expect(page.getByRole('button', { name: 'Canvas baru', exact: true })).toBeVisible(); await page.getByRole('button', { name: 'Canvas baru', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Ganti workspace?' })).toBeVisible(); await page.getByRole('button', { name: 'Batal', exact: true }).click();
  const scene = await imageScene(); await page.evaluate(data => {
    const transfer = new DataTransfer(); transfer.items.add(new File([JSON.stringify(data)], 'drop.excalidraw', { type: 'application/json' }));
    document.querySelector('[data-testid="editor"]')!.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
  }, scene);
  await expect(page.getByRole('dialog', { name: 'Ganti workspace?' })).toBeVisible(); await page.getByRole('button', { name: 'Ganti canvas', exact: true }).click(); expect((await saveScene(page)).elements).toHaveLength(2);
});
test('replace offers save or cancel, import clears old undo and export embeds images', async ({ page }) => {
  await ready(page); await draw(page); const old = await saveScene(page);
  await page.getByRole('button', { name: 'Workspace', exact: true }).click(); await page.getByRole('button', { name: 'Canvas baru', exact: true }).click();
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Simpan file dahulu' }).click(); await pending;
  expect((await saveScene(page)).elements).toEqual(old.elements);
  await importScene(page, await imageScene());
  const images = await saveScene(page); expect(images.elements).toHaveLength(2); expect(Object.keys(images.files)).toHaveLength(2);
  await page.getByTestId('editor').click({ position: { x: 700, y: 400 } }); await page.keyboard.press('Meta+z');
  expect((await saveScene(page)).elements).toHaveLength(2);
  const colors = images.elements.map((e: Record<string, unknown>) => [e.strokeColor, e.backgroundColor]);
  await chooseTheme(page, 'dark'); expect((await saveScene(page)).elements.map((e: Record<string, unknown>) => [e.strokeColor, e.backgroundColor])).toEqual(colors);
  for (const format of ['PNG', 'SVG']) {
    await page.getByRole('button', { name: 'Export', exact: true }).click(); const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export ' + format, exact: true }).click();
    const bytes = await readFile((await (await download).path())!); expect(bytes.length).toBeGreaterThan(100);
    if (format === 'SVG') expect(bytes.toString()).toContain('data:image/png;base64,'); else expect(bytes.subarray(1, 4).toString()).toBe('PNG');
  }
  await expect(page.getByText('Draft tersimpan di browser', { exact: true })).toBeVisible(); await page.reload(); await expect(page.getByRole('radio', { name: 'Persegi', exact: true })).toBeVisible(); expect(Object.keys((await saveScene(page)).files)).toHaveLength(2);
});
