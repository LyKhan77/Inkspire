import { CaptureUpdateAction, convertToExcalidrawElements, getCommonBounds, viewportCoordsToSceneCoords } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { GroupId } from '@excalidraw/excalidraw/element/types';
import { FlowchartError } from './model';
import { assertBindings, assertOutput } from './convert';
import type { Converted } from './convert';

/**
 * Additive only: the current scene (including deleted elements) is copied, never rewritten.
 * One synchronous guard pair keeps a stale preview from landing in a replaced workspace.
 */
export function insertFlowchart(api: ExcalidrawImperativeAPI, preview: Converted, canInsert: () => boolean): string {
  if (!canInsert()) throw new FlowchartError('STALE');
  const elements = convertToExcalidrawElements(structuredClone(preview.skeleton), { regenerateIds: true });
  assertOutput({ elements }, true);
  assertBindings(elements);
  const state = api.getAppState();
  const center = viewportCoordsToSceneCoords({ clientX: state.offsetLeft + state.width / 2, clientY: state.offsetTop + state.height / 2 }, state);
  const [x1, y1, x2, y2] = getCommonBounds(elements);
  const dx = center.x - (x1 + x2) / 2;
  const dy = center.y - (y1 + y2) / 2;
  const diagramId = crypto.randomUUID() as GroupId;
  const inserted = elements.map((element, index) => ({
    ...element,
    x: element.x + dx,
    y: element.y + dy,
    groupIds: [...element.groupIds, diagramId],
    customData: index === 0 ? { ...element.customData, inkspireFlowchart: { schemaVersion: 1, diagramId, sourceMermaid: preview.sourceMermaid, inputMode: preview.inputMode } } : element.customData,
  }));
  if (!canInsert()) throw new FlowchartError('STALE');
  api.updateScene({
    elements: [...api.getSceneElementsIncludingDeleted(), ...inserted],
    appState: { selectedElementIds: Object.fromEntries(inserted.map(element => [element.id, true])), selectedGroupIds: { [diagramId]: true } },
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  return diagramId;
}
