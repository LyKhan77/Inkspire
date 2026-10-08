export type Direction = 'TD' | 'LR';
export type Kind = 'process' | 'decision' | 'terminal';
export type Mode = 'text' | 'mermaid';
export type ErrorCode = 'EMPTY' | 'LIMIT' | 'LABEL' | 'TEXT_SYNTAX' | 'BRANCHES' | 'UNKNOWN_NODE' | 'CONFLICT' | 'MERMAID_SYNTAX' | 'UNSUPPORTED_OUTPUT' | 'CONVERSION_FAILED' | 'STALE';
export type WarningCode = 'NO_START' | 'UNREACHABLE' | 'DECISION_BRANCHES' | 'DEAD_END';
export type FlowNode = { id: string; label: string; kind: Kind; line: number };
export type FlowEdge = { from: string; to: string; label: string; line: number };
export type Warning = { code: WarningCode; line: number; label: string };
export type FlowGraph = { direction: Direction; nodes: FlowNode[]; edges: FlowEdge[]; warnings: Warning[] };

export const LIMITS = { input: 8000, lines: 200, nodes: 50, edges: 100, label: 120, canonical: 64000, elements: 350 } as const;

export class FlowchartError extends Error {
  constructor(public code: ErrorCode, public line?: number) {
    super(code);
    this.name = 'FlowchartError';
  }
}

export const normalize = (value: string) => value.normalize('NFC').trim().replace(/\s+/g, ' ');

const CONTROL = /[\u0000-\u001f\u007f]/u;
const ACTIVE_FORMAT = /<[^>]*>|`|\*\*|!\[/u;

export function label(value: string, line: number): string {
  if (CONTROL.test(value)) throw new FlowchartError('LABEL', line);
  const text = normalize(value);
  if (!text || text.length > LIMITS.label || ACTIVE_FORMAT.test(text)) throw new FlowchartError('LABEL', line);
  return text;
}

export function inputLines(input: string): { text: string; line: number }[] {
  if (!input.trim()) throw new FlowchartError('EMPTY');
  if (input.length > LIMITS.input) throw new FlowchartError('LIMIT');
  const lines = input.replace(/\r\n?/g, '\n').split('\n').map((text, i) => ({ text, line: i + 1 })).filter(row => row.text.trim());
  if (lines.length > LIMITS.lines) throw new FlowchartError('LIMIT');
  return lines;
}

const START_LABEL = /^(?:mulai|start)$/i;

export class GraphBuilder {
  private nodes = new Map<string, FlowNode>();
  private edges: FlowEdge[] = [];
  private references: { key: string; line: number }[] = [];
  constructor(private direction: Direction) {}

  node(key: string, value: string, kind: Kind, line: number): string {
    const text = label(value, line);
    const previous = this.nodes.get(key);
    if (previous && (previous.label !== text || previous.kind !== kind)) throw new FlowchartError('CONFLICT', line);
    if (!previous) {
      if (this.nodes.size >= LIMITS.nodes) throw new FlowchartError('LIMIT', line);
      this.nodes.set(key, { id: `n${this.nodes.size + 1}`, label: text, kind, line });
    }
    return key;
  }

  ref(key: string, line: number): string {
    this.references.push({ key, line });
    return key;
  }

  edge(from: string, to: string, value: string, line: number): void {
    const text = value ? label(value, line) : '';
    if (this.edges.some(e => e.from === from && e.to === to && e.label === text)) return;
    if (this.edges.length >= LIMITS.edges) throw new FlowchartError('LIMIT', line);
    this.ref(from, line); this.ref(to, line);
    this.edges.push({ from, to, label: text, line });
  }

  finish(): FlowGraph {
    for (const reference of this.references) if (!this.nodes.has(reference.key)) throw new FlowchartError('UNKNOWN_NODE', reference.line);
    if (!this.nodes.size) throw new FlowchartError('EMPTY');
    const nodes = [...this.nodes.values()];
    const edges = this.edges.map(e => ({ ...e, from: this.nodes.get(e.from)!.id, to: this.nodes.get(e.to)!.id }));
    const starts = nodes.filter(n => n.kind === 'terminal' && START_LABEL.test(n.label));
    const seen = new Set<string>();
    const pending = starts.map(n => n.id);
    while (pending.length) {
      const id = pending.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      pending.push(...edges.filter(e => e.from === id).map(e => e.to));
    }
    const warnings: Warning[] = [];
    if (!starts.length) warnings.push({ code: 'NO_START', line: nodes[0]!.line, label: '' });
    for (const node of nodes) {
      const out = edges.filter(e => e.from === node.id);
      if (starts.length && !seen.has(node.id)) warnings.push({ code: 'UNREACHABLE', line: node.line, label: node.label });
      if (node.kind === 'decision' && (out.length !== 2 || out.some(e => !e.label) || new Set(out.map(e => e.label)).size !== 2)) warnings.push({ code: 'DECISION_BRANCHES', line: node.line, label: node.label });
      if (node.kind !== 'terminal' && !out.length) warnings.push({ code: 'DEAD_END', line: node.line, label: node.label });
    }
    return { direction: this.direction, nodes, edges, warnings };
  }
}
