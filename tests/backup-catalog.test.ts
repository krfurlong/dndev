import { describe, it, expect } from 'vitest';
import { catalog, books } from '../src/data/catalog';
import { exampleCharacters } from '../src/data/fixtures';
import audit from '../src/data/catalog-audit.json';
import { makeBackup, parseBackup, duplicateBackup } from '../src/storage/backup';
import { validateCharacter, ContentEntrySchema } from '../src/domain/model';
describe('reviewed catalog', () => {
  it('validates every record, ID and dependency', () => {
    const ids = new Set(catalog.map((e) => e.id));
    expect(ids.size).toBe(catalog.length);
    for (const e of catalog) {
      expect(ContentEntrySchema.safeParse(e).success, e.id).toBe(true);
      for (const id of e.sourceIds)
        expect(
          books.some((b) => b.id === id),
          e.id + ' ' + id,
        ).toBe(true);
      for (const dependency of e.dependencies)
        expect(ids.has(dependency), e.id + ' -> ' + dependency).toBe(true);
    }
  });
  it('includes published third-party books even when the wiki says HB', () => {
    expect(
      catalog.some((e) => e.name === 'Cruel' && e.sourceIds.some((s) => s.startsWith('taldorei'))),
    ).toBe(true);
    expect(catalog.some((e) => e.sourceIds.includes('exploring-eberron'))).toBe(true);
    expect(catalog.some((e) => e.sourceIds.includes('dread-metrol'))).toBe(true);
  });
  it('excludes playtest and unresolved web-only options', () => {
    expect(catalog.some((e) => /\bUA\b|Unearthed Arcana|playtest/i.test(e.name))).toBe(false);
    expect(audit.excluded.some((e) => /Playtest/.test(e.reason))).toBe(true);
    expect(catalog.some((e) => e.name === 'Gunslinger')).toBe(false);
  });
  it('consolidates identical spell reprints without losing Artificer lists or PHB provenance', () => {
    const entries = catalog.filter((e) => e.name === 'Cure Wounds' && e.category === 'spell');
    expect(entries).toHaveLength(1);
    expect(entries[0].classIds).toContain('artificer');
    expect(entries[0].sourceIds).toContain('phb');
    expect(entries[0].provenance.some((p) => p.bookId === 'phb')).toBe(true);
  });
  it('includes published infusion and invocation choices as features', () => {
    expect(
      catalog.some(
        (e) =>
          e.name === 'Replicate Magic Item' &&
          e.category === 'feature' &&
          e.sourceIds.includes('tce'),
      ),
    ).toBe(true);
    expect(
      catalog.some(
        (e) => e.category === 'subclass' && /invocations|infusions|maneuvers/i.test(e.name),
      ),
    ).toBe(false);
  });
  it('keeps differing versions and attributes non-SRD references without reproduced prose', () => {
    expect(
      catalog.filter((e) => e.category === 'race' && e.name === 'Aarakocra').length,
    ).toBeGreaterThan(1);
    expect(catalog.filter((e) => e.license === 'reference').every((e) => !e.description)).toBe(
      true,
    );
    expect(catalog.filter((e) => e.license === 'CC-BY-4.0').length).toBeGreaterThan(300);
  });
});
describe('portable backups', () => {
  it('round-trips all six synthetic journeys and creates new IDs', () => {
    const chars = exampleCharacters();
    expect(chars).toHaveLength(6);
    chars.forEach(validateCharacter);
    const b = makeBackup(chars),
      parsed = parseBackup(JSON.stringify(b)),
      copies = duplicateBackup(parsed);
    expect(parsed.characters).toEqual(chars);
    expect(copies.characters.every((c) => !chars.some((old) => old.id === c.id))).toBe(true);
    expect(copies.characters.map((c) => c.resources)).toEqual(chars.map((c) => c.resources));
  });
  it('strips envelope and character credentials on export/import', () => {
    const c = exampleCharacters()[0],
      backup = makeBackup([{ ...c, campaign: 'secret', token: 'token' } as typeof c]);
    const out = JSON.stringify(backup);
    expect(out).not.toContain('secret');
    expect(out).not.toContain('token');
    const text = JSON.stringify({ ...backup, invitation: 'secret' });
    expect(JSON.stringify(parseBackup(text))).not.toContain('secret');
  });
  it('rejects malformed, huge, unsupported and executable-image backups', () => {
    const b = makeBackup(exampleCharacters());
    expect(() => parseBackup('no json')).toThrow();
    expect(() => parseBackup(JSON.stringify({ ...b, schemaVersion: 999 }))).toThrow();
    expect(() => parseBackup('x'.repeat(21 * 1024 * 1024))).toThrow();
    expect(() =>
      parseBackup(
        JSON.stringify({
          ...b,
          assets: [
            {
              id: 'image',
              characterId: b.characters[0].id,
              kind: 'portrait',
              dataUrl: 'data:image/svg+xml;base64,YQ==',
            },
          ],
        }),
      ),
    ).toThrow();
  });
  it('rejects duplicate IDs, inconsistent collection IDs, and missing backup images', () => {
    const c = exampleCharacters()[0];
    const b = makeBackup([c]);
    expect(() => parseBackup(JSON.stringify({ ...b, characters: [c, c] }))).toThrow(/duplicate/i);
    c.portraitId = 'missing';
    expect(() => parseBackup(JSON.stringify({ ...b, characters: [c] }))).toThrow(/missing/i);
    const item = Object.values(exampleCharacters()[3].items)[0];
    const malformed = { ...c, portraitId: '', items: { 'wrong-key': item } };
    expect(() => validateCharacter(malformed)).toThrow();
  });
  it('preserves archives, custom progression, and image ownership on duplicate', () => {
    const c = exampleCharacters()[5];
    c.archived = true;
    c.portraitId = 'asset';
    const b = makeBackup(
      [c],
      [{ id: 'asset', characterId: c.id, kind: 'portrait', dataUrl: 'data:image/png;base64,YQ==' }],
    );
    const next = duplicateBackup(b);
    expect(next.characters[0].archived).toBe(true);
    expect(next.assets[0].id).toBe(next.characters[0].portraitId);
    expect(next.assets[0].characterId).toBe(next.characters[0].id);
  });
});
