import { FlowchartError, GraphBuilder, inputLines, label, LIMITS } from './model';
import type { FlowGraph, Kind } from './model';

const ENTITY = /#(quot|\d+);/g;
const ESCAPABLE = /[&"#;<>\[\]{}|()`\\]/gu;
const ID_WITH_TAIL = /^([A-Za-z][A-Za-z0-9_]*)([\s\S]*)$/;
const HEADER = /^(?:flowchart|graph)\s+(TD|TB|LR)$/i;
const OPENERS = '[{(';
const CLOSERS: Record<string, string> = { ']': '[', '}': '{', ')': '(' };

function decode(value: string, line: number): string {
  return label(value.replace(ENTITY, (_, entity: string) => {
    if (entity === 'quot') return '"';
    const code = Number(entity);
    if (!Number.isInteger(code) || code < 32 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) throw new FlowchartError('LABEL', line);
    return String.fromCodePoint(code);
  }), line);
}

function escape(value: string): string {
  return value.replace(ESCAPABLE, character => `#${character.codePointAt(0)};`);
}

/** Top-level chain scan: arrows inside quoted labels or nested shapes are data, not separators. */
function splitChain(source: string, line: number): { tokens: string[]; labels: string[] } {
  const tokens: string[] = [];
  const labels: string[] = [];
  const stack: string[] = [];
  let quoted = false;
  let start = 0;
  for (let i = 0; i < source.length; i++) {
    const character = source[i]!;
    if (character === '"') { quoted = !quoted; continue; }
    if (quoted) continue;
    if (OPENERS.includes(character)) { stack.push(character); continue; }
    if (character in CLOSERS) { if (stack.pop() !== CLOSERS[character]) throw new FlowchartError('MERMAID_SYNTAX', line); continue; }
    if (stack.length) continue;
    if (character === ';') throw new FlowchartError('MERMAID_SYNTAX', line);
    if (source.slice(i, i + 3) !== '-->') continue;
    tokens.push(source.slice(start, i).trim());
    i += 3;
    while (source[i] === ' ') i++;
    let edgeLabel = '';
    if (source[i] === '|') {
      const end = source.indexOf('|', i + 1);
      if (end === -1) throw new FlowchartError('MERMAID_SYNTAX', line);
      edgeLabel = decode(source.slice(i + 1, end), line);
      i = end + 1;
    }
    labels.push(edgeLabel);
    start = i;
    i--;
  }
  if (quoted || stack.length) throw new FlowchartError('MERMAID_SYNTAX', line);
  tokens.push(source.slice(start).trim());
  if (tokens.some(token => !token)) throw new FlowchartError('MERMAID_SYNTAX', line);
  return { tokens, labels };
}

function readToken(source: string, line: number, builder: GraphBuilder): string {
  const match = ID_WITH_TAIL.exec(source.trim());
  if (!match) throw new FlowchartError('MERMAID_SYNTAX', line);
  const id = match[1]!;
  const tail = match[2]!.trim();
  if (!tail) return builder.ref(id, line);
  let kind: Kind;
  let value: string;
  if (tail.startsWith('([') && tail.endsWith('])')) { kind = 'terminal'; value = tail.slice(2, -2); }
  else if (tail.startsWith('[') && tail.endsWith(']')) { kind = 'process'; value = tail.slice(1, -1); }
  else if (tail.startsWith('{') && tail.endsWith('}')) { kind = 'decision'; value = tail.slice(1, -1); }
  else if (tail.startsWith('(') && tail.endsWith(')')) { kind = 'terminal'; value = tail.slice(1, -1); }
  else throw new FlowchartError('MERMAID_SYNTAX', line);
  if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
  else if (value.includes('"') || /[\[\]{}()]/u.test(value)) throw new FlowchartError('MERMAID_SYNTAX', line);
  return builder.node(id, decode(value, line), kind, line);
}

export function parseMermaid(input: string): FlowGraph {
  const rows = inputLines(input);
  const first = rows.shift()!;
  const header = HEADER.exec(first.text.trim());
  if (!header) throw new FlowchartError('MERMAID_SYNTAX', first.line);
  const builder = new GraphBuilder(header[1]!.toUpperCase() === 'LR' ? 'LR' : 'TD');
  for (const row of rows) {
    const parts = splitChain(row.text.trim(), row.line);
    const keys = parts.tokens.map(value => readToken(value, row.line, builder));
    for (let index = 0; index < keys.length - 1; index++) builder.edge(keys[index]!, keys[index + 1]!, parts.labels[index]!, row.line);
  }
  return builder.finish();
}

export function serializeMermaid(graph: FlowGraph): string {
  const lines = [`flowchart ${graph.direction}`];
  for (const node of graph.nodes) {
    const value = `"${escape(node.label)}"`;
    const shape = node.kind === 'terminal' ? `([${value}])` : node.kind === 'decision' ? `{${value}}` : `[${value}]`;
    lines.push(`${node.id}${shape}`);
  }
  for (const edge of graph.edges) lines.push(`${edge.from} -->${edge.label ? `|${escape(edge.label)}|` : ''} ${edge.to}`);
  const source = lines.join('\n');
  if (source.length > LIMITS.canonical) throw new FlowchartError('LIMIT');
  return source;
}
