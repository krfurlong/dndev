import { mergeCharacter } from '../src/storage/remote';
import { describe, it, expect } from 'vitest';
import { CharacterSchema, newCharacter, newResource, SpellCombatSchema } from '../src/domain/model';
import { catalog, equipmentItem, toCharacterSpell } from '../src/data/catalog';
import { addLevel, applyContent, applyRest, restPreview, rollDice } from '../src/domain/rules';
import { syncGrantedSpells } from '../src/domain/progression';
import {
  castingOptions,
  castSpell,
  consumeItem,
  saveEditedRecord,
  spellReference,
  weaponReference,
} from '../src/domain/combat';
import { makeBackup, parseBackup, duplicateBackup } from '../src/storage/backup';
import { threeWayMerge } from '../src/domain/merge';

const spell = (name: string) =>
  toCharacterSpell(
    catalog.find((e) => e.category === 'spell' && e.name === name && e.id.startsWith('srd-'))!,
  );
function caster(level = 5) {
  let c = newCharacter('Reference tester');
  c.abilities = { str: 16, dex: 18, con: 12, int: 18, wis: 12, cha: 14 };
  for (let i = 0; i < level; i++) c = addLevel(c, 'wizard');
  return c;
}
describe('table combat references', () => {
  it('uses STR for longswords, finesse for rapiers/daggers, DEX for bows, and no proficiency in damage', () => {
    const c = caster();
    expect(weaponReference(c, equipmentItem('longsword'))).toEqual([
      '1d8+3 slashing',
      '1d10+3 slashing (two hands)',
    ]);
    expect(weaponReference(c, equipmentItem('rapier'))).toEqual(['1d8+4 piercing']);
    expect(weaponReference(c, equipmentItem('dagger'))).toEqual(['1d4+4 piercing']);
    expect(weaponReference(c, equipmentItem('handaxe'))).toEqual(['1d6+3 slashing']);
    expect(weaponReference(c, equipmentItem('longbow'))).toEqual(['1d8+4 piercing']);
    c.abilities.str = 8;
    expect(weaponReference(c, equipmentItem('longsword'))[0]).toBe('1d8-1 slashing');
  });
  it('honors ability, flat bonus, and text overrides without interpreting arbitrary expressions', () => {
    const c = caster(),
      item = equipmentItem('longsword');
    item.combat!.ability = 'cha';
    item.combat!.bonus = 2;
    expect(weaponReference(c, item)[0]).toBe('1d8+4 slashing');
    item.damage = '2d8 + 7 radiant (table ruling)';
    expect(weaponReference(c, item)).toEqual([item.damage]);
  });
  it('separates spell saves from casting abilities and scales only supported formulas', () => {
    const c = caster(),
      fireball = spell('Fireball');
    expect(spellReference(c, fireball)).toEqual(['DC 15 · DEX save', 'Damage: 8d6 fire']);
    expect(spellReference(c, fireball, 5)).toContain('Damage: 10d6 fire');
    fireball.castingAbility = 'wis';
    expect(spellReference(c, fireball)[0]).toBe('DC 12 · DEX save');
    fireball.combat!.dcOverride = 18;
    expect(spellReference(c, fireball)[0]).toBe('DC 18 · DEX save');
    const hold = spell('Hold Person');
    expect(spellReference(c, hold)).toEqual(['DC 15 · WIS save']);
  });
  it('scales cantrips by total multiclass level and distinguishes individual beams, rays and darts', () => {
    let c = caster(4);
    c = addLevel(c, 'fighter');
    expect(spellReference(c, spell('Fire Bolt'))).toContain('Damage: 2d10 fire');
    expect(spellReference(c, spell('Eldritch Blast'))).toContain(
      'Damage per beam: 1d10 force · 2 instances',
    );
    expect(spellReference(c, spell('Scorching Ray'), 4)).toContain(
      'Damage per ray: 2d6 fire · 5 instances',
    );
    expect(spellReference(c, spell('Magic Missile'), 2)).toContain(
      'Damage per dart: 1d4 + 1 force · 4 instances',
    );
  });
  it('adds a casting modifier only where specified, including negative modifiers and healing', () => {
    const c = caster(),
      cure = spell('Cure Wounds');
    expect(spellReference(c, cure, 2)).toContain('Healing: 2d8 + 4');
    c.abilities.int = 8;
    expect(spellReference(c, cure)).toContain('Healing: 1d8 - 1');
    expect(spellReference(c, spell('Fire Bolt'))).toContain('Damage: 2d10 fire');
  });
  it('leaves utility and unknown spells factual, while supporting manual effects', () => {
    const c = caster(),
      shield = spell('Shield');
    expect(spellReference(c, shield)).toEqual([]);
    const expanded = toCharacterSpell(
      catalog.find((e) => e.category === 'spell' && e.name === 'Toll the Dead')!,
    );
    expect(expanded.combat).toBeNull();
    expanded.combat = SpellCombatSchema.parse({
      save: 'wis',
      effects: [{ label: 'Damage', formula: '2d8 (2d12 if wounded)', type: 'necrotic' }],
    });
    expect(spellReference(c, expanded)).toEqual([
      'DC 15 · WIS save',
      'Damage: 2d8 (2d12 if wounded) necrotic',
    ]);
  });
});
describe('shared combat actions and durable favorites', () => {
  it('casts through current slots, Pact slots, free uses, resources and rituals without negatives', () => {
    let c = caster(3);
    c = addLevel(c, 'warlock');
    c = addLevel(c, 'warlock');
    c = addLevel(c, 'warlock');
    const s = spell('Misty Step');
    c.spells[s.id] = s;
    s.favorite = true;
    expect(castingOptions(c, s).find((o) => o.value === 'pact')?.level).toBe(2);
    castSpell(c, s.id, 'pact');
    expect(c.pactUsed).toBe(1);
    castSpell(c, s.id, '2');
    expect(c.slotsUsed[1]).toBe(1);
    s.freeUses = 1;
    castSpell(c, s.id, 'free');
    expect(() => castSpell(c, s.id, 'free')).toThrow();
    expect(s.freeUses).toBe(0);
    const r = newResource('Focus');
    r.current = 2;
    c.resources[r.id] = r;
    s.resourceId = r.id;
    s.resourceCost = 2;
    castSpell(c, s.id, 'resource');
    expect(r.current).toBe(0);
    expect(() => castSpell(c, s.id, 'resource')).toThrow();
    expect(() => castSpell(c, s.id, 'cantrip')).toThrow();
    s.ritual = true;
    s.concentration = true;
    castSpell(c, s.id, 'ritual');
    expect(c.combat.concentration).toBe(s.name);
    expect(s.favorite).toBe(true);
  });
  it('guards stale consumption requests and retains empty favorites', () => {
    const c = caster(),
      i = equipmentItem('dagger');
    i.favorite = true;
    i.charges = 1;
    i.maxCharges = 1;
    c.items[i.id] = i;
    consumeItem(c, i.id, 'charges');
    expect(i.charges).toBe(0);
    expect(() => consumeItem(c, i.id, 'charges')).toThrow();
    consumeItem(c, i.id, 'quantity');
    expect(i.quantity).toBe(0);
    expect(i.favorite).toBe(true);
    expect(() => consumeItem(c, i.id, 'quantity')).toThrow();
    delete c.items[i.id];
    expect(() => consumeItem(c, i.id, 'quantity')).toThrow();
  });
  it('merges stars independently from quantities and preserves overlapping combat edits for resolution', () => {
    const base = equipmentItem('longsword'),
      local = structuredClone(base),
      remote = structuredClone(base);
    local.favorite = true;
    remote.quantity = 3;
    expect(saveEditedRecord(base, local, remote)).toMatchObject({ favorite: true, quantity: 3 });
    local.combat!.bonus = 1;
    remote.combat!.bonus = 2;
    expect(threeWayMerge(base, local, remote).conflicts[0].path).toEqual(['combat', 'bonus']);
    expect(() => saveEditedRecord(base, local, remote)).toThrow(/another device/);
    expect(() => saveEditedRecord(base, local, undefined)).toThrow(/no longer available/);
  });
  it('reads older sheets without favorites or combat profiles and preserves legacy notes/text', () => {
    const c = caster(),
      i = equipmentItem('longsword'),
      s = spell('Fire Bolt');
    i.damage = 'Original custom damage';
    c.items[i.id] = i;
    c.spells[s.id] = s;
    c.attacks = 'My original moves';
    c.biography.sessions = 'Session notes';
    const old = JSON.parse(JSON.stringify(c));
    delete old.items[i.id].favorite;
    delete old.items[i.id].combat;
    delete old.items[i.id].equipmentId;
    delete old.spells[s.id].favorite;
    delete old.spells[s.id].combat;
    const parsed = CharacterSchema.parse(old);
    expect(parsed.items[i.id]).toMatchObject({
      favorite: false,
      combat: null,
      damage: 'Original custom damage',
    });
    expect(parsed.spells[s.id]).toMatchObject({ favorite: false, combat: null });
    expect(parsed.attacks).toBe(c.attacks);
    expect(parsed.biography).toEqual(c.biography);
  });
  it('round-trips pinned overrides and separate same-name grants through backup, duplication, leveling and rests', () => {
    let c = caster(3);
    const feat = structuredClone(
      catalog.find((e) => e.category === 'feat' && e.name === 'Fey Touched')!,
    );
    feat.mechanics.grantedSpells = ['Fire Bolt'];
    feat.mechanics.spellcastingAbility = 'cha';
    c = syncGrantedSpells(applyContent(c, feat));
    const granted = Object.values(c.spells)[0];
    granted.favorite = true;
    granted.combat!.attackOverride = 9;
    const learned = spell('Fire Bolt');
    learned.favorite = true;
    c.spells[learned.id] = learned;
    const item = equipmentItem('longsword');
    item.favorite = true;
    c.items[item.id] = item;
    c = syncGrantedSpells(addLevel(c, 'wizard'));
    c = applyRest(c, restPreview(c, 'long'));
    const restored = duplicateBackup(parseBackup(JSON.stringify(makeBackup([c])))).characters[0];
    expect(restored.id).not.toBe(c.id);
    expect(restored.spells[granted.id]).toMatchObject({
      favorite: true,
      castingAbility: 'cha',
      combat: { attackOverride: 9 },
      contentId: granted.contentId,
    });
    expect(restored.spells[learned.id].castingAbility).toBe('int');
    expect(restored.items[item.id].favorite).toBe(true);
    restored.selections[feat.id].active = false;
    expect(syncGrantedSpells(restored).spells[granted.id]).toBeUndefined();
    expect(syncGrantedSpells(restored).spells[learned.id]).toBeDefined();
  });
  it('removes d20 simulation but preserves other rest dice and manual d20 recovery', () => {
    expect(() => rollDice('1d20+3')).toThrow(/table/);
    expect(rollDice('2d6', () => 0).total).toBe(2);
    const c = caster(),
      r = newResource('Table recovery');
    r.trigger = 'short';
    r.recovery = 'dice';
    r.amount = '1d20';
    r.current = 2;
    r.max = 30;
    c.resources[r.id] = r;
    const p = restPreview(c, 'short');
    expect(p.resources[r.id]).toBe(2);
    expect(p.notes.join(' ')).toMatch(/d20 at the table/);
    p.resources[r.id] = 15;
    expect(applyRest(c, p).resources[r.id].current).toBe(15);
  });
});

it('does not mistake newly supplied schema defaults for another player’s conflicting edit', () => {
  const c = caster(),
    i = equipmentItem('longsword');
  c.items[i.id] = i;
  const legacy = JSON.parse(JSON.stringify(c));
  delete legacy.items[i.id].favorite;
  delete legacy.items[i.id].combat;
  delete legacy.items[i.id].equipmentId;
  const local = CharacterSchema.parse(legacy),
    remote = CharacterSchema.parse(legacy);
  local.items[i.id].favorite = true;
  remote.currency.gp = 42;
  const merged = mergeCharacter(legacy, local, remote);
  expect(merged.conflicts).toEqual([]);
  expect(merged.character.items[i.id].favorite).toBe(true);
  expect(merged.character.currency.gp).toBe(42);
  const edited = structuredClone(local.items[i.id]);
  edited.combat = i.combat;
  expect(saveEditedRecord(legacy.items[i.id], edited, remote.items[i.id])).toMatchObject({
    favorite: true,
    combat: { dice: '1d8' },
  });
});
