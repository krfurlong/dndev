import {
  abilities,
  newResource,
  uid,
  type Ability,
  type Character,
  type ClassTrack,
  type ContentEntry,
  type Resource,
} from './model';
import { classes, classById, slotTable } from './classes';
import { classTraining } from './training';

export const mod = (score: number) => Math.floor((score - 10) / 2);
export const signed = (n: number) => (n >= 0 ? '+' : '') + n;
export const totalLevel = (c: Character) =>
  Object.values(c.classes).reduce((n, x) => n + x.level, 0);
export const proficiency = (c: Character) => Math.ceil(Math.max(1, totalLevel(c)) / 4) + 1;
export function scores(c: Character): Record<Ability, number> {
  const result = { ...c.abilities };
  for (const selection of Object.values(c.selections).filter((s) => s.active))
    for (const a of abilities) result[a] += selection.mechanics.abilityBonuses[a] || 0;
  if (Object.values(c.classes).some((t) => t.classId === 'barbarian' && t.level === 20)) {
    result.str += 4;
    result.con += 4;
  }
  return result;
}
export function maxHp(c: Character) {
  if (c.combat.hpOverride !== null) return c.combat.hpOverride;
  const con = mod(scores(c).con),
    lvl = totalLevel(c);
  const bonus = Object.values(c.selections)
    .filter((s) => s.active)
    .reduce((n, s) => n + s.mechanics.hpPerLevel * lvl, 0);
  return Math.max(
    1,
    Object.values(c.classes).reduce(
      (n, t) => n + t.hpRolls.reduce((s, r) => s + Math.max(1, r + con), 0),
      0,
    ) + bonus,
  );
}
export function ac(c: Character) {
  if (c.combat.acOverride !== null) return c.combat.acOverride;
  const a = scores(c),
    items = Object.values(c.items).filter((i) => i.equipped && i.quantity > 0);
  const armor = items.filter((i) => i.kind === 'armor'),
    shield = items.some((i) => i.kind === 'shield') ? 2 : 0;
  let base = 10 + mod(a.dex);
  if (armor.length)
    base = Math.max(
      ...armor.map((i) => i.armorBase + (i.dexCap === 0 ? 0 : Math.min(mod(a.dex), i.dexCap))),
    );
  else {
    if (Object.values(c.classes).some((t) => t.classId === 'barbarian'))
      base = Math.max(base, 10 + mod(a.dex) + mod(a.con));
    if (!shield && Object.values(c.classes).some((t) => t.classId === 'monk'))
      base = Math.max(base, 10 + mod(a.dex) + mod(a.wis));
  }
  return (
    base +
    shield +
    Object.values(c.selections)
      .filter((s) => s.active)
      .reduce((n, s) => n + s.mechanics.acBonus, 0)
  );
}
export function skillBonus(c: Character, name: string, ability: Ability) {
  const fromFeature = Object.values(c.selections).some(
    (s) => s.active && s.mechanics.skills.includes(name),
  );
  let rank = Math.max(c.skills[name] || 0, fromFeature ? 1 : 0);
  if (rank === 0 && Object.values(c.classes).some((t) => t.classId === 'bard' && t.level >= 2))
    rank = 0.5;
  return mod(scores(c)[ability]) + Math.floor(proficiency(c) * rank);
}
export function spellSlots(c: Character): number[] {
  if (c.slotOverrides) return c.slotOverrides;
  const spellcasters = Object.values(c.classes).filter(
    (t) =>
      t.caster !== 'none' &&
      t.caster !== 'pact' &&
      (t.caster !== 'half' || t.level >= 2) &&
      (t.caster !== 'third' || t.level >= 3),
  );
  const multi = spellcasters.length > 1;
  const casterLevel = spellcasters.reduce((n, t) => {
    if (t.caster === 'full') return n + t.level;
    if (t.caster === 'artificer') return n + Math.ceil(t.level / 2);
    if (t.caster === 'half') return n + (multi ? Math.floor(t.level / 2) : Math.ceil(t.level / 2));
    return n + (multi ? Math.floor(t.level / 3) : Math.ceil(t.level / 3));
  }, 0);
  return Array.from({ length: 9 }, (_, i) => slotTable[Math.min(20, casterLevel)]?.[i] || 0);
}
export function pactSlots(c: Character) {
  const level = Object.values(c.classes)
    .filter((t) => t.caster === 'pact')
    .reduce((n, t) => n + t.level, 0);
  return {
    count: level === 0 ? 0 : level === 1 ? 1 : level < 11 ? 2 : level < 17 ? 3 : 4,
    level: Math.min(5, Math.ceil(level / 2)),
  };
}
export function multiclassWarnings(c: Character, nextId: string): string[] {
  const existing = Object.values(c.classes);
  if (!existing.length || existing.some((t) => t.classId === nextId)) return [];
  const a = scores(c);
  return [...new Set([...existing.map((t) => t.classId), nextId])].flatMap((id) => {
    const def = classById(id);
    if (
      !def ||
      def.prerequisites.some((or) => Object.entries(or).every(([k, v]) => a[k as Ability] >= v))
    )
      return [];
    return [
      def.name +
        ' requires ' +
        def.prerequisites
          .map((or) =>
            Object.entries(or)
              .map(([k, v]) => k.toUpperCase() + ' ' + v)
              .join(' and '),
          )
          .join(' or '),
    ];
  });
}
export function levelGains(classId: string, level: number): string[] {
  const def = classById(classId);
  return [
    ...(def?.gains[level] || []),
    ...(def?.asi.includes(level) ? ['Ability Score Improvement or feat'] : []),
  ];
}
export function addLevel(
  character: Character,
  classId: string,
  hpRoll?: number,
  overrideReason = '',
): Character {
  const c = structuredClone(character);
  if (totalLevel(c) >= 20) throw new Error('The character is already level 20.');
  const warnings = multiclassWarnings(c, classId);
  if (warnings.length && !overrideReason.trim())
    throw new Error(warnings.join('; ') + '. Record a house-rule override to continue.');
  const existing = Object.values(c.classes).find((t) => t.classId === classId);
  const definition =
    classById(classId) ||
    (existing
      ? {
          name: existing.name,
          hitDie: existing.hitDie,
          caster: existing.caster,
          ability: existing.castingAbility,
          saves: c.saves,
        }
      : undefined);
  if (!definition)
    throw new Error('Choose a known class, or add a custom class in the character editor.');
  const oldMax = maxHp(c);
  const first = totalLevel(c) === 0;
  const roll = first ? definition.hitDie : (hpRoll ?? definition.hitDie / 2 + 1);
  if (!Number.isInteger(roll) || roll < 1 || roll > definition.hitDie)
    throw new Error('HP roll must be between 1 and the class Hit Die.');
  const track: ClassTrack = existing || {
    id: uid(),
    classId,
    name: definition.name,
    level: 0,
    hitDie: definition.hitDie,
    caster: definition.caster,
    castingAbility: definition.ability,
    subclass: '',
    hitDiceUsed: 0,
    hpRolls: [],
    customProgression: '',
  };
  track.level++;
  track.hpRolls.push(roll);
  c.classes[track.id] = track;
  if (first) c.saves = [...definition.saves];
  if (!existing) {
    const training = classTraining(classId, first);
    if (training.length)
      c.proficiencies +=
        (c.proficiencies ? '\n' : '') + definition.name + ': ' + training.join(', ');
  }
  const gain = Math.max(1, roll + mod(scores(c).con));
  if (c.combat.hpOverride !== null) c.combat.hpOverride += gain;
  c.combat.hp = first ? maxHp(c) : Math.min(maxHp(c), c.combat.hp + Math.max(0, maxHp(c) - oldMax));
  c.levelHistory.push({
    at: new Date().toISOString(),
    classId,
    level: track.level,
    hpGain: gain,
    notes: levelGains(classId, track.level).join(', '),
  });
  if (overrideReason.trim())
    c.overrides.push({ at: new Date().toISOString(), reason: overrideReason });
  return reconcileClassResources(c);
}
export function reconcileClassResources(character: Character): Character {
  const c = structuredClone(character);
  const specifications: { id: string; name: string; max: number; trigger: Resource['trigger'] }[] =
    [];
  const level = (id: string) => Object.values(c.classes).find((t) => t.classId === id)?.level || 0;
  const add = (id: string, name: string, max: number, trigger: Resource['trigger']) =>
    specifications.push({ id: 'class_' + id, name, max, trigger });
  const barb = level('barbarian'),
    bard = level('bard'),
    cleric = level('cleric'),
    druid = level('druid'),
    fighter = level('fighter'),
    monk = level('monk'),
    paladin = level('paladin'),
    sorc = level('sorcerer'),
    wizard = level('wizard'),
    arti = level('artificer');
  if (barb)
    add(
      'rage',
      'Rage',
      barb >= 20 ? 999 : barb >= 17 ? 6 : barb >= 12 ? 5 : barb >= 6 ? 4 : barb >= 3 ? 3 : 2,
      'long',
    );
  if (bard)
    add(
      'inspiration',
      'Bardic Inspiration',
      Math.max(1, mod(scores(c).cha)),
      bard >= 5 ? 'both' : 'long',
    );
  if (cleric >= 2)
    add('channel', 'Channel Divinity', cleric >= 18 ? 3 : cleric >= 6 ? 2 : 1, 'both');
  if (druid >= 2) add('wildshape', 'Wild Shape', druid >= 20 ? 999 : 2, 'both');
  if (fighter) add('secondwind', 'Second Wind', 1, 'both');
  if (fighter >= 2) add('surge', 'Action Surge', fighter >= 17 ? 2 : 1, 'both');
  if (fighter >= 9)
    add('indomitable', 'Indomitable', fighter >= 17 ? 3 : fighter >= 13 ? 2 : 1, 'long');
  if (monk >= 2) add('ki', 'Ki (30 minutes meditation)', monk, 'both');
  if (paladin) {
    add('layhands', 'Lay on Hands', paladin * 5, 'long');
    add('divinesense', 'Divine Sense', Math.max(1, 1 + mod(scores(c).cha)), 'long');
  }
  if (paladin >= 3 && !cleric) add('channel', 'Channel Divinity', 1, 'both');
  if (sorc >= 2) add('sorcery', 'Sorcery points', sorc, 'long');
  if (wizard) add('arcane', 'Arcane Recovery (select slots manually)', 1, 'long');
  if (arti >= 7) add('genius', 'Flash of Genius', Math.max(1, mod(scores(c).int)), 'long');
  for (const s of specifications) {
    const previous = c.resources[s.id];
    c.resources[s.id] = {
      ...newResource(s.name),
      ...previous,
      id: s.id,
      name: s.name,
      max: s.max,
      current: previous ? Math.max(0, s.max - (previous.max - previous.current)) : s.max,
      trigger: s.trigger,
      sourceId: s.id,
    };
  }
  for (const r of Object.values(c.resources))
    if (r.id.startsWith('class_') && !specifications.some((s) => s.id === r.id))
      delete c.resources[r.id];
  return c;
}
export function applyContent(character: Character, entry: ContentEntry): Character {
  const c = structuredClone(character);
  if (entry.edition !== '2014') throw new Error('Only the 2014 ruleset is supported.');
  if (c.selections[entry.id]?.active) return c;
  if (
    entry.category === 'race' ||
    entry.category === 'background' ||
    entry.category === 'subclass'
  ) {
    for (const selected of Object.values(c.selections)) {
      const same =
        selected.category === entry.category &&
        (entry.category !== 'subclass' ||
          selected.classIds.some((id) => entry.classIds.includes(id)));
      if (same) selected.active = false;
    }
  }
  for (const id of entry.mechanics.replaces) if (c.selections[id]) c.selections[id].active = false;
  c.selections[entry.id] = {
    ...structuredClone(entry),
    selectedAt: new Date().toISOString(),
    active: true,
    choiceNotes: '',
  };
  if (entry.category === 'race') {
    c.race = entry.name;
    if (entry.mechanics.speed !== undefined) c.combat.speed = entry.mechanics.speed;
  }
  if (entry.category === 'background') c.background = entry.name;
  if (entry.category === 'subclass') {
    const track = Object.values(c.classes).find((t) => entry.classIds.includes(t.classId));
    if (track) {
      track.subclass = entry.name;
      const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const feature of Object.values(c.selections)) {
        if (feature.category !== 'feature' || !feature.classIds.includes(track.classId)) continue;
        const parent = c.selections[feature.metadata.parent];
        if (parent?.category === 'subclass') feature.active = parent.id === entry.id;
        else if (feature.metadata.subclass)
          feature.active = normalize(entry.name).includes(normalize(feature.metadata.subclass));
      }
      if (/eldritch knight|arcane trickster/i.test(entry.name)) track.castingAbility = 'int';
      track.caster = /eldritch knight|arcane trickster/i.test(entry.name)
        ? 'third'
        : classById(track.classId)?.caster || track.caster;
    }
  }
  return reconcileSelectionEffects(c);
}
export function rollDice(
  formula: string,
  random = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296,
) {
  const match = formula.trim().match(/^(\d{1,2})d(\d{1,3})(?:\s*([+-])\s*(\d{1,3}))?$/i);
  if (!match) throw new Error('Use a dice expression such as 1d8+2.');
  const count = Number(match[1]),
    sides = Number(match[2]);
  if (count < 1 || count > 50 || sides < 2 || sides > 100)
    throw new Error('Use 1–50 dice with 2–100 sides.');
  const rolls = Array.from({ length: count }, () => 1 + Math.floor(random() * sides));
  const adjustment = Number(match[4] || 0) * (match[3] === '-' ? -1 : 1);
  return { rolls, total: rolls.reduce((a, b) => a + b, 0) + adjustment };
}
export interface RestPreview {
  type: 'short' | 'long';
  hp: number;
  tempHp: number;
  hitDiceUsed: Record<string, number>;
  resources: Record<string, number>;
  slotsUsed: number[];
  pactUsed: number;
  freeUses: Record<string, number>;
  exhaustion: number;
  notes: string[];
}
export function restPreview(c: Character, type: 'short' | 'long'): RestPreview {
  const p: RestPreview = {
    type,
    hp: type === 'long' ? maxHp(c) : c.combat.hp,
    tempHp: type === 'long' ? 0 : c.combat.tempHp,
    hitDiceUsed: {},
    resources: {},
    slotsUsed: type === 'long' ? Array(9).fill(0) : [...c.slotsUsed],
    pactUsed: 0,
    freeUses: {},
    exhaustion: c.combat.exhaustion,
    notes: [],
  };
  let recover = type === 'long' ? Math.max(1, Math.floor(totalLevel(c) / 2)) : 0;
  for (const t of Object.values(c.classes)) {
    const n = Math.min(t.hitDiceUsed, recover);
    p.hitDiceUsed[t.id] = t.hitDiceUsed - n;
    recover -= n;
  }
  for (const r of Object.values(c.resources)) {
    let value = r.current;
    if (r.trigger === type || r.trigger === 'both' || (type === 'long' && r.trigger === 'short')) {
      if (r.recovery === 'full') value = r.max;
      else if (r.recovery === 'fixed') value += Number(r.amount) || 0;
      else {
        try {
          value += rollDice(r.amount).total;
        } catch {
          p.notes.push(r.name + ': invalid recovery dice; adjust manually.');
        }
      }
    }
    p.resources[r.id] = Math.min(r.max, Math.max(0, value));
  }
  for (const s of Object.values(c.spells))
    p.freeUses[s.id] =
      s.recovery === type || (type === 'long' && s.recovery === 'short') ? s.freeMax : s.freeUses;
  if (type === 'long') {
    p.notes.push(
      'Confirm at least 8 hours, at least 1 HP at the start, and no other long rest in the past 24 hours.',
    );
    p.notes.push(
      'Choose Hit Dice to recover across your classes. Reduce exhaustion only if food and drink requirements were met.',
    );
  } else
    p.notes.push(
      'Confirm at least 1 hour. Spend available Hit Dice below; a short rest does not automatically heal HP.',
    );
  return p;
}
export function applyRest(character: Character, p: RestPreview): Character {
  const c = structuredClone(character);
  const max = maxHp(c);
  if (p.hp < 0 || p.hp > max) throw new Error('Rest HP must be between zero and maximum HP.');
  for (const t of Object.values(c.classes)) {
    const used = p.hitDiceUsed[t.id];
    if (!Number.isInteger(used) || used < 0 || used > t.level)
      throw new Error('Invalid Hit Dice amount.');
    t.hitDiceUsed = used;
  }
  c.combat.hp = p.hp;
  c.combat.tempHp = Math.max(0, p.tempHp);
  c.combat.exhaustion = Math.min(6, Math.max(0, p.exhaustion));
  if (p.hp > 0) {
    c.combat.deathSuccess = 0;
    c.combat.deathFailure = 0;
  }
  for (const r of Object.values(c.resources))
    r.current = Math.max(0, Math.min(r.max, p.resources[r.id] ?? r.current));
  const slots = spellSlots(c);
  c.slotsUsed = p.slotsUsed.map((n, i) => Math.max(0, Math.min(slots[i], n)));
  c.pactUsed = Math.max(0, Math.min(pactSlots(c).count, p.pactUsed));
  for (const s of Object.values(c.spells))
    s.freeUses = Math.max(0, Math.min(s.freeMax, p.freeUses[s.id] ?? s.freeUses));
  return c;
}
export function damage(character: Character, amount: number): Character {
  const c = structuredClone(character),
    n = Math.max(0, amount),
    absorbed = Math.min(n, c.combat.tempHp);
  c.combat.tempHp -= absorbed;
  c.combat.hp = Math.max(0, c.combat.hp - (n - absorbed));
  return c;
}
export function classSummary(c: Character) {
  return (
    Object.values(c.classes)
      .map((t) => t.name + ' ' + t.level)
      .join(' / ') || 'Choose a class'
  );
}
export { classes };

/** Effects are derived from active pinned selections. Replaced pools leave the sheet. */
export function reconcileSelectionEffects(character: Character): Character {
  const c = structuredClone(character);
  for (const r of Object.values(c.resources))
    if (c.selections[r.sourceId] && !c.selections[r.sourceId].active) delete c.resources[r.id];
  for (const s of Object.values(c.selections).filter((s) => s.active)) {
    for (const spec of s.mechanics.resources) {
      const id = s.id + '_' + spec.id,
        old = c.resources[id];
      c.resources[id] = {
        ...structuredClone(spec),
        id,
        sourceId: s.id,
        current: old ? Math.max(0, spec.max - (old.max - old.current)) : spec.current,
      };
    }
  }
  return c;
}
export function savingThrowBonus(c: Character, a: Ability) {
  return (
    mod(scores(c)[a]) +
    (c.saves.includes(a) ||
    Object.values(c.selections).some((s) => s.active && s.mechanics.saves.includes(a))
      ? proficiency(c)
      : 0)
  );
}
