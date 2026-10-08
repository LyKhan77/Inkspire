import { describe, expect, it } from 'vitest';
import { parseMermaid, serializeMermaid } from '../src/features/flowchart/mermaid';
import { parseText, EXAMPLE } from '../src/features/flowchart/text';
import { LIMITS } from '../src/features/flowchart/model';
import { assertOutput, normalizeLinearElements } from '../src/features/flowchart/convert';

describe('mermaid subset roundtrip', () => {
  it('roundtrips graph semantics and accepts inline shape declarations', () => {
    const original = parseText(EXAMPLE, 'TD');
    const restored = parseMermaid(serializeMermaid(original));
    expect(restored.nodes.map(n => [n.label, n.kind])).toEqual(original.nodes.map(n => [n.label, n.kind]));
    expect(restored.edges.map(e => [e.from, e.to, e.label])).toEqual(original.edges.map(e => [e.from, e.to, e.label]));
    expect(parseMermaid('flowchart LR\nA([Start]) --> B{Valid?}\nB -->|Yes| C[Save]\nB -->|No| A').nodes).toHaveLength(3);
  });
  it('accepts bare graph header, TB normalisation and CRLF', () => {
    expect(parseMermaid('graph TB\r\nA([Start]) --> B[Work]').direction).toBe('TD');
    expect(parseMermaid('flowchart LR\r\nA([Start])').direction).toBe('LR');
  });
  it('survives arrows, brackets and pipes inside quoted labels', () => {
    const source = 'flowchart TD\nA["Yes -> No"] --> B["x#91;y#124;z#40;w"]\nB --> C{"? #35; #38;"}';
    const g = parseMermaid(source);
    expect(g.nodes.map(n => n.label)).toEqual(['Yes -> No', 'x[y|z(w', '? # &']);
    expect(parseMermaid(serializeMermaid(g)).nodes.map(n => n.label)).toEqual(['Yes -> No', 'x[y|z(w', '? # &']);
  });
  it('keeps semicolons only as unsupported separators', () => {
    expect(() => parseMermaid('flowchart TD\nA[One] --> B[Two];')).toThrow('MERMAID_SYNTAX');
    expect(parseMermaid('flowchart TD\nA["a;b"]').nodes[0]!.label).toBe('a;b');
  });
});

describe('mermaid token validation', () => {
  it.each([
    ['adjacent quoted declarations', 'flowchart TD\nA["One"] B["Two"]'],
    ['adjacent unquoted declarations', 'flowchart TD\nA[One] B[Two]'],
    ['two quoted labels in one wrapper', 'flowchart TD\nA["one" "two"]'],
    ['trailing closing bracket', 'flowchart TD\nA[One]]'],
    ['mismatched wrapper', 'flowchart TD\nA[One})'],
    ['declaration followed by a statement', 'flowchart TD\nA{One?} extra'],
    ['declaration followed by punctuation', 'flowchart TD\nA["One"] B["Two"],'],
  ])('rejects a token that is not exactly one declaration: %s', (_name, input) => {
    expect(() => parseMermaid(input)).toThrow('MERMAID_SYNTAX');
  });
  it('reports the offending line for a combined declaration', () => {
    try { parseMermaid('flowchart TD\nA([Start])\nA["One"] B["Two"]'); throw new Error('Expected rejection'); }
    catch (error) { expect(error).toMatchObject({ code: 'MERMAID_SYNTAX', line: 3 }); }
  });
  it('keeps valid declarations that carry entities, brackets and arrows inside one quoted label', () => {
    expect(parseMermaid('flowchart TD\nA["One #quot;two#quot; three"]').nodes[0]!.label).toBe('One "two" three');
    expect(parseMermaid('flowchart TD\nA["a]b"]').nodes[0]!.label).toBe('a]b');
    expect(parseMermaid('flowchart TD\nA["Yes -> No"] --> B["x#91;y"]').nodes.map(n => n.label)).toEqual(['Yes -> No', 'x[y']);
    const pair = parseMermaid('flowchart TD\nA["One"] --> B["Two"]');
    expect(pair.nodes).toHaveLength(2);
    expect(pair.edges).toHaveLength(1);
  });
  it('roundtrips a bracket-heavy label without turning it into two declarations', () => {
    const source = parseMermaid('flowchart TD\nA["a#91;b#93; #40;c#41;"]');
    expect(serializeMermaid(source)).toBe('flowchart TD\nn1["a#91;b#93; #40;c#41;"]');
    expect(parseMermaid(serializeMermaid(source)).nodes[0]!.label).toBe('a[b] (c)');
  });
});

describe('mermaid rejection', () => {
  it.each([
    'sequenceDiagram\nA->>B: hi',
    '---\nconfig: {}\n---\nflowchart TD',
    'flowchart TD\nclick A "https://example.com"',
    'flowchart TD\n%%{init: {}}%%',
    'flowchart TD\nA[One]; B[Two]',
    'flowchart TD\nA@{ shape: image }',
    'flowchart TD\nsubgraph one\nA[One]\nend',
    'flowchart TD\nA[One]:::className',
    'flowchart TD\nstyle A fill:#f9f',
    'flowchart TD\nA -- B',
    'graph RL\nA[One]',
    'flowchart TD\nA[[One]]',
    '1bad[One]',
    'flowchart TD\nA[One] --> ',
    '',
    '   ',
  ])('rejects unsupported or malformed input: %j', input => {
    expect(() => parseMermaid(input)).toThrow();
  });
  it('rejects redefinition with a different label or shape', () => {
    expect(() => parseMermaid('flowchart TD\nA[One]\nA[Two]')).toThrow('CONFLICT');
    expect(() => parseMermaid('flowchart TD\nA[One]\nA{One?}')).toThrow('CONFLICT');
  });
  it('encodes label punctuation, rejects HTML and rejects undeclared references', () => {
    const g = parseMermaid('flowchart TD\nA["x #60; 5 #quot;ok#quot;"]');
    expect(g.nodes[0]!.label).toBe('x < 5 "ok"');
    expect(serializeMermaid(g)).toContain('#60;');
    expect(() => parseMermaid('flowchart TD\nA["#60;img src=x#62;"]')).toThrow('LABEL');
    expect(() => parseMermaid('flowchart TD\nA --> B')).toThrow('UNKNOWN_NODE');
  });
  it('rejects control, surrogate and out-of-range numeric entities', () => {
    expect(() => parseMermaid('flowchart TD\nA["#7;bell"]')).toThrow('LABEL');
    expect(() => parseMermaid('flowchart TD\nA["#55357;"]')).toThrow('LABEL');
    expect(() => parseMermaid('flowchart TD\nA["#1114112;"]')).toThrow('LABEL');
  });
  it('enforces the canonical output size limit', () => {
    const nodes = Array.from({ length: 700 }, (_, i) => ({ id: `n${i + 1}`, label: 'x'.repeat(120), kind: 'process' as const, line: i + 1 }));
    expect(() => serializeMermaid({ direction: 'TD', nodes, edges: [], warnings: [] })).toThrow('LIMIT');
    const bounded = parseMermaid('flowchart TD\nA([Start]) --> B[Work]');
    expect(serializeMermaid(bounded)).toBe('flowchart TD\nn1(["Start"])\nn2["Work"]\nn1 --> n2');
    expect(LIMITS.canonical).toBe(64000);
  });
});

describe('converter output boundary', () => {
  it('rejects image fallback and executable/linkable output', () => {
    expect(() => assertOutput({ elements: [{ type: 'image' }] })).toThrow('UNSUPPORTED_OUTPUT');
    expect(() => assertOutput({ elements: [{ type: 'rectangle', link: 'https://example.com' }] })).toThrow('UNSUPPORTED_OUTPUT');
    expect(() => assertOutput({ elements: [{ type: 'rectangle', x: Infinity }] }, true)).toThrow('UNSUPPORTED_OUTPUT');
    expect(() => assertOutput({ elements: [{ type: 'rectangle' }], files: { asset: {} } })).toThrow('UNSUPPORTED_OUTPUT');
  });
  it('rejects empty, oversized and malformed element arrays', () => {
    expect(() => assertOutput({ elements: [] })).toThrow('UNSUPPORTED_OUTPUT');
    expect(() => assertOutput({ elements: Array.from({ length: LIMITS.elements + 1 }, () => ({ type: 'rectangle' })) })).toThrow('UNSUPPORTED_OUTPUT');
    expect(() => assertOutput({ elements: [null] })).toThrow('UNSUPPORTED_OUTPUT');
    expect(() => assertOutput({ elements: ['frame'] })).toThrow('UNSUPPORTED_OUTPUT');
    expect(() => assertOutput({ elements: [{ type: 'arrow', x: 0, y: 0, width: 2, height: 4, points: [[1, 2], [3, Number.NaN]] }] }, true)).toThrow('UNSUPPORTED_OUTPUT');
    expect(() => assertOutput({ elements: [{ type: 'arrow', x: 0, y: 0, width: 2, height: 4, points: [[1, 2, 3]] }] }, true)).toThrow('UNSUPPORTED_OUTPUT');
    expect(() => assertOutput({ elements: [{ type: 'text', x: 0, y: 0, width: 10, height: 10 }] }, true)).not.toThrow();
  });
});

describe('linear element normalization', () => {
  type Linear = { id: string; type: string; x: number; y: number; width: number; height: number; points: [number, number][] };
  const arrow = (): Linear => ({ id: 'a', type: 'arrow', x: 100, y: 200, width: 0.5, height: 45.5, points: [[0, 0.5], [-0.5, 24.5], [-0.5, 45]] });

  it('re-anchors points to the local origin while keeping absolute coordinates', () => {
    const [normalized] = normalizeLinearElements([arrow() as never]) as never as [Linear];
    expect(normalized.points).toEqual([[0, 0], [-0.5, 24], [-0.5, 44.5]]);
    expect({ x: normalized.x, y: normalized.y }).toEqual({ x: 100, y: 200.5 });
    expect({ width: normalized.width, height: normalized.height }).toEqual({ width: 0.5, height: 44.5 });
    expect(() => assertOutput({ elements: [normalized] }, true)).not.toThrow();
  });
  it('leaves normalized linear and non-linear elements untouched', () => {
    const line = { id: 'b', type: 'line', x: 5, y: 6, width: 10, height: 10, points: [[0, 0], [10, 10]] };
    expect(normalizeLinearElements([line as never])).toEqual([line]);
    const box = { id: 'c', type: 'rectangle', x: 1, y: 2, width: 3, height: 4 };
    expect(normalizeLinearElements([box as never])).toEqual([box]);
  });
  it('rejects an unnormalized linear result instead of shipping the invariant break', () => {
    expect(() => assertOutput({ elements: [arrow()] }, true)).toThrow('UNSUPPORTED_OUTPUT');
  });
});
