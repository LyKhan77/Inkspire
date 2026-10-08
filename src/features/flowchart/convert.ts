import { FlowchartError, LIMITS } from './model';
import type { FlowGraph, Mode } from './model';
import { serializeMermaid } from './mermaid';
import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform';

export type Converted = {
  graph: FlowGraph;
  sourceMermaid: string;
  inputMode: Mode;
  skeleton: ExcalidrawElementSkeleton[];
  blob: Blob;
};

const ALLOWED_TYPES = new Set(['rectangle', 'diamond', 'ellipse', 'text', 'arrow', 'line']);

/**
 * Only ever called with output we produced: canonical Mermaid in, native elements out.
 * Rejects the converter's silent SVG-image fallback and anything linkable or non-finite.
 */
export function assertOutput(result: { elements: unknown[]; files?: Record<string, unknown> }, normalized = false): void {
  if (!result.elements.length || result.elements.length > LIMITS.elements || Object.keys(result.files ?? {}).length) throw new FlowchartError('UNSUPPORTED_OUTPUT');
  for (const value of result.elements) {
    if (!value || typeof value !== 'object') throw new FlowchartError('UNSUPPORTED_OUTPUT');
    const element = value as Record<string, unknown>;
    if (!ALLOWED_TYPES.has(String(element.type)) || element.link) throw new FlowchartError('UNSUPPORTED_OUTPUT');
    if (normalized && ['x', 'y', 'width', 'height'].some(key => typeof element[key] !== 'number' || !Number.isFinite(element[key]))) throw new FlowchartError('UNSUPPORTED_OUTPUT');
    if (normalized && Array.isArray(element.points) && element.points.some(point => !Array.isArray(point) || point.length !== 2 || point.some(coordinate => typeof coordinate !== 'number' || !Number.isFinite(coordinate)))) throw new FlowchartError('UNSUPPORTED_OUTPUT');
  }
}

function assertBindings(elements: { id: string; type: string; boundElements?: readonly { id: string }[] | null; containerId?: string | null; startBinding?: { elementId: string } | null; endBinding?: { elementId: string } | null }[]): void {
  const ids = new Set(elements.map(element => element.id));
  for (const element of elements) {
    if (element.boundElements?.some(binding => !ids.has(binding.id))) throw new FlowchartError('UNSUPPORTED_OUTPUT');
    if (element.type === 'text' && element.containerId && !ids.has(element.containerId)) throw new FlowchartError('UNSUPPORTED_OUTPUT');
    if ((element.type === 'arrow' || element.type === 'line') && [element.startBinding, element.endBinding].some(binding => binding && !ids.has(binding.elementId))) throw new FlowchartError('UNSUPPORTED_OUTPUT');
  }
}

/** Preview is always a neutral light PNG so a theme switch never re-runs parsing or conversion. */
export async function convertGraph(graph: FlowGraph, inputMode: Mode): Promise<Converted> {
  const sourceMermaid = serializeMermaid(graph);
  try {
    const [{ parseMermaidToExcalidraw }, editor] = await Promise.all([import('@excalidraw/mermaid-to-excalidraw'), import('@excalidraw/excalidraw')]);
    const result = await parseMermaidToExcalidraw(sourceMermaid, { startOnLoad: false, maxEdges: LIMITS.edges, maxTextSize: LIMITS.canonical, flowchart: { curve: 'linear' }, themeVariables: { fontSize: '20px' } });
    assertOutput(result);
    const elements = editor.convertToExcalidrawElements(structuredClone(result.elements), { regenerateIds: true });
    assertOutput({ elements }, true);
    assertBindings(elements);
    const blob = await editor.exportToBlob({ elements, files: {}, mimeType: 'image/png', maxWidthOrHeight: 1200, appState: { exportBackground: true, exportWithDarkMode: false, viewBackgroundColor: '#fcfbf7' } });
    return { graph, sourceMermaid, inputMode, skeleton: result.elements, blob };
  }
  catch (error) {
    if (error instanceof FlowchartError) throw error;
    throw new FlowchartError('CONVERSION_FAILED');
  }
}
