import { describe, it, expect } from 'vitest';
import { newCharacter, newItem, newResource, uid, validateCharacter } from '../src/domain/model';
import {
  addLevel,
  spellSlots,
  pactSlots,
  multiclassWarnings,
  restPreview,
  applyRest,
  maxHp,
  damage,
  ac,
  scores,
  reconcileSelectionEffects,
  applyContent,
  rollDice,
} from '../src/domain/rules';
import {
  advance,
  applyChoices,
  attachProgression,
  upgradeContent,
  availableUpgrades,
  syncGrantedSpells,
} from '../src/domain/progression';
import { catalog, emptyMechanics } from '../src/data/catalog';
const level = (id: string, n: number) => {
  let c = newCharacter();
  c.abilities = { str: 16, dex: 16, con: 14, int: 16, wis: 16, cha: 16 };
  for (let i = 0; i < n; i++) c = addLevel(c, id);
  return c;
};
describe('2014 character progression', () => {
  it('supports direct entry at level 10 with valid HP and slots', () => {
    const c = level('wizard', 10);
    expect(maxHp(c)).toBe(62);
    expect(spellSlots(c)).toEqual([4, 3, 3, 3, 2, 0, 0, 0, 0]);
    expect(validateCharacter(c)).toEqual(c);
  });
  it('advances a fighter from 1 through 4 with subclass and ASI', () => {
    let c = level('fighter', 1);
    c = advance(c, 'fighter', 6);
    const champion = catalog.find((e) => e.category === 'subclass' && /champion/i.test(e.name))!;
    c = advance(c, 'fighter', 6, { subclassId: champion.id });
    c = advance(c, 'fighter', 6, { abilityIncreases: { str: 2 } });
    expect(scores(c).str).toBe(18);
    expect(maxHp(c)).toBe(36);
    expect(Object.values(c.selections).some((s) => s.name === 'Improved Critical')).toBe(true);
    expect(c.levelHistory).toHaveLength(4);
  });
  it('offers feat instead of ASI and enforces point count', () => {
    let c = level('fighter', 3);
    const feat = catalog.find((e) => e.category === 'feat' && e.name === 'Tough')!;
    c = advance(c, 'fighter', 6, { featId: feat.id });
    expect(maxHp(c)).toBe(44);
    expect(() =>
      advance(level('fighter', 3), 'fighter', 6, { abilityIncreases: { str: 1 } }),
    ).toThrow();
    expect(() =>
      advance(level('fighter', 2), 'fighter', 6, { abilityIncreases: { str: 2 } }),
    ).toThrow();
  });
  it('grants only the appropriate initial or multiclass training', () => {
    const fighter = level('fighter', 1);
    expect(fighter.proficiencies).toContain('Heavy armor');
    const wizard = level('wizard', 1),
      next = addLevel(wizard, 'fighter');
    expect(next.proficiencies).toContain('Medium armor');
    expect(next.proficiencies).not.toContain('Heavy armor');
    expect(next.saves).toEqual(wizard.saves);
  });
  it('does not grant every fighting style or unselected subclass', () => {
    const c = attachProgression(level('fighter', 4));
    expect(
      Object.values(c.selections).filter((s) => s.name.startsWith('Fighting Style:')),
    ).toHaveLength(0);
    expect(Object.values(c.selections).some((s) => s.name === 'Improved Critical')).toBe(false);
  });
  it('flags entering and leaving multiclass restrictions; records overrides', () => {
    let c = addLevel(newCharacter(), 'wizard');
    expect(multiclassWarnings(c, 'paladin')).toHaveLength(2);
    expect(() => addLevel(c, 'paladin')).toThrow();
    c = addLevel(c, 'paladin', 6, 'DM approved story choice');
    expect(c.overrides.at(-1)?.reason).toContain('DM approved');
  });
  it('rounds Artificer up, paladin/ranger down when multiclassing', () => {
    let c = level('artificer', 3);
    c = addLevel(c, 'wizard');
    expect(spellSlots(c).slice(0, 3)).toEqual([4, 2, 0]);
    let p = level('paladin', 3);
    p = addLevel(p, 'wizard');
    expect(spellSlots(p).slice(0, 3)).toEqual([3, 0, 0]);
  });
  it('uses standalone third-caster progression and multiclass rounding', () => {
    let c = level('fighter', 4);
    Object.values(c.classes)[0].caster = 'third';
    expect(spellSlots(c)[0]).toBe(3);
    c = addLevel(c, 'wizard');
    expect(spellSlots(c)[0]).toBe(3);
  });
  it('keeps Pact Magic separate', () => {
    let c = level('warlock', 3);
    c = addLevel(c, 'wizard');
    expect(pactSlots(c)).toEqual({ count: 2, level: 2 });
    expect(spellSlots(c)).toEqual([2, 0, 0, 0, 0, 0, 0, 0, 0]);
  });
  it('advances custom classes using their configured progression', () => {
    const c = newCharacter(),
      id = uid();
    c.classes[id] = {
      id,
      classId: 'custom_test',
      name: 'Star keeper',
      level: 1,
      hitDie: 8,
      caster: 'half',
      castingAbility: 'wis',
      subclass: '',
      hpRolls: [8],
      hitDiceUsed: 0,
      customProgression: 'Choose a constellation each level',
    };
    const next = advance(c, 'custom_test', 5);
    expect(next.classes[id].level).toBe(2);
    expect(next.classes[id].customProgression).toContain('constellation');
  });
  it('does not stack incompatible racial versions', () => {
    const elf = catalog.find((e) => e.id === 'srd-race-elf')!,
      dwarf = catalog.find((e) => e.id === 'srd-race-dwarf')!;
    const c = applyContent(applyContent(newCharacter(), elf), dwarf);
    expect(scores(c).dex).toBe(10);
    expect(scores(c).con).toBe(12);
    expect(c.selections[elf.id].active).toBe(false);
  });
  it('replacement deactivates old bonuses and resource pools', () => {
    const original = {
      ...catalog[0],
      id: 'test-original',
      category: 'feature' as const,
      mechanics: {
        ...emptyMechanics(),
        acBonus: 2,
        resources: [{ ...newResource(), id: 'charges' }],
      },
    };
    const replacement = {
      ...original,
      id: 'test-new',
      mechanics: { ...emptyMechanics(), acBonus: 1, replaces: [original.id] },
    };
    const c = applyContent(applyContent(newCharacter(), original), replacement);
    expect(ac(c)).toBe(11);
    expect(Object.keys(c.resources)).toHaveLength(0);
  });
  it('keeps selected content pinned until explicit upgrade', () => {
    let c = applyContent(newCharacter(), catalog[0]);
    c.selections[catalog[0].id].revision = 'earlier';
    c.selections[catalog[0].id].mechanics.acBonus = 3;
    expect(availableUpgrades(c)).toHaveLength(1);
    expect(ac(c)).toBe(13);
    const upgraded = upgradeContent(c, catalog[0]);
    expect(upgraded.selections[catalog[0].id].revision).toBe(catalog[0].revision);
    expect(c.selections[catalog[0].id].revision).toBe('earlier');
  });
  it('keeps inactive version upgrades from replacing the active race', () => {
    const elf = catalog.find((e) => e.id === 'srd-race-elf')!;
    const dwarf = catalog.find((e) => e.id === 'srd-race-dwarf')!;
    const c = applyContent(applyContent(newCharacter(), elf), dwarf);
    const next = upgradeContent(c, { ...elf, revision: 'new-review' });
    expect(next.selections[elf.id].active).toBe(false);
    expect(next.selections[dwarf.id].active).toBe(true);
    expect(next.race).toBe(dwarf.name);
    expect(scores(next)).toEqual(scores(c));
  });
  it('switching subclass removes dependent old features and their configured effects', () => {
    const champion = catalog.find((e) => e.category === 'subclass' && /champion/i.test(e.name))!;
    const battleMaster = catalog.find(
      (e) => e.category === 'subclass' && /battle master/i.test(e.name),
    )!;
    let c = attachProgression(applyContent(level('fighter', 4), champion));
    const improved = Object.values(c.selections).find((s) => s.name === 'Improved Critical')!;
    improved.mechanics.acBonus = 2;
    c = attachProgression(applyContent(c, battleMaster));
    expect(c.selections[improved.id].active).toBe(false);
    expect(ac(c)).toBe(13);
  });
  it('keeps duplicate-name grants independent and preserves expended uses on reconciliation', () => {
    const feature = {
      ...catalog[0],
      id: 'test-grant',
      category: 'feat' as const,
      mechanics: {
        ...emptyMechanics(),
        grantedSpells: ['Shield'],
        spellcastingAbility: 'cha' as const,
        spellFreeUses: 2,
        spellRecovery: 'long' as const,
        spellResourceId: 'focus',
        spellResourceCost: 2,
      },
    };
    let c = applyChoices(level('wizard', 1), { spellIds: ['srd-spell-shield'] });
    c = syncGrantedSpells(applyContent(c, feature));
    const grant = Object.values(c.spells).find((s) => s.grantSourceId === feature.id)!;
    expect(Object.values(c.spells).filter((s) => s.name === 'Shield')).toHaveLength(2);
    expect(grant).toMatchObject({
      castingAbility: 'cha',
      freeUses: 2,
      freeMax: 2,
      resourceId: 'focus',
      resourceCost: 2,
    });
    grant.freeUses = 0;
    c = syncGrantedSpells(c);
    expect(c.spells[grant.id].freeUses).toBe(0);
    expect(restPreview(c, 'long').freeUses[grant.id]).toBe(2);
    c.selections[feature.id].active = false;
    c = syncGrantedSpells(c);
    expect(Object.values(c.spells).filter((s) => s.name === 'Shield')).toHaveLength(1);
  });
  it('rejects feats at unrelated levels and invalid ASI distributions', () => {
    const feat = catalog.find((e) => e.category === 'feat' && e.name === 'Tough')!;
    expect(() => advance(level('fighter', 1), 'fighter', 6, { featId: feat.id })).toThrow();
    expect(() =>
      advance(level('fighter', 3), 'fighter', 6, { abilityIncreases: { str: 3, dex: -1 } }),
    ).toThrow();
  });
  it('preserves temporary HP before applying damage', () => {
    const c = level('fighter', 1);
    c.combat.tempHp = 4;
    const next = damage(c, 7);
    expect(next.combat.tempHp).toBe(0);
    expect(next.combat.hp).toBe(c.combat.hp - 3);
  });
  it('does not apply negative dexterity to heavy armor', () => {
    const c = newCharacter();
    c.abilities.dex = 8;
    const a = {
      ...newItem('Plate'),
      kind: 'armor' as const,
      armorBase: 18,
      dexCap: 0,
      equipped: true,
    };
    c.items[a.id] = a;
    expect(ac(c)).toBe(18);
  });
  it('rejects invalid dice and supports deterministic test rolls', () => {
    expect(rollDice('2d6+2', () => 0).total).toBe(4);
    expect(() => rollDice('100d10000')).toThrow();
  });
});
describe('rest recovery', () => {
  it('short rests spend selected Hit Dice without automatic HP recovery', () => {
    const c = level('fighter', 4),
      id = Object.keys(c.classes)[0];
    c.combat.hp = 3;
    c.resources.class_secondwind.current = 0;
    const p = restPreview(c, 'short');
    expect(p.hp).toBe(3);
    expect(p.resources.class_secondwind).toBe(1);
    p.hp = 10;
    p.hitDiceUsed[id] = 1;
    const next = applyRest(c, p);
    expect(next.classes[id].hitDiceUsed).toBe(1);
    expect(next.combat.hp).toBe(10);
  });
  it('long rests recover half total Hit Dice, normal slots, HP and configured resources', () => {
    const c = level('wizard', 5),
      id = Object.keys(c.classes)[0];
    c.classes[id].hitDiceUsed = 5;
    c.combat.hp = 2;
    c.slotsUsed[0] = 3;
    const r = {
      ...newResource(),
      trigger: 'short' as const,
      max: 4,
      current: 1,
      recovery: 'fixed' as const,
      amount: '2',
    };
    c.resources[r.id] = r;
    const p = restPreview(c, 'long');
    expect(p.hitDiceUsed[id]).toBe(3);
    expect(p.hp).toBe(maxHp(c));
    expect(p.slotsUsed[0]).toBe(0);
    expect(p.resources[r.id]).toBe(3);
  });
  it('never replenishes scrolls, charges, or manual resources automatically', () => {
    const c = level('wizard', 1),
      i = { ...newItem('Scroll'), kind: 'scroll' as const, quantity: 0, charges: 0, maxCharges: 3 };
    c.items[i.id] = i;
    const r = { ...newResource(), trigger: 'manual' as const, current: 0 };
    c.resources[r.id] = r;
    const next = applyRest(c, restPreview(c, 'long'));
    expect(next.items[i.id]).toEqual(i);
    expect(next.resources[r.id].current).toBe(0);
  });
  it('recovers spell-granted free uses only on their trigger', () => {
    let c = applyChoices(level('wizard', 1), { spellIds: ['srd-spell-shield'] });
    const s = Object.values(c.spells)[0];
    s.freeMax = 1;
    s.freeUses = 0;
    s.recovery = 'long';
    expect(restPreview(c, 'short').freeUses[s.id]).toBe(0);
    expect(restPreview(c, 'long').freeUses[s.id]).toBe(1);
  });
});
