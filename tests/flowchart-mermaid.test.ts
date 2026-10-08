import { describe, expect, it } from 'vitest';
import { parseMermaid, serializeMermaid } from '../src/features/flowchart/mermaid';
import { parseText, EXAMPLE } from '../src/features/flowchart/text';
import { LIMITS } from '../src/features/flowchart/model';

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
