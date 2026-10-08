import { expect, test } from '@playwright/test';
import { ready, saveScene, importScene, mockMode } from './browser-helpers';
import { emptyScene } from './fixtures';
async function generate(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'AI image', exact: true }).click(); await page.getByLabel('Prompt', { exact: true }).fill('Tinta'); await page.getByRole('button', { name: 'Generate image' }).click(); await expect(page.getByAltText('Hasil MaPic')).toBeVisible();
}
test('preview inserts native PNG with ratio, undo/redo and file/draft round trip', async ({ page, request }) => {
  await mockMode(request); await ready(page); await generate(page); expect((await saveScene(page)).elements).toHaveLength(0);
  await page.getByRole('button', { name: 'Tambahkan ke canvas' }).click(); const scene = await saveScene(page); expect(scene.elements).toHaveLength(1);
  const image = scene.elements[0]; expect(image.type).toBe('image'); expect(image.width / image.height).toBe(2); expect(scene.files[image.fileId].dataURL).toContain('data:image/png;base64,');
  await page.getByRole('button', { name: 'Tutup panel AI' }).click(); await page.getByTestId('editor').click({ position: { x: 700, y: 450 } }); await page.keyboard.press('Meta+z'); expect((await saveScene(page)).elements).toHaveLength(0);
  await page.getByTestId('editor').click({ position: { x: 700, y: 450 } }); await page.keyboard.press('Meta+Shift+z'); expect((await saveScene(page)).elements).toHaveLength(1);
  await importScene(page, scene); const restored = await saveScene(page); expect(restored.files[image.fileId].dataURL).toBe(scene.files[image.fileId].dataURL);
  await expect(page.getByText('Draft tersimpan di browser', { exact: true })).toBeVisible(); await page.reload(); await expect(page.getByRole('radio', { name: 'Persegi', exact: true })).toBeVisible(); expect((await saveScene(page)).files[image.fileId].dataURL).toBe(scene.files[image.fileId].dataURL);
});
test('workspace changing during PNG hash prevents mutation into new target', async ({ page, request }) => {
  await mockMode(request); await ready(page); await generate(page);
  await page.evaluate(() => {
    const original = crypto.subtle.digest.bind(crypto.subtle);
    crypto.subtle.digest = async (...args: Parameters<typeof original>) => { await new Promise(resolve => setTimeout(resolve, 700)); return original(...args); };
  });
  await page.getByRole('button', { name: 'Tambahkan ke canvas' }).click(); await importScene(page, emptyScene, 'Baru.excalidraw');
  await expect(page.getByRole('alert')).toContainText('Workspace berubah saat gambar disiapkan'); expect((await saveScene(page)).elements).toHaveLength(0);
});
test('switch workspace while pending leaves preview and requires target confirmation', async ({ page, request }) => {
  await mockMode(request, 'delayed', 600); await ready(page); await page.getByRole('button', { name: 'AI image', exact: true }).click(); await page.getByLabel('Prompt', { exact: true }).fill('Tinta'); await page.getByRole('button', { name: 'Generate image' }).click();
  await importScene(page, emptyScene, 'Tujuan.excalidraw'); await expect(page.getByAltText('Hasil MaPic')).toBeVisible(); expect((await saveScene(page)).elements).toHaveLength(0);
  await page.getByRole('button', { name: 'Tambahkan ke canvas' }).click(); await expect(page.getByRole('dialog', { name: 'Tambahkan ke workspace aktif?' })).toContainText('Tujuan'); await page.getByRole('button', { name: 'Batal', exact: true }).click(); expect((await saveScene(page)).elements).toHaveLength(0);
});
