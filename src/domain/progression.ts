import { catalog, toCharacterSpell } from '../data/catalog';
import { abilities, type Character, type ContentEntry, type Ability } from './model';
import { addLevel, applyContent, maxHp, reconcileClassResources, scores } from './rules';
import { classById } from './classes';
const normalized = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
export function progressionFeatures(
  c: Character,
  classId: string,
  atLevel?: number,
): ContentEntry[] {
  const track = Object.values(c.classes).find((t) => t.classId === classId);
  if (!track) return [];
  const matches = catalog.filter((e) => {
    if (
      e.category !== 'feature' ||
      !e.classIds.includes(classId) ||
      e.level < 1 ||
      e.level > track.level ||
      (atLevel !== undefined && e.level !== atLevel) ||
      e.metadata.choiceParent
    )
      return false;
    if (e.license === 'CC-BY-4.0')
      return (
        !e.metadata.subclass || normalized(track.subclass).includes(normalized(e.metadata.subclass))
      );
    const parent = catalog.find((p) => p.id === e.metadata.parent);
    return parent?.category === 'subclass'
      ? Object.values(c.selections).some((s) => s.active && s.id === parent.id)
      : classId === 'artificer' && parent?.category === 'class';
  });
  return matches
    .sort((a, b) => Number(b.license === 'CC-BY-4.0') - Number(a.license === 'CC-BY-4.0'))
    .filter(
      (e, i, list) =>
        list.findIndex((other) => other.name === e.name && other.level === e.level) === i,
    );
}
export function attachProgression(c: Character): Character {
  let next = structuredClone(c);
  for (const t of Object.values(c.classes))
    for (const e of progressionFeatures(c, t.classId))
      if (!next.selections[e.id]) next = applyContent(next, e);
  return next;
}
export function contentWarnings(c: Character, e: ContentEntry): string[] {
  const warnings: string[] = [];
  if (e.category === 'subclass') {
    const t = Object.values(c.classes).find((t) => e.classIds.includes(t.classId));
    if (!t) warnings.push('Add the matching class before choosing its subclass.');
    else if (t.level < (classById(t.classId)?.subclassLevel || 1))
      warnings.push('Subclass choice is not available at this class level.');
  }
  if (
    e.category === 'feature' &&
    e.level > 0 &&
    e.classIds.length &&
    !Object.values(c.classes).some((t) => e.classIds.includes(t.classId) && t.level >= e.level)
  )
    warnings.push('This feature requires a higher level in its class.');
  const prereq = e.mechanics.prerequisites;
  const names: Record<string, Ability> = {
    Strength: 'str',
    Dexterity: 'dex',
    Constitution: 'con',
    Intelligence: 'int',
    Wisdom: 'wis',
    Charisma: 'cha',
  };
  const required = [
    ...prereq.matchAll(/(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+(\d+)/gi),
  ].map((m) => ({
    ability: Object.entries(names).find(([n]) => n.toLowerCase() === m[1].toLowerCase())![1],
    minimum: Number(m[2]),
  }));
  if (required.length) {
    const checks = required.map((r) => scores(c)[r.ability] >= r.minimum);
    if (/\bor\b/i.test(prereq) ? !checks.some(Boolean) : !checks.every(Boolean))
      warnings.push('Ability prerequisite not met: ' + prereq);
  }
  if (
    /ability to cast at least one spell|spellcasting/i.test(prereq) &&
    !Object.values(c.classes).some((t) => t.caster !== 'none') &&
    !Object.keys(c.spells).length
  )
    warnings.push('This option requires spellcasting.');
  return warnings;
}
export interface AdvancementChoices {
  subclassId?: string;
  featId?: string;
  abilityIncreases?: Partial<Record<Ability, number>>;
  spellIds?: string[];
  featureIds?: string[];
  notes?: string;
  override?: string;
}
export function applyChoices(character: Character, choices: AdvancementChoices): Character {
  let c = structuredClone(character),
    oldMax = maxHp(c);
  for (const id of [choices.subclassId, choices.featId, ...(choices.featureIds || [])].filter(
    Boolean,
  )) {
    const entry = catalog.find((e) => e.id === id);
    if (!entry) throw new Error('The selected content is unavailable.');
    const warnings = contentWarnings(c, entry);
    if (warnings.length && !choices.override?.trim()) throw new Error(warnings.join(' '));
    c = applyContent(c, entry);
  }
  for (const a of abilities) {
    const increase = choices.abilityIncreases?.[a] || 0;
    c.abilities[a] += increase;
  }
  for (const id of choices.spellIds || []) {
    const e = catalog.find((e) => e.id === id && e.category === 'spell');
    if (!e) continue;
    if (!Object.values(c.spells).some((s) => s.contentId === e.id)) {
      const s = toCharacterSpell(e);
      s.castingAbility =
        Object.values(c.classes).find((t) => e.classIds.includes(t.classId))?.castingAbility ||
        'int';
      c.spells[s.id] = s;
      c = applyContent(c, e);
    }
  }
  if (choices.notes) c.features += (c.features ? '\n\n' : '') + choices.notes;
  if (choices.override)
    c.overrides.push({ at: new Date().toISOString(), reason: choices.override });
  c = syncGrantedSpells(attachProgression(c));
  c = reconcileClassResources(c);
  c.combat.hp = Math.min(maxHp(c), c.combat.hp + Math.max(0, maxHp(c) - oldMax));
  return c;
}
export function advance(
  c: Character,
  classId: string,
  hpRoll: number,
  choices: AdvancementChoices = {},
) {
  const next = addLevel(c, classId, hpRoll, choices.override);
  const def = classById(classId),
    level = Object.values(next.classes).find((t) => t.classId === classId)!.level;
  const points = Object.values(choices.abilityIncreases || {}).reduce((n, v) => n + (v || 0), 0);
  if (
    Object.values(choices.abilityIncreases || {}).some(
      (n) => !Number.isInteger(n) || n! < 0 || n! > 2,
    )
  )
    throw new Error('Each ability increase must be zero, one, or two points.');
  if (choices.featId && !def?.asi.includes(level))
    throw new Error(
      'Choose a level-up feat at an eligible ability improvement level. Other granted feats can be added from the library.',
    );
  if (points && (points !== 2 || !def?.asi.includes(level) || choices.featId))
    throw new Error(
      'An ability improvement grants two points at an eligible class level, or one feat.',
    );
  if (points && abilities.some((a) => scores(next)[a] + (choices.abilityIncreases?.[a] || 0) > 20))
    throw new Error('An ability improvement cannot raise a score above 20.');
  return applyChoices(next, choices);
}
export function availableUpgrades(c: Character) {
  return Object.values(c.selections).flatMap((s) => {
    const current = catalog.find((e) => e.id === s.id);
    return current && current.revision !== s.revision ? [{ previous: s, current }] : [];
  });
}
export function upgradeContent(c: Character, entry: ContentEntry) {
  const next = structuredClone(c),
    previous = next.selections[entry.id];
  if (!previous) return c;
  if (!previous.active) {
    next.selections[entry.id] = {
      ...structuredClone(entry),
      selectedAt: previous.selectedAt,
      active: false,
      choiceNotes: previous.choiceNotes,
    };
    return next;
  }
  delete next.selections[entry.id];
  const upgraded = applyContent(next, entry);
  upgraded.selections[entry.id].active = previous.active;
  upgraded.selections[entry.id].choiceNotes = previous.choiceNotes;
  // Explicitly retain user modifications as a note; the preview states mechanics will be replaced.
  upgraded.overrides.push({
    at: new Date().toISOString(),
    reason:
      'Approved content upgrade: ' + entry.name + ' ' + previous.revision + ' → ' + entry.revision,
  });
  return upgraded;
}

export function syncGrantedSpells(character: Character): Character {
  const c = structuredClone(character);
  for (const s of Object.values(c.spells))
    if (s.grantSourceId && c.selections[s.grantSourceId] && !c.selections[s.grantSourceId].active)
      delete c.spells[s.id];
  for (const source of Object.values(c.selections).filter((s) => s.active)) {
    const names = source.mechanics.grantedSpells;
    for (const old of Object.values(c.spells))
      if (
        old.grantSourceId === source.id &&
        !names.some((name) => name.toLowerCase() === old.name.toLowerCase())
      )
        delete c.spells[old.id];
    for (const name of names) {
      const entry = catalog.find(
        (e) => e.category === 'spell' && e.name.toLowerCase() === name.toLowerCase(),
      );
      if (!entry) continue;
      const old = Object.values(c.spells).find(
        (s) => s.grantSourceId === source.id && s.name.toLowerCase() === name.toLowerCase(),
      );
      const spell = old || toCharacterSpell(entry),
        m = source.mechanics;
      spell.grantSourceId = source.id;
      spell.origin = source.name;
      spell.castingAbility = m.spellcastingAbility;
      spell.freeUses = old
        ? Math.max(0, m.spellFreeUses - (old.freeMax - old.freeUses))
        : m.spellFreeUses;
      spell.freeMax = m.spellFreeUses;
      spell.recovery = m.spellRecovery;
      spell.resourceId = m.spellResourceId;
      spell.resourceCost = m.spellResourceCost;
      c.spells[spell.id] = spell;
    }
  }
  return c;
}
