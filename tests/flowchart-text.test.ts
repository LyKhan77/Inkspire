import { describe, expect, it } from 'vitest';
import { parseText, EXAMPLE } from '../src/features/flowchart/text';

describe('structured text grammar', () => {
  it('merges the explicit Selesai node and retains Yes/No labels', () => {
    const g = parseText(EXAMPLE, 'TD');
    expect(g.nodes.filter(n => n.label === 'Selesai')).toHaveLength(1);
    expect(g.nodes.filter(n => n.kind === 'decision')).toHaveLength(1);
    expect(g.edges.filter(e => e.label).map(e => e.label)).toEqual(['Ya', 'Tidak']);
    expect(g.warnings).toEqual([]);
  });
  it('allows a declared loop target and forward reference', () => {
    const g = parseText('Start -> Read\nIf valid?:\n  Yes -> @End\n  No -> @Read\nEnd', 'LR');
    const read = g.nodes.find(n => n.label === 'Read')!;
    expect(g.direction).toBe('LR');
    expect(g.edges.some(e => e.to === read.id && e.label === 'No')).toBe(true);
  });
  it('rejects an undefined reference, incomplete decision and duplicate branch', () => {
    expect(() => parseText('Start -> @Absent', 'TD')).toThrow('UNKNOWN_NODE');
    expect(() => parseText('Start\nIf valid?:\n  Yes -> End', 'TD')).toThrow('BRANCHES');
    expect(() => parseText('If valid?:\n  Yes -> End\n  Ya -> End', 'TD')).toThrow('BRANCHES');
  });
  it('reports the source line for indentation errors', () => {
    expect(() => parseText('Start\n    Wrong', 'TD')).toThrow('TEXT_SYNTAX');
    expect(() => parseText('Start\n\tWrong', 'TD')).toThrow('TEXT_SYNTAX');
  });
});

describe('structured text edge cases', () => {
  it('accepts the unicode arrow and trims chain spacing', () => {
    const g = parseText('Mulai → Terima request → Selesai', 'TD');
    expect(g.nodes.map(n => n.label)).toEqual(['Mulai', 'Terima request', 'Selesai']);
    expect(g.edges).toHaveLength(2);
    expect(g.warnings).toEqual([]);
  });
  it('chains consecutive unindented steps and starts a fresh chain per block', () => {
    const g = parseText('Mulai\nStep one\nJika a?:\n  Ya -> Selesai\n  Tidak -> Selesai\nAnother', 'TD');
    expect(g.edges.map(e => `${e.from}->${e.to}`)).toEqual(['n1->n2', 'n2->n3', 'n3->n4', 'n3->n4']);
    expect(g.nodes.map(n => n.label)).toEqual(['Mulai', 'Step one', 'a?', 'Selesai', 'Another']);
    expect(g.warnings.map(w => w.code)).toContain('DEAD_END');
  });
  it('rejects blank tokens, branch-only input and a reference inside a chain', () => {
    expect(() => parseText('Start -> -> End', 'TD')).toThrow('TEXT_SYNTAX');
    expect(() => parseText('  Yes -> End', 'TD')).toThrow('TEXT_SYNTAX');
    expect(() => parseText('Start -> @Mid -> End\nMid', 'TD')).toThrow('TEXT_SYNTAX');
    expect(() => parseText('Jika without colon', 'TD')).toThrow('TEXT_SYNTAX');
  });
  it('merges labels that are equivalent after unicode normalisation', () => {
    const g = parseText('Mulai → café → Selesai\nSelesai → cafe\u0301', 'TD');
    expect(g.nodes.map(n => n.label)).toEqual(['Mulai', 'café', 'Selesai']);
    expect(g.edges).toHaveLength(3);
  });
  it('rejects reusing a label with a conflicting node kind', () => {
    expect(() => parseText('Start -> Check?\nJika Check?:\n  Yes -> End\n  No -> End', 'TD')).toThrow('CONFLICT');
  });
  it('keeps Indonesian and English terminals distinct and requires a decision per branch', () => {
    const g = parseText('Mulai -> Start', 'TD');
    expect(g.nodes.map(n => n.label)).toEqual(['Mulai', 'Start']);
    expect(g.nodes.every(n => n.kind === 'terminal')).toBe(true);
    expect(() => parseText('Mulai -> Selesai\nYa -> Orphan', 'TD')).toThrow('BRANCHES');
  });
  it('links separate decision blocks through a labelled reference', () => {
    const g = parseText('Mulai -> Ambil request\nJika request valid?:\n  Ya -> Simpan data -> Selesai\n  Tidak -> Tampilkan error -> @Ambil request', 'TD');
    const ambil = g.nodes.find(n => n.label === 'Ambil request')!;
    expect(g.edges.filter(e => e.to === ambil.id)).toHaveLength(2);
    expect(g.warnings).toEqual([]);
  });
});
