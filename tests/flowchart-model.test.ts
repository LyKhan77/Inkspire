import { describe, expect, it } from 'vitest';
import { GraphBuilder, FlowchartError, inputLines, label, normalize } from '../src/features/flowchart/model';

describe('flowchart graph boundary', () => {
  it('reports line of undefined forward reference', () => {
    const b = new GraphBuilder('TD');
    b.node('a', 'Mulai', 'terminal', 1); b.edge('a', 'missing', '', 4);
    try { b.finish(); throw new Error('Expected rejection'); }
    catch (e) { expect(e).toBeInstanceOf(FlowchartError); expect(e).toMatchObject({ code: 'UNKNOWN_NODE', line: 4 }); }
  });
  it('rejects a declaration changing the meaning of an existing node', () => {
    const b = new GraphBuilder('TD'); b.node('a', 'Proses', 'process', 1);
    expect(() => b.node('a', 'Kondisi?', 'decision', 2)).toThrow(FlowchartError);
  });
  it('enforces node and label limits', () => {
    const b = new GraphBuilder('TD');
    for (let i = 0; i < 50; i++) b.node(String(i), String(i), 'process', i + 1);
    expect(() => b.node('extra', 'Extra', 'process', 51)).toThrow(FlowchartError);
    expect(() => new GraphBuilder('TD').node('a', 'x'.repeat(121), 'process', 1)).toThrow(FlowchartError);
  });
  it('allows cycles and flags structurally missing outgoing branches', () => {
    const b = new GraphBuilder('LR');
    b.node('s', 'Start', 'terminal', 1); b.node('p', 'Process', 'process', 2);
    b.node('d', 'Valid?', 'decision', 3); b.node('orphan', 'Orphan', 'process', 4);
    b.edge('s', 'p', '', 2); b.edge('p', 'd', '', 3); b.edge('d', 'p', 'No', 4);
    const g = b.finish();
    expect(g.warnings.map(w => w.code)).toContain('UNREACHABLE');
    expect(g.warnings.map(w => w.code)).toContain('DECISION_BRANCHES');
    expect(g.edges).toHaveLength(3);
  });
});

describe('flowchart input boundary', () => {
  it('enforces the edge limit and dedupes identical edges', () => {
    const b = new GraphBuilder('TD');
    b.node('a', 'Start', 'terminal', 1);
    for (let i = 0; i < 48; i++) b.node(`t${i}`, `T${i}`, 'process', i + 2);
    for (let i = 0; i < 100; i++) b.edge('a', `t${i % 48}`, `L${i}`, 2);
    b.edge('a', 't0', 'L0', 2);
    expect(b.finish().edges).toHaveLength(100);
    expect(() => b.edge('a', 't0', 'overflow', 2)).toThrow('LIMIT');
  });
  it('rejects empty input and oversized input or lines', () => {
    expect(() => inputLines('   \n  ')).toThrow('EMPTY');
    expect(() => inputLines('x'.repeat(8001))).toThrow('LIMIT');
    expect(() => inputLines(Array.from({ length: 201 }, (_, i) => `S${i}`).join('\n'))).toThrow('LIMIT');
    expect(inputLines('a\r\nb\rc\nd')).toEqual([
      { text: 'a', line: 1 }, { text: 'b', line: 2 }, { text: 'c', line: 3 }, { text: 'd', line: 4 },
    ]);
  });
  it('rejects labels with active formatting and merges Unicode-equivalent labels', () => {
    expect(() => label('<b>x</b>', 1)).toThrow('LABEL');
    expect(() => label('x'.repeat(121), 1)).toThrow('LABEL');
    expect(normalize('de\u0301ja  vu')).toBe(normalize('d\u00e9ja vu'));
    const b = new GraphBuilder('TD');
    b.node(normalize('cafe\u0301'), 'café', 'process', 1);
    expect(() => b.node(normalize('café'), 'café', 'process', 2)).not.toThrow();
    expect(b.finish().nodes).toHaveLength(1);
  });
  it('warns when no start terminal exists and still links edges by stable ids', () => {
    const b = new GraphBuilder('TD');
    b.node('a', 'Alpha', 'process', 1); b.node('z', 'Zulu', 'process', 2);
    b.edge('a', 'z', '', 2);
    const g = b.finish();
    expect(g.warnings.map(w => w.code)).toContain('NO_START');
    expect(g.warnings.map(w => w.code)).not.toContain('UNREACHABLE');
    expect(g.edges).toEqual([{ from: 'n1', to: 'n2', label: '', line: 2 }]);
  });
});
