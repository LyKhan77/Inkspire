import { FlowchartError, GraphBuilder, inputLines, label, normalize } from './model';
import type { Direction, FlowGraph } from './model';

export const EXAMPLE = 'Mulai\nTerima request\nJika input valid?:\n  Ya -> Simpan data -> Selesai\n  Tidak -> Tampilkan error -> Selesai';

const ARROW = /\s*(?:->|→)\s*/;
const BRANCH = /^(Ya|Yes|Tidak|No)\s*(?:->|→)\s*(.+)$/i;
const BRANCH_HEAD = /^(?:ya|yes|tidak|no)$/i;
const YES = /^(?:ya|yes)$/i;
const TERMINAL = /^(?:mulai|start|selesai|end)$/i;
const HEADER = /^(?:Jika|If)\s+(.+):\s*$/i;
const DANGLING = /^(?:Jika|If)\s/i;

export function parseText(input: string, direction: Direction): FlowGraph {
  const builder = new GraphBuilder(direction);
  let tail: string | null = null;
  let decision: { key: string; line: number; branches: Set<string> } | null = null;

  const closeDecision = () => {
    if (decision && decision.branches.size !== 2) throw new FlowchartError('BRANCHES', decision.line);
    decision = null;
  };

  const chain = (source: string, line: number, from: string | null, edgeLabel = ''): string => {
    const parts = source.split(ARROW);
    let previous = from;
    parts.forEach((raw, index) => {
      const token = raw.trim();
      if (!token) throw new FlowchartError('TEXT_SYNTAX', line);
      let key: string;
      if (token.startsWith('@')) {
        if (index !== parts.length - 1) throw new FlowchartError('TEXT_SYNTAX', line);
        key = builder.ref(label(token.slice(1), line), line);
      } else {
        const text = label(token, line);
        key = normalize(text);
        builder.node(key, text, TERMINAL.test(text) ? 'terminal' : 'process', line);
      }
      if (previous && (previous !== key || index > 0 || edgeLabel)) builder.edge(previous, key, index === 0 ? edgeLabel : '', line);
      previous = key;
    });
    return previous!;
  };

  for (const { text, line } of inputLines(input)) {
    if (text.includes('\t')) throw new FlowchartError('TEXT_SYNTAX', line);
    if (/^\s/u.test(text)) {
      if (!decision || !text.startsWith('  ') || /^\s/u.test(text.slice(2))) throw new FlowchartError('TEXT_SYNTAX', line);
      const block = decision;
      const branch = BRANCH.exec(text.slice(2));
      if (!branch) throw new FlowchartError('BRANCHES', line);
      const slot = YES.test(branch[1]!) ? 'yes' : 'no';
      if (block.branches.has(slot)) throw new FlowchartError('BRANCHES', line);
      block.branches.add(slot);
      chain(branch[2]!, line, block.key, branch[1]!);
      continue;
    }
    closeDecision();
    const header = HEADER.exec(text);
    if (header) {
      const condition = label(header[1]!, line);
      builder.node(condition, condition, 'decision', line);
      if (tail && tail !== condition) builder.edge(tail, condition, '', line);
      decision = { key: condition, line, branches: new Set() };
      tail = null;
      continue;
    }
    if (DANGLING.test(text)) throw new FlowchartError('TEXT_SYNTAX', line);
    if (BRANCH_HEAD.test(normalize(text.split(ARROW)[0]!.trim()))) throw new FlowchartError('BRANCHES', line);
    tail = chain(text, line, tail);
  }
  closeDecision();
  return builder.finish();
}
