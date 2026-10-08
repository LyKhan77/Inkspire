import { expect, test } from '@playwright/test';
import { ready, draw, saveScene, importScene, imageScene, mockMode, mockCalls } from './browser-helpers';
test('quota failure preserves previous draft and file save remains available', async ({ page }) => {
  await ready(page); await importScene(page, await imageScene()); await expect(page.getByText('Draft tersimpan di browser', { exact: true })).toBeVisible(); const original = await saveScene(page);
  await page.addInitScript(() => { const put = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function (...args: Parameters<typeof put>) { if (localStorage.getItem('test-write-failure')) throw new DOMException('Test quota', 'QuotaExceededError'); return put.apply(this, args); }; });
  await page.evaluate(() => localStorage.setItem('test-write-failure', '1')); await page.reload(); await expect(page.getByRole('radio', { name: 'Persegi', exact: true })).toBeVisible(); await draw(page);
  await expect(page.getByText('Draft belum tersimpan', { exact: true })).toBeVisible(); expect((await saveScene(page)).elements.length).toBeGreaterThan(original.elements.length);
  await page.evaluate(() => localStorage.removeItem('test-write-failure')); await page.reload(); await expect(page.getByRole('radio', { name: 'Persegi', exact: true })).toBeVisible(); const restored = await saveScene(page); expect(restored.elements).toHaveLength(2); expect(restored.files.file0.dataURL).toBe(original.files.file0.dataURL);
});
test('explicit recovery allows saving a new draft after read failure', async ({ page }) => {
  await ready(page); await draw(page); await expect(page.getByText('Draft tersimpan di browser', { exact: true })).toBeVisible();
  await page.addInitScript(() => { const get = IDBObjectStore.prototype.get; IDBObjectStore.prototype.get = function (...args: Parameters<typeof get>) { if (localStorage.getItem('test-read-failure')) throw new Error('read failed'); return get.apply(this, args); }; });
  await page.evaluate(() => localStorage.setItem('test-read-failure', '1')); await page.reload(); await expect(page.getByText('Draft gagal dipulihkan', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Canvas baru', exact: true }).click(); await page.getByRole('button', { name: 'Ganti canvas', exact: true }).click(); await expect(page.getByRole('radio', { name: 'Persegi', exact: true })).toBeVisible();
  await expect(page.getByText('Draft tersimpan di browser', { exact: true })).toBeVisible(); await page.evaluate(() => localStorage.removeItem('test-read-failure')); await page.reload(); await expect(page.getByRole('radio', { name: 'Persegi', exact: true })).toBeVisible(); expect((await saveScene(page)).elements).toHaveLength(0);
});
test('read failure blocks blank autosave and offers explicit recovery', async ({ page }) => {
  await ready(page); await draw(page); await expect(page.getByText('Draft tersimpan di browser', { exact: true })).toBeVisible();
  await page.addInitScript(() => { const get = IDBObjectStore.prototype.get; IDBObjectStore.prototype.get = function (...args: Parameters<typeof get>) { if (localStorage.getItem('test-read-failure')) throw new DOMException('Read failed'); return get.apply(this, args); }; });
  await page.evaluate(() => localStorage.setItem('test-read-failure', '1')); await page.reload(); await expect(page.getByText('Draft gagal dipulihkan', { exact: true })).toBeVisible(); await expect(page.getByTestId('editor')).toBeHidden();
  await page.getByRole('button', { name: 'Canvas baru', exact: true }).click(); await page.getByRole('button', { name: 'Batal', exact: true }).click(); await expect(page.getByTestId('editor')).toBeHidden();
  await page.evaluate(() => localStorage.removeItem('test-read-failure')); await page.reload(); await expect(page.getByRole('radio', { name: 'Persegi', exact: true })).toBeVisible(); expect((await saveScene(page)).elements).toHaveLength(1);
});
test('pending AI permits edit/save/export, invalid import retains workspace and reload never resubmits', async ({ page, request }) => {
  await mockMode(request, 'held'); await ready(page); await draw(page); await page.getByRole('button', { name: 'AI image', exact: true }).click(); await page.getByLabel('Prompt', { exact: true }).fill('Tinta'); await page.getByRole('button', { name: 'Generate image' }).click();
  await page.getByRole('button', { name: 'Tutup panel AI' }).click(); await draw(page, 500, 350); const scene = await saveScene(page); expect(scene.elements).toHaveLength(2);
  await page.getByRole('button', { name: 'Export', exact: true }).click(); const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export PNG', exact: true }).click(); await download;
  await page.getByTestId('workspace-input').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{}') }); await expect(page.getByRole('alert')).toContainText('tidak valid'); expect((await saveScene(page)).elements).toEqual(scene.elements);
  await expect.poll(async () => (await mockCalls(request)).length).toBe(1); await expect(page.getByText('Draft tersimpan di browser', { exact: true })).toBeVisible(); await page.reload(); await expect(page.getByRole('radio', { name: 'Persegi', exact: true })).toBeVisible(); expect((await saveScene(page)).elements).toHaveLength(2); expect(await mockCalls(request)).toHaveLength(1);
  await page.getByRole('button', { name: 'AI image', exact: true }).click(); await expect(page.getByAltText('Hasil MaPic')).toBeHidden();
  await request.post('http://127.0.0.1:4184/__test/release');
});
test('another tab receives local 409 while first request remains active', async ({ page, context, request }) => {
  await mockMode(request, 'held'); await ready(page); await page.getByRole('button', { name: 'AI image', exact: true }).click(); await page.getByLabel('Prompt', { exact: true }).fill('Pertama'); await page.getByRole('button', { name: 'Generate image' }).click();
  await expect.poll(async () => (await mockCalls(request)).length).toBe(1);
  const second = await context.newPage(); await ready(second); await second.getByRole('button', { name: 'AI image', exact: true }).click(); await second.getByLabel('Prompt', { exact: true }).fill('Kedua'); await second.getByRole('button', { name: 'Generate image' }).click();
  await expect(second.getByRole('alert')).toContainText('Satu request masih aktif'); expect(await mockCalls(request)).toHaveLength(1);
  await request.post('http://127.0.0.1:4184/__test/release'); await expect(page.getByAltText('Hasil MaPic')).toBeVisible(); await second.close();
});
