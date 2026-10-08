import { expect, test } from '@playwright/test';
test('native drawing, text and undo remain available; panel starts closed', async ({ page }) => {
  await page.goto('/'); await expect(page.getByTestId('editor')).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Persegi', exact: true })).toBeVisible();
  await page.getByTestId('editor').click({ position: { x: 600, y: 450 } });
  await expect(page.getByRole('complementary', { name: 'AI image' })).toBeHidden();
  const box = (await page.getByTestId('editor').boundingBox())!;
  await page.keyboard.press('r'); await page.mouse.move(box.x + 300, box.y + 180); await page.mouse.down(); await page.mouse.move(box.x + 470, box.y + 290); await page.mouse.up();
  await expect(page.getByRole('button', { name: 'Urungkan', exact: true })).toBeEnabled();
  await expect(page.getByText('Draft tersimpan di browser', { exact: true })).toBeVisible();
  await page.keyboard.press('a'); await page.mouse.move(box.x + 500, box.y + 200); await page.mouse.down(); await page.mouse.move(box.x + 650, box.y + 250); await page.mouse.up();
  await page.keyboard.press('t'); await page.mouse.click(box.x + 350, box.y + 350); await page.keyboard.type('Tinta lokal'); await page.keyboard.press('Escape');
  await page.keyboard.press('Meta+z'); await page.keyboard.press('Meta+Shift+z');
});
