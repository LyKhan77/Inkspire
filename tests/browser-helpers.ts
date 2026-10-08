import { expect } from '@playwright/test';
import type { Page, APIRequestContext } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { emptyScene, makePNG } from './fixtures';
import { TEST_TOKEN } from './mock-mapic';
export async function ready(page: Page) { await page.goto('/'); await expect(page.getByRole('radio', { name: 'Persegi', exact: true })).toBeVisible(); }
export async function chooseTheme(page: Page, choice: 'system' | 'light' | 'dark') {
  if (choice === 'system') await page.getByLabel('Ikuti sistem', { exact: true }).check();
  else {
    if (await page.locator('.inkspire').getAttribute('data-theme') === choice) await page.getByLabel('Ikuti sistem', { exact: true }).uncheck();
    else await page.getByRole('button', { name: choice === 'dark' ? 'Aktifkan dark mode' : 'Aktifkan light mode', exact: true }).click();
    await expect(page.locator('.inkspire')).toHaveAttribute('data-theme', choice);
  }
  await expect(page.locator('html')).not.toHaveAttribute('data-ink-transition');
}
export async function draw(page: Page, x = 300, y = 180) {
  const box = (await page.getByTestId('editor').boundingBox())!;
  await page.getByTestId('editor').click({ position: { x: 600, y: 450 } }); await page.keyboard.press('r');
  await page.mouse.move(box.x + x, box.y + y); await page.mouse.down(); await page.mouse.move(box.x + x + 170, box.y + y + 110); await page.mouse.up();
  await expect(page.getByRole('button', { name: 'Urungkan', exact: true })).toBeEnabled();
}
export async function saveScene(page: Page) {
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Simpan file', exact: true }).click();
  const text = await readFile((await (await pending).path())!, 'utf8');
  expect(text).not.toContain(TEST_TOKEN);
  await mkdir('output/workspaces', { recursive: true });
  await writeFile(`output/workspaces/${randomUUID()}.excalidraw`, text);
  return JSON.parse(text);
}
export async function importScene(page: Page, scene: unknown, name = 'Gambar.excalidraw') {
  await page.getByTestId('workspace-input').setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(scene)) });
  await page.getByRole('button', { name: 'Ganti canvas', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
}
export async function imageScene() {
  const dataURL = 'data:image/png;base64,' + (await makePNG(48, 24)).toString('base64');
  const elements = [0, 1].map(i => ({ id: 'image' + i, type: 'image', fileId: 'file' + i, x: 320 + 120 * i, y: 150, width: 96, height: 48, status: 'saved', scale: [1, 1], isDeleted: false }));
  const files = Object.fromEntries(elements.map(e => [e.fileId, { id: e.fileId, mimeType: 'image/png', dataURL, created: 1 }]));
  return { ...emptyScene, elements, files };
}
export async function mockMode(request: APIRequestContext, kind = 'success', delay = 0, status = 500) {
  await request.post('http://127.0.0.1:4184/__test/mode', { data: { kind, delay, status } });
}
export async function mockCalls(request: APIRequestContext) { return (await request.get('http://127.0.0.1:4184/__test/calls')).json(); }
