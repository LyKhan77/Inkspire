import { beforeEach, expect, it, vi } from 'vitest';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { Converted } from '../src/features/flowchart/convert';

const generation = vi.hoisted(() => ({ sequence: 0 }));

vi.mock('@excalidraw/excalidraw', () => ({
  CaptureUpdateAction: { IMMEDIATELY: 'IMMEDIATELY' },
  convertToExcalidrawElements: vi.fn(() => [0, 1].map(index => ({ id: `gen-${generation.sequence++}`, type: 'rectangle', x: index * 100, y: 0, width: 80, height: 60, groupIds: ['vendor'], customData: null }))),
  getCommonBounds: vi.fn(() => [0, 0, 180, 60]),
  viewportCoordsToSceneCoords: vi.fn(() => ({ x: 400, y: 300 })),
}));

import { convertToExcalidrawElements } from '@excalidraw/excalidraw';
import { insertFlowchart } from '../src/features/flowchart/insert';
import { parseText } from '../src/features/flowchart/text';

const preview: Converted = { graph: parseText('Start -> End', 'TD'), sourceMermaid: 'flowchart TD', inputMode: 'text', skeleton: [], blob: new Blob() };

function fixture() {
  const existing = [{ id: 'existing', type: 'rectangle', isDeleted: false }, { id: 'deleted', type: 'rectangle', isDeleted: true }];
  const updateScene = vi.fn();
  const api = { getAppState: () => ({ offsetLeft: 0, offsetTop: 0, width: 800, height: 600, zoom: { value: 1 } }), getSceneElementsIncludingDeleted: () => existing, updateScene } as unknown as ExcalidrawImperativeAPI;
  return { api, existing, updateScene };
}

type SceneUpdate = { elements: unknown[]; appState: { selectedElementIds: Record<string, boolean>; selectedGroupIds: Record<string, boolean> }; captureUpdate: string };
type Added = { id: string; x: number; y: number; groupIds: string[]; customData: { inkspireFlowchart?: { diagramId: string; sourceMermaid: string; inputMode: string; schemaVersion: number } } | null };

beforeEach(() => { generation.sequence = 0; vi.mocked(convertToExcalidrawElements).mockRestore(); });

it('retains existing/deleted scene and groups one insertion with source on one anchor', () => {
  const { api, existing, updateScene } = fixture();
  const diagramId = insertFlowchart(api, preview, () => true);
  expect(updateScene).toHaveBeenCalledTimes(1);
  const next = updateScene.mock.calls[0]![0] as SceneUpdate;
  expect(next.elements.slice(0, existing.length)).toEqual(existing);
  expect(next.captureUpdate).toBe('IMMEDIATELY');
  const added = next.elements.slice(existing.length) as Added[];
  expect(added.map(element => element.id)).toEqual(['gen-0', 'gen-1']);
  expect(added.every(element => element.groupIds.includes(diagramId) && element.groupIds.includes('vendor'))).toBe(true);
  expect(added.filter(element => element.customData?.inkspireFlowchart)).toHaveLength(1);
  expect(added[0]!.customData!.inkspireFlowchart).toEqual({ schemaVersion: 1, diagramId, sourceMermaid: preview.sourceMermaid, inputMode: 'text' });
  expect(added[1]!.customData).toBeNull();
  expect(added.map(element => [element.x, element.y])).toEqual([[310, 270], [410, 270]]);
  expect(Object.keys(next.appState.selectedElementIds).sort()).toEqual(['gen-0', 'gen-1']);
  expect(next.appState.selectedGroupIds).toEqual({ [diagramId]: true });
});

it('performs no scene mutation when the workspace guard fails initially or at commit boundary', () => {
  const { api, updateScene } = fixture();
  expect(() => insertFlowchart(api, preview, () => false)).toThrow('STALE');
  const guard = vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false);
  expect(() => insertFlowchart(api, preview, guard)).toThrow('STALE');
  expect(updateScene).not.toHaveBeenCalled();
});

it('gives a second insertion fresh element ids and its own group without touching the first', () => {
  const { api, updateScene } = fixture();
  const first = insertFlowchart(api, preview, () => true);
  const second = insertFlowchart(api, preview, () => true);
  expect(second).not.toBe(first);
  expect(updateScene).toHaveBeenCalledTimes(2);
  const added = (updateScene.mock.calls[1]![0] as SceneUpdate).elements.slice(2) as Added[];
  expect(added.map(element => element.id)).toEqual(['gen-2', 'gen-3']);
  expect(added.every(element => element.groupIds.includes(second) && !element.groupIds.includes(first))).toBe(true);
});

it('rejects malformed converter output before the scene is touched', () => {
  const { api, updateScene } = fixture();
  vi.mocked(convertToExcalidrawElements).mockImplementationOnce(() => [{ id: 'x', type: 'image', x: 0, y: 0, width: 1, height: 1, groupIds: [], customData: null }] as never);
  expect(() => insertFlowchart(api, preview, () => true)).toThrow('UNSUPPORTED_OUTPUT');
  expect(updateScene).not.toHaveBeenCalled();
});
