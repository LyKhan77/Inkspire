import { expect, test } from '@playwright/test';
import { ready, draw, saveScene, mockMode, mockCalls } from './browser-helpers';
import { TEST_TOKEN } from './mock-mapic';
test('single request survives panel close, prompt persists and preview does not mutate scene', async ({ page, request }) => {
  await mockMode(request, 'delayed', 1800); await ready(page); await draw(page); const before = await saveScene(page);
  await page.getByRole('button', { name: 'AI image', exact: true }).click(); await page.getByLabel('Prompt', { exact: true }).fill('Tinta hitam');
  const button = page.getByRole('button', { name: 'Generate image' }); await button.dblclick(); await expect(button).toBeDisabled();
  await expect(page.getByText('Menunggu hasil MaPic…', { exact: true })).toBeVisible(); await page.getByRole('button', { name: 'Tutup panel AI' }).click();
  await saveScene(page); await page.getByRole('button', { name: 'AI image', exact: true }).click(); await expect(page.getByAltText('Hasil MaPic')).toBeVisible();
  expect((await saveScene(page)).elements).toEqual(before.elements); expect(await mockCalls(request)).toHaveLength(1);
  await page.getByRole('button', { name: 'Generate image' }).click(); await expect(page.getByRole('dialog', { name: 'Ganti preview?' })).toBeVisible(); await page.getByRole('button', { name: 'Batal', exact: true }).click();
});
test('malicious downstream error cannot expose machine token in browser, logs or workspace', async ({ page, request }) => {
  const logs: string[] = []; page.on('console', message => logs.push(message.text()));
  await mockMode(request, 'status', 0, 500); await ready(page); await draw(page); const before = await saveScene(page);
  await page.getByRole('button', { name: 'AI image', exact: true }).click(); await page.getByLabel('Prompt', { exact: true }).fill('Kegagalan layanan');
  await page.getByRole('button', { name: 'Generate image' }).click(); await expect(page.getByText('Hasil belum diketahui', { exact: true })).toBeVisible();
  expect(await page.locator('body').innerText()).not.toContain(TEST_TOKEN); expect(logs.join('\n')).not.toContain(TEST_TOKEN);
  expect((await saveScene(page)).elements).toEqual(before.elements); expect(await mockCalls(request)).toHaveLength(1);
});
test('disconnect explains unknown outcome; no automatic retry and input remains', async ({ page, request }) => {
  await mockMode(request, 'disconnect'); await ready(page); await page.getByRole('button', { name: 'AI image', exact: true }).click(); await page.getByLabel('Prompt', { exact: true }).fill('Tetap tersimpan'); await page.getByRole('button', { name: 'Generate image' }).click();
  await expect(page.getByText('Hasil belum diketahui', { exact: true })).toBeVisible(); await expect(page.getByLabel('Prompt', { exact: true })).toHaveValue('Tetap tersimpan'); expect(await mockCalls(request)).toHaveLength(1);
  await page.getByRole('button', { name: 'Generate image' }).click(); await expect(page.getByRole('dialog', { name: 'Coba generation baru?' })).toBeVisible(); await page.getByRole('button', { name: 'Batal', exact: true }).click(); expect(await mockCalls(request)).toHaveLength(1);
});
