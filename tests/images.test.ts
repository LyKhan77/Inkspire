import { expect, test } from 'vitest';
import sharp from 'sharp';
import { randomBytes } from 'node:crypto';
import { validateReferenceImage, validateResultPNG } from '../server/images';
import { makePNG, makeJPEG, makeAnimatedPNG } from './fixtures';
test('APNG animation control is rejected even when decoder reports only its default frame', async () => {
  const encoded = (await makeAnimatedPNG()).toString('base64');
  await expect(validateReferenceImage(encoded, 0)).rejects.toMatchObject({ status: 422 });
  await expect(validateResultPNG(encoded)).rejects.toMatchObject({ status: 502 });
});
test('references require full PNG/JPEG decode, strict base64 and single frame', async () => {
  const png = await makePNG(); const jpeg = await makeJPEG();
  for (const buffer of [png, jpeg, await makePNG(2048, 2048)]) await expect(validateReferenceImage(buffer.toString('base64'), 0)).resolves.toBeUndefined();
  for (const base64 of ['???', '', 'data:image/png;base64,' + png.toString('base64'), png.subarray(0, png.length / 2).toString('base64'), Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>').toString('base64'), (await sharp(png).gif().toBuffer()).toString('base64'), (await makePNG(2049, 1)).toString('base64'), (await makePNG(2049, 2049)).toString('base64')]) await expect(validateReferenceImage(base64, 0)).rejects.toMatchObject({ status: 422, field: 'images.0' });
});
test('reference character and byte caps are enforced before image decode', async () => {
  await expect(validateReferenceImage('A'.repeat(2_800_004), 1)).rejects.toMatchObject({ status: 413 });
  await expect(validateReferenceImage(Buffer.alloc(2 * 1024 * 1024 + 1).toString('base64'), 1)).rejects.toMatchObject({ status: 413 });
});
test('result PNG has independent limits and fully decodes', async () => {
  const png = await makePNG(); await expect(validateResultPNG(png.toString('base64'))).resolves.toBeUndefined();
  const noisy = await sharp(randomBytes(1024 * 1024 * 3), { raw: { width: 1024, height: 1024, channels: 3 } }).png().toBuffer();
  expect(noisy.length).toBeGreaterThan(2 * 1024 * 1024); await expect(validateResultPNG(noisy.toString('base64'))).resolves.toBeUndefined();
  for (const base64 of ['???', (await makeJPEG()).toString('base64'), png.subarray(0, png.length / 2).toString('base64'), (await makePNG(4097, 4096)).toString('base64')]) await expect(validateResultPNG(base64)).rejects.toMatchObject({ status: 502 });
});
