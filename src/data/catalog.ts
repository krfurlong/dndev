import raw from './catalog.generated.json';
import { srdSpellCombat, srdWeaponCombat } from './combat-profiles';
import books from './books.json';
import srdSpells from './srd-spells.json';
import srdRaces from './srd-races.json';
import srdSubraces from './srd-subraces.json';
import srdFeatures from './srd-features.json';
import srdTraits from './srd-traits.json';
import srdEquipment from './srd-equipment.json';
import srdBackgrounds from './srd-backgrounds.json';
import {
  ContentEntrySchema,
  newItem,
  newResource,
  uid,
  type ContentEntry,
  type CharacterSpell,
  type Item,
  type Mechanics,
} from '../domain/model';

export const bookName = (id: string) => books.find((b) => b.id === id)?.name || id;
export { books };
export const emptyMechanics = (): Mechanics => ({
  abilityBonuses: {},
  skills: [],
  saves: [],
  proficiencies: [],
  hpPerLevel: 0,
  acBonus: 0,
  resources: [],
  grantedSpells: [],
  spellcastingAbility: 'int',
  spellFreeUses: 0,
  spellRecovery: 'long',
  spellResourceId: '',
  spellResourceCost: 1,
  replaces: [],
  prerequisites: '',
  choice: '',
});
const base = (id: string, name: string, category: ContentEntry['category']): ContentEntry => ({
  id,
  name,
  category,
  sourceIds: ['srd'],
  version: 'srd-5.1',
  edition: '2014',
  url: 'https://www.dndbeyond.com/srd',
  publisher: 'Wizards of the Coast',
  revision: 'srd-5.1',
  provenance: [
    {
      bookId: 'srd',
      publisherUrl: 'https://www.dndbeyond.com/srd',
      page: null,
      verifiedOn: '2026-09-17',
    },
  ],
  description: '',
  license: 'CC-BY-4.0',
  automation: 'partial',
  level: 0,
  classIds: [],
  metadata: {},
  combat: null,
  mechanics: emptyMechanics(),
  dependencies: [],
  supersedes: [],
});
const spells: ContentEntry[] = srdSpells.map((s) => ({
  ...base('srd-spell-' + s.index, s.name, 'spell'),
  description: [...s.desc, ...(s.higher_level || [])].join('\n\n'),
  level: s.level,
  combat: srdSpellCombat(s),
  classIds: s.classes.map((c) => c.index),
  metadata: {
    'Casting Time': s.casting_time,
    Range: s.range,
    Components: s.components.join(', '),
    Duration: s.duration,
    school: s.school.name,
    ritual: String(s.ritual),
    concentration: String(s.concentration),
  },
}));
const races: ContentEntry[] = srdRaces.map((r) => ({
  ...base('srd-race-' + r.index, r.name, 'race'),
  description: [
    r.size_description,
    r.language_desc,
    ...r.traits.flatMap((t) => srdTraits.find((x) => x.index === t.index)?.desc || []),
  ].join('\n\n'),
  mechanics: {
    ...emptyMechanics(),
    speed: r.speed,
    abilityBonuses: Object.fromEntries(
      r.ability_bonuses.map((b) => [b.ability_score.index, b.bonus]),
    ),
    proficiencies: r.languages.map((l) => 'Language: ' + l.name),
    choice:
      'ability_bonus_options' in r
        ? 'Choose additional ability increases in the effect editor.'
        : '',
  },
}));
const subraces: ContentEntry[] = srdSubraces.map((r) => {
  const parent = races.find((p) => p.id === 'srd-race-' + r.race.index)!;
  const bonuses = { ...parent.mechanics.abilityBonuses };
  for (const b of r.ability_bonuses) {
    const key = b.ability_score.index as keyof typeof bonuses;
    bonuses[key] = (bonuses[key] || 0) + b.bonus;
  }
  return {
    ...base('srd-race-' + r.index, r.name, 'race'),
    description: [
      r.desc,
      ...r.racial_traits.flatMap((t) => srdTraits.find((x) => x.index === t.index)?.desc || []),
    ].join('\n\n'),
    mechanics: {
      ...parent.mechanics,
      abilityBonuses: bonuses,
      hpPerLevel: r.index === 'hill-dwarf' ? 1 : 0,
    },
  };
});
const features: ContentEntry[] = srdFeatures.map((f) => ({
  ...base('srd-feature-' + f.index, f.name, 'feature'),
  description: f.desc.join('\n\n'),
  level: f.level,
  classIds: [f.class.index],
  metadata: {
    ...('subclass' in f && f.subclass ? { subclass: f.subclass.name } : {}),
    ...('parent' in f && f.parent ? { choiceParent: 'srd-feature-' + f.parent.index } : {}),
  },
}));
const backgrounds: ContentEntry[] = srdBackgrounds.map((b) => ({
  ...base('srd-background-' + b.index, b.name, 'background'),
  description: b.feature.desc.join('\n\n'),
  mechanics: {
    ...emptyMechanics(),
    skills: b.starting_proficiencies.map((p) => p.name.replace('Skill: ', '')),
  },
}));
function enrich(entry: ContentEntry): ContentEntry {
  const e = structuredClone(entry),
    name = e.name.toLowerCase().replace(/\s*\([^)]*\)/g, '');
  if (e.category === 'feat') {
    if (name === 'tough') {
      e.mechanics.hpPerLevel = 2;
      e.automation = 'automated';
    }
    if (name === 'heavily armored') {
      e.mechanics.abilityBonuses.str = 1;
      e.mechanics.proficiencies = ['Heavy armor'];
      e.automation = 'partial';
    }
    if (name === 'fey touched' || name === 'shadow touched') {
      e.mechanics.choice =
        'Choose INT, WIS, or CHA +1 and a qualifying 1st-level spell. Add both spells with one free long-rest use each; choose the same casting ability.';
      e.mechanics.spellFreeUses = 1;
      e.mechanics.grantedSpells = [name === 'fey touched' ? 'Misty Step' : 'Invisibility'];
      e.automation = 'partial';
    }
    if (name === 'cruel') {
      const r = newResource('Cruelty dice (d6)');
      r.id = 'cruelty';
      r.current = 2;
      r.max = 2;
      r.notes =
        'Maximum equals proficiency bonus. One die per turn; verify the current maximum when leveling.';
      e.mechanics.resources = [r];
      e.automation = 'partial';
    }
  }
  if (e.category === 'subclass' && /battle master/i.test(e.name)) {
    const r = newResource('Superiority dice (d8)');
    r.id = 'superiority';
    r.max = 4;
    r.current = 4;
    r.trigger = 'both';
    r.notes = 'Review die size and maximum as fighter levels increase.';
    e.mechanics.resources = [r];
    e.automation = 'partial';
  }
  if (e.category === 'subclass' && /hexblade/i.test(e.name)) {
    const r = newResource('Hexblade’s Curse');
    r.id = 'curse';
    r.trigger = 'both';
    e.mechanics.resources = [r];
    e.automation = 'partial';
  }
  let hash = 2166136261;
  for (const ch of JSON.stringify({
    mechanics: e.mechanics,
    description: e.description,
    metadata: e.metadata,
    ...(e.combat ? { combat: e.combat } : {}),
    dependencies: e.dependencies,
    classIds: e.classIds,
    sourceIds: e.sourceIds,
    provenance: e.provenance,
    version: e.version,
  })) {
    hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
  }
  e.revision = (e.revision || '1') + '-' + (hash >>> 0).toString(16);
  return ContentEntrySchema.parse(e);
}
// Retain additional class lists and source evidence when consolidating identical PHB/SRD spells.
for (const entry of raw as unknown as ContentEntry[]) {
  if (entry.category !== 'spell' || !entry.sourceIds.every((id) => id === 'phb')) continue;
  const srd = spells.find((s) => s.name.toLowerCase() === entry.name.toLowerCase());
  if (srd) {
    srd.classIds = [...new Set([...srd.classIds, ...entry.classIds])];
    srd.sourceIds = [...new Set([...srd.sourceIds, ...entry.sourceIds])];
    srd.provenance = [...srd.provenance, ...entry.provenance];
  }
}
const expanded = (raw as unknown as ContentEntry[]).filter(
  (e) =>
    !(
      e.category === 'spell' &&
      spells.some((s) => s.name.toLowerCase() === e.name.toLowerCase()) &&
      e.sourceIds.every((id) => id === 'phb')
    ),
);
export const catalog: ContentEntry[] = [
  ...spells,
  ...races,
  ...subraces,
  ...features,
  ...backgrounds,
  ...expanded,
]
  .map(enrich)
  .sort(
    (a, b) =>
      a.name.localeCompare(b.name) ||
      Number(b.metadata.publicationYear || 2014) - Number(a.metadata.publicationYear || 2014) ||
      b.version.localeCompare(a.version),
  );
export function toCharacterSpell(e: ContentEntry): CharacterSpell {
  return {
    id: uid(),
    favorite: false,
    combat: structuredClone(e.combat),
    contentId: e.id,
    grantSourceId: '',
    resourceId: '',
    resourceCost: 1,
    name: e.name,
    level: e.level,
    prepared: false,
    ritual: e.metadata.ritual === 'true',
    concentration: e.metadata.concentration === 'true',
    castingAbility: 'int',
    origin: e.sourceIds.map(bookName).join(', '),
    freeUses: 0,
    freeMax: 0,
    recovery: 'long',
    description: e.description,
    source: e.version,
    url: e.url,
    metadata: e.metadata,
  };
}
export const equipment = srdEquipment;
export function equipmentItem(index: string): Item {
  const e = srdEquipment.find((x) => x.index === index);
  if (!e) return newItem();
  const item = newItem(e.name);
  item.weight = 'weight' in e ? e.weight || 0 : 0;
  item.kind =
    e.equipment_category.index === 'weapon'
      ? 'weapon'
      : e.equipment_category.index === 'armor'
        ? e.index === 'shield'
          ? 'shield'
          : 'armor'
        : 'gear';
  item.equipmentId = e.index;
  if ('damage' in e && e.damage) item.combat = srdWeaponCombat(e);
  if ('armor_class' in e && e.armor_class) {
    item.armorBase = e.armor_class.base;
    item.dexCap = e.armor_class.dex_bonus ? (e.armor_class.max_bonus ?? 100) : 0;
  }
  return item;
}
