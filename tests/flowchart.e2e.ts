import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { chooseTheme, draw, imageScene, importScene, ready, saveScene } from './browser-helpers';
import { emptyScene } from './fixtures';

type FlowMeta = { diagramId: string; sourceMermaid: string; inputMode: string; schemaVersion: number };
type SceneElement = {
  id: string; type: string; x?: number; y?: number; width?: number; height?: number; isDeleted?: boolean; fileId?: string;
  text?: string; originalText?: string; points?: number[][]; groupIds?: string[]; containerId?: string | null;
  boundElements?: { id: string }[]; startBinding?: { elementId: string } | null; endBinding?: { elementId: string } | null;
  customData?: { inkspireFlowchart?: FlowMeta } | null;
};
type Scene = { elements: SceneElement[]; files: Record<string, { dataURL: string }> };

const dialog = (page: Page) => page.getByRole('dialog', { name: 'Flowchart', exact: true });
const inputBox = (page: Page) => dialog(page).getByRole('textbox', { name: 'Teks langkah', exact: true });
const previewImage = (page: Page) => dialog(page).getByAltText('Preview flowchart', { exact: true });
const addButton = (page: Page) => dialog(page).getByRole('button', { name: 'Tambahkan ke canvas', exact: true });
const makeButton = (page: Page) => dialog(page).getByRole('button', { name: 'Buat preview', exact: true });
const tab = (page: Page, name: string) => dialog(page).getByRole('tab', { name, exact: true });

/** History bookkeeping only. Every other element field is treated as persistent and compared. */
const TRANSIENT_FIELDS = new Set(['version', 'versionNonce', 'updated']);
/** Re-deriving a centred position can differ in the last IEEE-754 bits; that is not a geometric change. */
const FLOAT_NOISE = 1e-9;
/**
 * Undo→redo replays the insertion through Excalidraw's history, which re-resolves the endpoints of arrows bound to
 * nodes. Measured on this harness: arrow.x 0.97, arrow.y 0.50, arrow.width 3.01, arrow.height 1.42, arrow.points 2.50.
 * The replayed state is then stable again, so no other stage or field is allowed to move.
 */
const historyReplayTolerance = (type: string, key: string) => type === 'arrow' && /^(x|y|width|height|points\[\d+\]\[\d+\])$/.test(key) ? 4 : FLOAT_NOISE;
/** Chromium logs this itself when a harness download races the page's beforeunload guard without transient activation. */
const BROWSER_ARTIFACT = /Blocked attempt to show a 'beforeunload' confirmation panel/u;
const applicationErrors = (messages: string[]) => messages.filter(message => !BROWSER_ARTIFACT.test(message));

function flattenFields(path: string, value: unknown, into: Map<string, unknown>) {
  if (Array.isArray(value)) { for (const [index, item] of value.entries()) flattenFields(`${path}[${index}]`, item, into); return; }
  if (value && typeof value === 'object') { for (const [key, item] of Object.entries(value)) flattenFields(path ? `${path}.${key}` : key, item, into); return; }
  into.set(path, value);
}

function persistentFields(element: SceneElement) {
  const normalized = { ...element, boundElements: [...(element.boundElements ?? [])].sort((a, b) => a.id.localeCompare(b.id)) } as unknown as Record<string, unknown>;
  const into = new Map<string, unknown>();
  flattenFields('', normalized, into);
  for (const key of TRANSIENT_FIELDS) into.delete(key);
  return into;
}

/** Every persistent field of every element, matched positionally by id, including all points, style, text and bindings. */
function expectSameScene(actual: SceneElement[], expected: SceneElement[], stage: string, tolerance: (type: string, key: string) => number = () => FLOAT_NOISE) {
  expect(actual.map(element => element.id)).toEqual(expected.map(element => element.id));
  for (const [index, want] of expected.entries()) {
    const got = actual[index]!;
    const before = persistentFields(want);
    const after = persistentFields(got);
    expect([...after.keys()].sort(), `${stage}: ${got.id}`).toEqual([...before.keys()].sort());
    for (const [key, value] of before) {
      const other = after.get(key)!;
      if (typeof value === 'number' && typeof other === 'number') {
        const limit = tolerance(got.type, key);
        expect(Math.abs(other - value) <= limit, `${stage}: ${got.id} (${got.type}) ${key}: ${value} -> ${other} (max ${limit})`).toBe(true);
        continue;
      }
      expect(other, `${stage}: ${got.id} (${got.type}) ${key}`).toEqual(value);
    }
  }
}

async function openFlowchart(page: Page) {
  await page.locator('.App-toolbar__extra-tools-trigger').click();
  const item = page.locator('.dropdown-menu-item').filter({ has: page.locator('[data-inkspire-flowchart-trigger]') });
  await expect(item.locator('.DropDownMenuItemBadge')).toBeHidden();
  await page.screenshot({ path: 'output/flowchart/flowchart-more-tools.png' });
  await item.click();
  await expect(dialog(page)).toBeVisible();
}

async function previewExample(page: Page) {
  await openFlowchart(page);
  await dialog(page).getByRole('button', { name: 'Muat contoh', exact: true }).click();
  await makeButton(page).click();
  await expect(previewImage(page)).toBeVisible({ timeout: 25_000 });
}

/** Uses the existing save control while the modal is open, so insertion logic is not bypassed. */
async function saveWhileModalOpen(page: Page) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Simpan file', exact: true }).evaluate(button => (button as HTMLButtonElement).click());
  return JSON.parse(await readFile(await (await pending).path(), 'utf8')) as Scene;
}

function monitorObjectUrls(page: Page) {
  return page.addInitScript(() => {
    const monitor = { created: [] as { url: string; type: string }[], revoked: [] as string[] };
    const create = URL.createObjectURL.bind(URL); const revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = blob => { const url = create(blob); monitor.created.push({ url, type: blob instanceof Blob ? blob.type : '' }); return url; };
    URL.revokeObjectURL = url => { monitor.revoked.push(url); revoke(url); };
    Object.defineProperty(window, 'inkspireUrls', { value: monitor });
  });
}

async function previewUrlState(page: Page) {
  const monitor = await page.evaluate(() => (window as unknown as { inkspireUrls: { created: { url: string; type: string }[]; revoked: string[] } }).inkspireUrls);
  const previews = monitor.created.filter(entry => entry.type === 'image/png').map(entry => entry.url);
  return { previews, revoked: monitor.revoked.filter(url => previews.includes(url)) };
}

test('preview does not touch the canvas; insertion groups, binds, undoes once and survives round trips', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => consoleErrors.push(String(error)));
  await ready(page); await draw(page); const before = await saveScene(page) as Scene;
  await previewExample(page);
  const unchanged = await saveWhileModalOpen(page);
  expect(unchanged.elements).toEqual(before.elements);
  expect(unchanged.elements).toHaveLength(1);
  await expect(page.locator('.ttd-dialog')).toHaveCount(0);

  await addButton(page).click();
  await expect(dialog(page)).toBeHidden();
  const scene = await saveScene(page) as Scene;
  const oldIds = new Set(before.elements.map(element => element.id));
  const added = scene.elements.filter(element => !oldIds.has(element.id));
  expect(added.length).toBeGreaterThan(5);
  expect(added.every(element => element.type !== 'image')).toBe(true);
  const anchors = added.filter(element => element.customData?.inkspireFlowchart);
  expect(anchors).toHaveLength(1);
  const meta = anchors[0]!.customData!.inkspireFlowchart!;
  expect(meta).toMatchObject({ schemaVersion: 1, inputMode: 'text' });
  expect(meta.sourceMermaid).toContain('flowchart TD');
  expect(added.every(element => element.groupIds!.includes(meta.diagramId))).toBe(true);
  for (const element of added) if (element.type === 'arrow' || element.type === 'line') expect(element.points?.[0], `${element.id} lands on the canvas already normalized`).toEqual([0, 0]);

  const converged = await saveScene(page) as Scene;
  expectSameScene(converged.elements, scene.elements, 'settle');

  await page.getByTestId('editor').click({ position: { x: 700, y: 450 } }); await page.keyboard.press('Meta+z');
  expect((await saveScene(page) as Scene).elements).toEqual(before.elements);
  await page.getByTestId('editor').click({ position: { x: 700, y: 450 } }); await page.keyboard.press('Meta+Shift+z');
  const replayed = await saveScene(page) as Scene;
  expectSameScene(replayed.elements, converged.elements, 'redo', historyReplayTolerance);

  await page.getByTestId('editor').click({ position: { x: 700, y: 450 } });
  const settled = await saveScene(page) as Scene;
  expectSameScene(settled.elements, replayed.elements, 'mutation');

  await expect(page.getByText('Draft tersimpan di browser', { exact: true })).toBeVisible();
  await page.reload(); await page.evaluate(() => document.fonts.ready);
  const restoredDraft = await saveScene(page) as Scene;
  expectSameScene(restoredDraft.elements, settled.elements, 'reload');

  await importScene(page, restoredDraft);
  expectSameScene((await saveScene(page) as Scene).elements, restoredDraft.elements, 'import');
  expect(applicationErrors(consoleErrors)).toEqual([]);
});

test('two insertions stay separate with closed bindings and no element loss', async ({ page }) => {
  await ready(page);
  await previewExample(page); await addButton(page).click(); await expect(dialog(page)).toBeHidden();
  const first = await saveScene(page) as Scene;
  const firstDiagram = first.elements.find(element => element.customData?.inkspireFlowchart)!.customData!.inkspireFlowchart!.diagramId;
  await previewExample(page); await addButton(page).click(); await expect(dialog(page)).toBeHidden();
  const second = await saveScene(page) as Scene;
  const diagrams = second.elements.filter(element => element.customData?.inkspireFlowchart).map(element => element.customData!.inkspireFlowchart!.diagramId);
  expect(diagrams).toHaveLength(2);
  expect(diagrams[1]).not.toBe(diagrams[0]);
  expect(second.elements.length).toBe(first.elements.length * 2);
  expect(new Set(second.elements.map(element => element.id)).size).toBe(second.elements.length);

  const ids = new Set(second.elements.map(element => element.id));
  for (const element of second.elements) {
    for (const binding of [element.startBinding, element.endBinding]) if (binding) expect(ids.has(binding.elementId), element.id).toBe(true);
    if (element.containerId) expect(ids.has(element.containerId), element.id).toBe(true);
    for (const binding of element.boundElements ?? []) expect(ids.has(binding.id), element.id).toBe(true);
  }
  const fresh = second.elements.filter(element => element.groupIds!.includes(diagrams[1]!));
  expect(fresh.every(element => !element.groupIds!.includes(diagrams[0]!))).toBe(true);
  expect(fresh.filter(element => element.customData?.inkspireFlowchart)).toHaveLength(1);
});

test('native ungroup isolates one node, its connectors follow and arrow point editing stays normalized', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => consoleErrors.push(String(error)));
  await ready(page);
  await previewExample(page); await addButton(page).click(); await expect(dialog(page)).toBeHidden();
  const scene = await saveScene(page) as Scene;
  const snapshot = scene.elements.find(element => element.customData?.inkspireFlowchart)!.customData!.inkspireFlowchart!.sourceMermaid;
  const box = (await page.getByTestId('editor').boundingBox())!;
  const center = (element: SceneElement) => ({ x: Math.round(element.x! + element.width! / 2), y: Math.round(element.y! + element.height! / 2) });
  /** Clamping would land the pointer outside a partly visible node, so only fully visible shapes are clickable. */
  const visible = (element: SceneElement) => element.x! > 80 && element.y! > 80 && element.x! + element.width! < box.width - 80 && element.y! + element.height! < box.height - 80;
  const isNode = (element: SceneElement) => ['rectangle', 'diamond', 'ellipse'].includes(element.type);
  const nodes = scene.elements.filter(element => isNode(element) && visible(element));
  expect(nodes.length).toBeGreaterThan(1);

  // The insertion leaves the whole diagram selected, so the native ungroup action is reachable from the canvas menu.
  await page.getByTestId('editor').click({ position: center(nodes[0]!), button: 'right' });
  await page.getByRole('button', { name: 'Pisahkan pilihan', exact: true }).click();
  const ungrouped = await saveScene(page) as Scene;
  expect(ungrouped.elements.every(element => element.groupIds!.length === 0)).toBe(true);
  for (const want of scene.elements) {
    const got = ungrouped.elements.find(element => element.id === want.id)!;
    expect([got.x, got.y, got.width, got.height, got.text], want.id).toEqual([want.x, want.y, want.width, want.height, want.text]);
  }

  const endpoints = new Set(ungrouped.elements.flatMap(element => [element.startBinding?.elementId, element.endBinding?.elementId]));
  const movable = ungrouped.elements.find(element => isNode(element) && visible(element) && endpoints.has(element.id) && ungrouped.elements.some(other => other.containerId === element.id))!;
  expect(movable).toBeTruthy();
  const byId = new Map(ungrouped.elements.map(element => [element.id, element]));
  const shift = (element: SceneElement) => [Math.round((element.x! - byId.get(element.id)!.x!) * 1e6) / 1e6, Math.round((element.y! - byId.get(element.id)!.y!) * 1e6) / 1e6];
  await page.getByTestId('editor').click({ position: { x: 40, y: 40 } });
  await page.getByTestId('editor').click({ position: center(movable) });
  for (let press = 0; press < 8; press++) await page.keyboard.press('ArrowRight');
  const moved = await saveScene(page) as Scene;

  const movedNode = moved.elements.find(element => element.id === movable.id)!;
  const movedLabel = moved.elements.find(element => element.containerId === movable.id)!;
  const arrows = moved.elements.filter(element => element.startBinding?.elementId === movable.id || element.endBinding?.elementId === movable.id);
  expect(arrows.length).toBeGreaterThan(0);
  /** Nudging one node must move that node, its bound label and the connectors bound to it, and nothing else. */
  const mayMove = new Set([movedNode.id, movedLabel.id, ...arrows.map(element => element.id)]);
  expect(moved.elements.filter(element => shift(element).some(offset => offset !== 0)).map(element => element.id).sort(), 'exactly the node, its label and its connectors moved')
    .toEqual([...mayMove].sort());
  expect(shift(movedNode), 'node nudge').toEqual([8, 0]);
  expect(shift(movedLabel), 'bound label follows its container').toEqual([8, 0]);
  for (const arrow of moved.elements.filter(element => element.type === 'arrow')) expect(arrow.points?.[0], arrow.id).toEqual([0, 0]);
  for (const arrow of arrows) {
    const before = byId.get(arrow.id)!;
    expect(arrow.points, `${arrow.id} connector geometry`).not.toEqual(before.points);
    expect([arrow.startBinding?.elementId, arrow.endBinding?.elementId]).toEqual([before.startBinding?.elementId, before.endBinding?.elementId]);
  }
  expect(moved.elements.find(element => element.customData?.inkspireFlowchart)!.customData!.inkspireFlowchart!.sourceMermaid).toBe(snapshot);
  expect(applicationErrors(consoleErrors)).toEqual([]);

  /**
   * The native "Edit arrow" panel button constructs LinearElementEditor, the path that rejected the unnormalized
   * arrows in F1. The click that selects the arrow is placed on an open stretch of the first segment, clear of the node
   * boxes and of the centre where a label renders, so the selection is the connector itself and not a neighbouring shape.
   */
  const candidates = moved.elements
    .filter(element => element.type === 'arrow' && element.points!.length > 2)
    .map(element => {
      const body = { x: Math.round(element.x! + (element.points![0][0] + element.points![1][0]) / 2), y: Math.round(element.y! + (element.points![0][1] + element.points![1][1]) / 2) };
      const centre = { x: element.x! + element.width! / 2, y: element.y! + element.height! / 2 };
      return {
        element,
        body,
        vertex: { x: Math.round(element.x! + element.points![1][0]), y: Math.round(element.y! + element.points![1][1]) },
        labelled: moved.elements.some(other => other.containerId === element.id),
        open: moved.elements.filter(shape => isNode(shape)).every(node => body.x < node.x! || body.x > node.x! + node.width! || body.y < node.y! || body.y > node.y! + node.height!),
        clearOfLabel: Math.hypot(body.x - centre.x, body.y - centre.y) > 25,
      };
    })
    .filter(candidate => candidate.open && candidate.clearOfLabel && candidate.body.x > 40 && candidate.body.y > 40 && candidate.body.x < box.width - 40 && candidate.body.y < box.height - 40)
    .sort((a, b) => Number(a.labelled) - Number(b.labelled));

  const target = candidates[0]!;
  expect(target, 'an arrow segment must be reachable in open canvas space').toBeTruthy();

  await page.getByTestId('editor').click({ position: { x: 40, y: 40 } });
  await page.getByTestId('editor').click({ position: target.body });
  await page.getByRole('button', { name: 'Edit arrow', exact: true }).click();
  await page.mouse.move(box.x + target.vertex.x, box.y + target.vertex.y);
  await page.mouse.down();
  await page.mouse.move(box.x + target.vertex.x + 24, box.y + target.vertex.y + 18, { steps: 4 });
  await page.mouse.up();
  await page.keyboard.press('Escape');
  const afterEdit = await saveScene(page) as Scene;
  const editedArrow = afterEdit.elements.find(element => element.id === target.element.id)!;
  expect(Math.hypot(editedArrow.points![1][0] - target.element.points![1][0], editedArrow.points![1][1] - target.element.points![1][1]), 'dragging the vertex must reach LinearElementEditor').toBeGreaterThan(5);
  expect(editedArrow.points![0], 'edited arrow stays normalized').toEqual([0, 0]);
  expect(applicationErrors(consoleErrors)).toEqual([]);
});

test('changing input discards stale preview; closing retains input and restores tool focus', async ({ page }) => {
  await ready(page); await previewExample(page);
  await inputBox(page).fill('Mulai -> Simpan -> Selesai');
  await expect(previewImage(page)).toBeHidden();
  await expect(addButton(page)).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();
  await expect(page.locator('.App-toolbar__extra-tools-trigger')).toBeFocused();
  await openFlowchart(page);
  await expect(inputBox(page)).toHaveValue('Mulai -> Simpan -> Selesai');
});

test('feature preview object URLs are revoked on replace, edit and close', async ({ page }) => {
  await monitorObjectUrls(page);
  await ready(page); await previewExample(page);
  const first = await previewUrlState(page);
  expect(first.previews).toHaveLength(1);
  expect(first.revoked).toEqual([]);
  await dialog(page).getByRole('button', { name: 'Muat contoh', exact: true }).click();
  await makeButton(page).click();
  await expect(previewImage(page)).toBeVisible({ timeout: 25_000 });
  const replaced = await previewUrlState(page);
  expect(replaced.previews).toHaveLength(2);
  expect(replaced.revoked).toContain(first.previews[0]!);
  await inputBox(page).fill('Mulai -> Simpan -> Selesai');
  await page.keyboard.press('Escape');
  const closed = await previewUrlState(page);
  expect(closed.revoked.slice().sort()).toEqual(closed.previews.slice().sort());
});

test('workspace replacement with the same name invalidates the preview instead of targeting the new canvas', async ({ page }) => {
  await ready(page);
  await page.getByLabel('Nama workspace', { exact: true }).fill('Sama');
  await previewExample(page);
  await page.getByTestId('workspace-input').setInputFiles({ name: 'Sama.excalidraw', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(emptyScene)) });
  const confirmation = page.getByRole('dialog', { name: 'Ganti workspace?', exact: true });
  await confirmation.getByRole('button', { name: 'Ganti canvas', exact: true }).click();
  await expect(dialog(page).getByRole('alert')).toContainText('Workspace berubah');
  await expect(addButton(page)).toBeDisabled();
  await page.keyboard.press('Escape');
  expect((await saveScene(page) as Scene).elements).toHaveLength(0);
});

test('invalid, oversized and unsupported input reports a local error before any preview exists', async ({ page }) => {
  await ready(page);
  const textCases: [string, string][] = [
    ['51 nodes', Array.from({ length: 51 }, (_, index) => `Langkah ${index}`).join('\n')],
    ['121 character label', `Mulai -> ${'x'.repeat(121)} -> Selesai`],
    ['8001 characters', `Mulai -> ${'a'.repeat(7990)} -> Selesai`],
    ['missing branch', 'Mulai\nJika valid?:\n  Ya -> Selesai'],
    ['unknown reference', 'Mulai -> @Tidak ada'],
    ['nested indentation', 'Mulai\nJika valid?:\n  Ya -> Selesai\n   Tidak -> Error'],
    ['tab indentation', 'Mulai\n\tYa -> Selesai'],
    ['active html label', 'Mulai -> <img src=x> -> Selesai'],
  ];
  await openFlowchart(page);
  for (const [name, source] of textCases) {
    await inputBox(page).fill(source);
    await makeButton(page).click();
    await expect(dialog(page).getByRole('alert'), name).toBeVisible();
    await expect(previewImage(page), name).toHaveCount(0);
    await expect(addButton(page), name).toBeDisabled();
  }
  await tab(page, 'Mermaid').click();
  const edges = ['flowchart TD', 'A([Start])', 'B[Work]'].concat(Array.from({ length: 101 }, (_, index) => `A -->|L${index}| B`)).join('\n');
  await dialog(page).getByRole('textbox', { name: 'Mermaid', exact: true }).fill(edges);
  await makeButton(page).click();
  await expect(dialog(page).getByRole('alert')).toContainText('Batas flowchart');
  await expect(previewImage(page)).toHaveCount(0);
});

test('structural warnings stay non-blocking and the Mermaid tab shares the same model', async ({ page }) => {
  await ready(page);
  await openFlowchart(page);
  await inputBox(page).fill('Mulai -> Proses mengambang');
  await makeButton(page).click();
  await expect(previewImage(page)).toBeVisible({ timeout: 25_000 });
  await expect(dialog(page).getByText('Proses nonterminal tidak memiliki konektor keluar')).toBeVisible();
  await expect(addButton(page)).toBeEnabled();
  await dialog(page).getByRole('button', { name: 'Gunakan kode Mermaid', exact: true }).click();
  await expect(dialog(page).getByRole('textbox', { name: 'Mermaid', exact: true })).toHaveValue(/flowchart TD/);
  await expect(previewImage(page)).toHaveCount(0);
  await makeButton(page).click();
  await expect(previewImage(page)).toBeVisible({ timeout: 25_000 });
  await expect(inputBox(page)).toHaveCount(0);
  await dialog(page).getByRole('button', { name: 'Salin Mermaid', exact: true }).click();
  await expect(dialog(page).getByText(/Kode disalin\.|Pilih kode dan salin manual\./)).toBeVisible();
});

test('existing image assets survive insertion, export and reload', async ({ page }) => {
  await ready(page);
  const original = await imageScene();
  await importScene(page, original);
  const before = await saveScene(page) as Scene;
  await previewExample(page);
  await addButton(page).click(); await expect(dialog(page)).toBeHidden();
  const after = await saveScene(page) as Scene;
  expect(after.elements.filter(element => element.type === 'image')).toHaveLength(2);
  expect(after.elements.length).toBeGreaterThan(7);
  for (const id of Object.keys(before.files)) expect(after.files[id].dataURL).toBe(before.files[id].dataURL);
  expectSameScene(after.elements.slice(0, 2), before.elements, 'asset-preserve');
  await expect(page.getByText('Draft tersimpan di browser', { exact: true })).toBeVisible();
  await page.reload(); await page.evaluate(() => document.fonts.ready); await expect(page.getByTestId('editor')).toBeVisible();
  const restored = await saveScene(page) as Scene;
  expectSameScene(restored.elements, after.elements, 'asset-reload');
  for (const id of Object.keys(before.files)) expect(restored.files[id].dataURL).toBe(before.files[id].dataURL);
});

test('tabs are keyboard reachable, workspace shortcuts stay gated and typing does not draw', async ({ page }) => {
  await ready(page);
  await openFlowchart(page);
  await expect(inputBox(page)).toBeFocused();
  await page.keyboard.type('r');
  await expect(inputBox(page)).toHaveValue('r');
  await expect(page.getByRole('radio', { name: 'Persegi', exact: true })).not.toBeChecked();
  await tab(page, 'Teks langkah').click();
  await expect(tab(page, 'Teks langkah')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(tab(page, 'Mermaid')).toBeFocused();
  await expect(tab(page, 'Mermaid')).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowLeft');
  await expect(tab(page, 'Teks langkah')).toBeFocused();
  await page.keyboard.press('End');
  await expect(tab(page, 'Mermaid')).toBeFocused();
  await page.keyboard.press('Home');
  await expect(tab(page, 'Teks langkah')).toBeFocused();
  await inputBox(page).click();
  const downloaded = page.waitForEvent('download', { timeout: 2000 }).then(() => true).catch(() => false);
  await page.keyboard.press('Control+s');
  expect(await downloaded).toBe(false);
  await expect(dialog(page)).toBeVisible();
});

test('English switch keeps source, ids and canvas while Indonesian grammar still parses', async ({ page }) => {
  await ready(page); await previewExample(page);
  const source = await dialog(page).evaluate(node => (node.querySelector('textarea[readonly]') as HTMLTextAreaElement).value);
  await addButton(page).click(); await expect(dialog(page)).toBeHidden();
  const scene = await saveScene(page) as Scene;
  await page.getByLabel('Bahasa', { exact: true }).selectOption('en');
  await page.locator('.App-toolbar__extra-tools-trigger').click();
  await page.locator('.dropdown-menu-item').filter({ has: page.locator('[data-inkspire-flowchart-trigger]') }).click();
  const english = page.getByRole('dialog', { name: 'Flowchart', exact: true });
  await expect(english.getByRole('tab', { name: 'Steps', exact: true })).toBeVisible();
  await english.getByRole('button', { name: 'Load example', exact: true }).click();
  await english.getByRole('button', { name: 'Create preview', exact: true }).click();
  await expect(english.getByAltText('Flowchart preview', { exact: true })).toBeVisible({ timeout: 25_000 });
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();
  await page.getByLabel('Language', { exact: true }).selectOption('id');
  const after = await saveScene(page) as Scene;
  expectSameScene(after.elements, scene.elements, 'language');
  expect(after.elements.find(element => element.customData?.inkspireFlowchart)!.customData!.inkspireFlowchart!.sourceMermaid).toBe(source);
});

test('light and dark themes keep the preview and insertion path usable', async ({ page }) => {
  await ready(page);
  await previewExample(page);
  await page.screenshot({ path: 'output/flowchart/flowchart-light.png' });
  expect(await dialog(page).evaluate(node => ({ x: node.scrollWidth - node.clientWidth, y: node.scrollHeight - node.clientHeight })), 'dialog must not scroll horizontally').toMatchObject({ x: 0 });
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();
  await chooseTheme(page, 'dark');
  await openFlowchart(page);
  await expect(inputBox(page)).toHaveValue(/Jika input valid\?:/);
  await makeButton(page).click();
  await expect(previewImage(page)).toBeVisible({ timeout: 25_000 });
  await page.screenshot({ path: 'output/flowchart/flowchart-dark.png' });
  expect(await dialog(page).evaluate(node => (node.querySelector('textarea[readonly]') as HTMLTextAreaElement).value)).toContain('flowchart TD');
  await expect(addButton(page)).toBeEnabled();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('editor')).toBeVisible();
  expect((await saveScene(page) as Scene).elements).toHaveLength(0);
});

test('mobile layout keeps the dialog single column without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await previewExample(page);
  await page.screenshot({ path: 'output/flowchart/flowchart-mobile.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  const columns = await dialog(page).evaluate(node => getComputedStyle(node.querySelector('.flowchart-grid')!).gridTemplateColumns);
  expect(columns.split(' ').length).toBe(1);
  await addButton(page).click(); await expect(dialog(page)).toBeHidden();
  expect((await saveScene(page) as Scene).elements.length).toBeGreaterThan(5);
});
