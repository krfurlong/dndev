import { SpellCombatSchema, WeaponCombatSchema, type SpellCombat } from '../domain/model';

interface SrdSpell {
  index: string;
  attack_type?: string;
  dc?: { dc_type: { index: string }; dc_success: string };
  damage?: {
    damage_type?: { name: string };
    damage_at_slot_level?: Record<string, string | undefined>;
    damage_at_character_level?: Record<string, string | undefined>;
  }[];
  heal_at_slot_level?: Record<string, string | undefined>;
}
// These are reference formulas, never dice simulations. Complex effects still need the source.
export function srdSpellCombat(s: SrdSpell): SpellCombat {
  const profile = SpellCombatSchema.parse({
    attack: s.attack_type || '',
    save: s.dc?.dc_type.index || '',
    effects: [
      ...(s.damage || []).map((d) => ({
        label: 'Damage',
        type: d.damage_type?.name.toLowerCase() || '',
        bySlot: d.damage_at_slot_level || {},
        byLevel: d.damage_at_character_level || {},
      })),
      ...(s.heal_at_slot_level ? [{ label: 'Healing', bySlot: s.heal_at_slot_level }] : []),
    ],
    notes:
      s.dc?.dc_success === 'half'
        ? 'Half damage on a successful save. Check the source for other effects.'
        : '',
  });
  const first = profile.effects[0];
  if (s.index === 'eldritch-blast' && first) {
    first.label = 'Damage per beam';
    first.instancesByLevel = { 1: 1, 5: 2, 11: 3, 17: 4 };
    profile.notes = 'Make a separate attack for each beam; choose targets at the table.';
  }
  if (s.index === 'scorching-ray' && first) {
    first.label = 'Damage per ray';
    first.formula = '2d6';
    first.bySlot = {};
    first.instancesBySlot = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [i + 2, i + 3]));
    profile.notes = 'Make a separate attack for each ray; choose targets at the table.';
  }
  if (s.index === 'magic-missile' && first) {
    first.label = 'Damage per dart';
    first.formula = '1d4 + 1';
    first.bySlot = {};
    first.instancesBySlot = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [i + 1, i + 3]));
    profile.notes = 'Choose a target for each dart; darts strike simultaneously.';
  }
  if (s.index === 'acid-arrow' && first) {
    first.label = 'Initial damage on hit';
    profile.effects.push({
      ...first,
      label: 'Damage at end of target’s next turn',
      bySlot: Object.fromEntries(Array.from({ length: 8 }, (_, i) => [i + 2, i + 2 + 'd4'])),
    });
    profile.notes = 'On a miss: half the initial damage, with no delayed damage.';
  }
  return profile;
}
interface SrdWeapon {
  weapon_range?: string;
  damage?: { damage_dice: string; damage_type: { name: string } };
  two_handed_damage?: { damage_dice: string };
  properties?: { index: string }[];
  range?: { normal: number; long?: number | null };
  throw_range?: { normal: number; long?: number | null };
}
export function srdWeaponCombat(e: SrdWeapon) {
  if (!e.damage) return null;
  const distance = (r: { normal: number; long?: number | null }) =>
    r.normal + (r.long ? '/' + r.long : '') + ' ft';
  return WeaponCombatSchema.parse({
    dice: e.damage.damage_dice,
    type: e.damage.damage_type.name.toLowerCase(),
    versatile: e.two_handed_damage?.damage_dice || '',
    ranged: e.weapon_range === 'Ranged',
    finesse: !!e.properties?.some((p) => p.index === 'finesse'),
    range: [
      e.range ? distance(e.range) : '',
      e.throw_range ? 'Thrown ' + distance(e.throw_range) : '',
    ]
      .filter(Boolean)
      .join(' · '),
  });
}
