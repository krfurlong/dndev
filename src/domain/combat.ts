import { ItemSchema, SpellSchema, type Character, type CharacterSpell, type Item } from './model';
import { mod, scores, proficiency, totalLevel, signed, spellSlots, pactSlots } from './rules';
import { threeWayMerge } from './merge';

export function weaponReference(c: Character, item: Item): string[] {
  if (item.damage.trim()) return [item.damage]; // Explicit text always takes precedence.
  const p = item.combat;
  if (!p || !p.dice) return [];
  const a = scores(c);
  const ability =
    p.ability === 'auto'
      ? p.finesse
        ? a.dex > a.str
          ? 'dex'
          : 'str'
        : p.ranged
          ? 'dex'
          : 'str'
      : p.ability;
  const bonus = (ability === 'none' ? 0 : mod(a[ability])) + p.bonus;
  const formula = (dice: string) => dice + (bonus ? signed(bonus) : '') + ' ' + p.type;
  return [formula(p.dice), ...(p.versatile ? [formula(p.versatile) + ' (two hands)'] : [])];
}
function atLevel<T>(table: Record<string, T>, level: number): T | undefined {
  const key = Object.keys(table)
    .map(Number)
    .filter((n) => n <= level)
    .sort((a, b) => b - a)[0];
  return key === undefined ? undefined : table[String(key)];
}
export function spellReference(
  c: Character,
  spell: CharacterSpell,
  slotLevel = spell.level,
): string[] {
  const p = spell.combat;
  if (!p) return [];
  const abilityMod = mod(scores(c)[spell.castingAbility]);
  const result: string[] = [];
  if (p.attack)
    result.push(
      signed(p.attackOverride ?? proficiency(c) + abilityMod) + ' ' + p.attack + ' spell attack',
    );
  if (p.save)
    result.push(
      'DC ' +
        (p.dcOverride ?? 8 + proficiency(c) + abilityMod) +
        ' · ' +
        p.save.toUpperCase() +
        ' save',
    );
  for (const effect of p.effects) {
    const formula =
      effect.formula || atLevel(effect.byLevel, totalLevel(c)) || atLevel(effect.bySlot, slotLevel);
    if (!formula) continue;
    // Substitute only an explicit MOD token. Never evaluate user-supplied expressions.
    const resolved = formula
      .replace(/\+\s*MOD\b/g, abilityMod < 0 ? '- ' + Math.abs(abilityMod) : '+ ' + abilityMod)
      .replace(/\bMOD\b/g, String(abilityMod));
    const count =
      atLevel(effect.instancesByLevel, totalLevel(c)) ?? atLevel(effect.instancesBySlot, slotLevel);
    result.push(
      effect.label +
        ': ' +
        resolved +
        (effect.type ? ' ' + effect.type : '') +
        (count ? ' · ' + count + (count === 1 ? ' instance' : ' instances') : ''),
    );
  }
  return result;
}
export function castingOptions(c: Character, s: CharacterSpell) {
  const options: { value: string; label: string; level: number }[] = [];
  const r = c.resources[s.resourceId];
  if (r && r.current >= s.resourceCost)
    options.push({
      value: 'resource',
      label: r.name + ' · cost ' + s.resourceCost,
      level: s.level,
    });
  if (s.level === 0) options.push({ value: 'cantrip', label: 'Cantrip · no slot', level: 0 });
  if (s.freeUses > 0)
    options.push({ value: 'free', label: 'Free use (' + s.freeUses + ' left)', level: s.level });
  if (s.ritual)
    options.push({
      value: 'ritual',
      label: 'Ritual · no slot (confirm class eligibility)',
      level: s.level,
    });
  const pact = pactSlots(c);
  if (s.level > 0 && pact.level >= s.level && pact.count > c.pactUsed)
    options.push({ value: 'pact', label: 'Pact slot · level ' + pact.level, level: pact.level });
  if (s.level > 0)
    spellSlots(c).forEach((n, i) => {
      if (i >= s.level - 1 && n > c.slotsUsed[i])
        options.push({
          value: String(i + 1),
          label: 'Level ' + (i + 1) + ' slot (' + (n - c.slotsUsed[i]) + ' remaining)',
          level: i + 1,
        });
    });
  return options;
}
export function castSpell(c: Character, id: string, resource: string) {
  const s = c.spells[id];
  if (!s || !castingOptions(c, s).some((o) => o.value === resource))
    throw new Error('That casting resource is no longer available. Choose another resource.');
  if (resource === 'resource') c.resources[s.resourceId].current -= s.resourceCost;
  else if (resource === 'free') s.freeUses--;
  else if (resource === 'pact') c.pactUsed++;
  else if (resource !== 'cantrip' && resource !== 'ritual') c.slotsUsed[Number(resource) - 1]++;
  if (s.concentration) c.combat.concentration = s.name;
}
export function consumeItem(c: Character, id: string, kind: 'quantity' | 'charges') {
  const i = c.items[id];
  if (!i || i.quantity < 1 || i[kind] < 1) throw new Error('This item is no longer available.');
  i[kind]--;
}
export function saveEditedRecord<T extends Item | CharacterSpell>(
  original: T,
  edited: T,
  current: T | undefined,
): T {
  if (!current) throw new Error('This entry is no longer available.');
  const normalize = (value: T) =>
    ('contentId' in value ? SpellSchema.parse(value) : ItemSchema.parse(value)) as T;
  const merged = threeWayMerge(normalize(original), normalize(edited), normalize(current));
  if (merged.conflicts.length)
    throw new Error('These details changed on another device. Reopen the editor to review them.');
  return merged.value;
}
