import { expect, test } from 'vitest';
import { parseWorkspaceJSON } from '../src/features/workspace/schema';
import { emptyScene, makePNG } from './fixtures';
test('native scene requires embedded matching image assets', async () => {
  const asset = { id: 'png', dataURL: 'data:image/png;base64,' + (await makePNG()).toString('base64') };
  const scene = { ...emptyScene, elements: [{ id: 'image', type: 'image', fileId: 'png' }], files: { png: asset } };
  expect(parseWorkspaceJSON(JSON.stringify(scene)).files.png).toEqual(asset);
  for (const files of [{}, { png: { ...asset, id: 'wrong' } }, { png: { ...asset, dataURL: 'https://evil/image.png' } }]) expect(() => parseWorkspaceJSON(JSON.stringify({ ...scene, files }))).toThrow();
  for (const data of [{}, { ...emptyScene, files: [] }, { ...emptyScene, elements: [null] }]) expect(() => parseWorkspaceJSON(JSON.stringify(data))).toThrow();
});
