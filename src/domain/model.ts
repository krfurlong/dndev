import { z } from 'zod';

export const abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
export type Ability = (typeof abilities)[number];
export const skills: Record<string, Ability> = {
  Acrobatics: 'dex',
  'Animal Handling': 'wis',
  Arcana: 'int',
  Athletics: 'str',
  Deception: 'cha',
  History: 'int',
  Insight: 'wis',
  Intimidation: 'cha',
  Investigation: 'int',
  Medicine: 'wis',
  Nature: 'int',
  Perception: 'wis',
  Performance: 'cha',
  Persuasion: 'cha',
  Religion: 'int',
  'Sleight of Hand': 'dex',
  Stealth: 'dex',
  Survival: 'wis',
};
export const conditions = [
  'Blinded',
  'Charmed',
  'Deafened',
  'Frightened',
  'Grappled',
  'Incapacitated',
  'Invisible',
  'Paralyzed',
  'Petrified',
  'Poisoned',
  'Prone',
  'Restrained',
  'Stunned',
  'Unconscious',
] as const;
const short = z.string().max(200);
const notes = z.string().max(30000);
const num = z.number().finite();
const integer = num.int();
const ability = z.enum(abilities);
const dictionary = <T extends z.ZodType>(value: T) =>
  z.record(
    z
      .string()
      .regex(/^[a-zA-Z0-9_ -]{1,200}$/)
      .refine((k) => !['__proto__', 'prototype', 'constructor'].includes(k)),
    value,
  );
export const ResourceSchema = z.object({
  id: short,
  name: short,
  current: integer.min(0).max(9999),
  max: integer.min(0).max(9999),
  trigger: z.enum(['short', 'long', 'both', 'manual']),
  recovery: z.enum(['full', 'fixed', 'dice']),
  amount: short,
  sourceId: short.default(''),
  notes: notes.default(''),
});
export type Resource = z.infer<typeof ResourceSchema>;
export const ClassTrackSchema = z.object({
  id: short,
  classId: short,
  name: short,
  level: integer.min(1).max(20),
  hitDie: z.union([z.literal(6), z.literal(8), z.literal(10), z.literal(12)]),
  caster: z.enum(['none', 'full', 'half', 'artificer', 'third', 'pact']),
  castingAbility: ability,
  subclass: short,
  hitDiceUsed: integer.min(0).max(20),
  hpRolls: z.array(integer.min(1).max(100)).max(20),
  customProgression: notes.default(''),
});
export type ClassTrack = z.infer<typeof ClassTrackSchema>;
export const MechanicsSchema = z.object({
  abilityBonuses: z.partialRecord(ability, num).default({}),
  skills: z.array(short).default([]),
  saves: z.array(ability).default([]),
  proficiencies: z.array(short).default([]),
  speed: num.optional(),
  hpPerLevel: num.default(0),
  acBonus: num.default(0),
  resources: z.array(ResourceSchema).default([]),
  grantedSpells: z.array(short).default([]),
  spellcastingAbility: ability.default('int'),
  spellFreeUses: integer.min(0).max(999).default(0),
  spellRecovery: z.enum(['short', 'long', 'manual']).default('long'),
  spellResourceId: short.default(''),
  spellResourceCost: integer.min(1).max(999).default(1),
  replaces: z.array(short).default([]),
  prerequisites: short.default(''),
  choice: short.default(''),
});
export type Mechanics = z.infer<typeof MechanicsSchema>;
export const ContentEntrySchema = z.object({
  id: short,
  name: short,
  category: z.enum(['class', 'subclass', 'feature', 'spell', 'race', 'feat', 'background']),
  sourceIds: z.array(short),
  version: short,
  edition: z.literal('2014'),
  url: z.string(),
  publisher: short,
  revision: short.default('1'),
  provenance: z
    .array(
      z.object({
        bookId: short,
        publisherUrl: z.string(),
        page: z.number().nullable(),
        verifiedOn: short,
      }),
    )
    .default([]),
  description: notes.default(''),
  license: z.enum(['CC-BY-4.0', 'reference']),
  automation: z.enum(['automated', 'partial', 'reference']),
  level: num.default(0),
  classIds: z.array(short).default([]),
  metadata: z.record(z.string(), z.string()).default({}),
  mechanics: MechanicsSchema,
  dependencies: z.array(short).default([]),
  supersedes: z.array(short).default([]),
});
export type ContentEntry = z.infer<typeof ContentEntrySchema>;
const SelectionSchema = ContentEntrySchema.extend({
  selectedAt: z.string(),
  active: z.boolean().default(true),
  choiceNotes: notes.default(''),
});
export type Selection = z.infer<typeof SelectionSchema>;
export const ItemSchema = z.object({
  id: short,
  name: short,
  kind: z.enum(['gear', 'weapon', 'armor', 'shield', 'consumable', 'scroll', 'treasure']),
  quantity: integer.min(0).max(99999),
  weight: num.min(0).max(99999),
  charges: integer.min(0).max(9999),
  maxCharges: integer.min(0).max(9999),
  equipped: z.boolean(),
  attuned: z.boolean(),
  container: short,
  notes: notes,
  armorBase: num.min(0).max(100),
  dexCap: num.min(-10).max(100),
  attackBonus: short,
  damage: short,
});
export type Item = z.infer<typeof ItemSchema>;
const SpellSchema = z.object({
  id: short,
  contentId: short,
  grantSourceId: short.default(''),
  resourceId: short.default(''),
  resourceCost: integer.min(1).max(999).default(1),
  name: short,
  level: integer.min(0).max(9),
  prepared: z.boolean(),
  ritual: z.boolean(),
  concentration: z.boolean(),
  castingAbility: ability,
  origin: short,
  freeUses: integer.min(0).max(999),
  freeMax: integer.min(0).max(999),
  recovery: z.enum(['short', 'long', 'manual']),
  description: notes,
  source: short,
  url: z.string(),
  metadata: z.record(z.string(), z.string()),
});
export type CharacterSpell = z.infer<typeof SpellSchema>;
export const CharacterSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  revision: integer.min(0),
  updatedAt: integer.min(0),
  name: short.min(1),
  player: short,
  race: short,
  background: short,
  alignment: short,
  xp: integer.min(0),
  abilities: z.object({
    str: num.min(1).max(99),
    dex: num.min(1).max(99),
    con: num.min(1).max(99),
    int: num.min(1).max(99),
    wis: num.min(1).max(99),
    cha: num.min(1).max(99),
  }),
  classes: dictionary(ClassTrackSchema),
  skills: z.record(z.string(), z.union([z.literal(0), z.literal(0.5), z.literal(1), z.literal(2)])),
  saves: z.array(ability),
  proficiencies: notes,
  languages: notes,
  combat: z.object({
    hp: num.min(0).max(99999),
    tempHp: num.min(0).max(99999),
    hpOverride: num.min(1).max(99999).nullable(),
    acOverride: num.min(0).max(100).nullable(),
    initiativeOverride: num.nullable(),
    speed: num.min(0).max(1000),
    deathSuccess: integer.min(0).max(3),
    deathFailure: integer.min(0).max(3),
    inspiration: z.boolean(),
    exhaustion: integer.min(0).max(6),
    conditions: z.array(short),
    concentration: short,
  }),
  currency: z.object({
    cp: integer.min(0),
    sp: integer.min(0),
    ep: integer.min(0),
    gp: integer.min(0),
    pp: integer.min(0),
  }),
  items: dictionary(ItemSchema),
  resources: dictionary(ResourceSchema),
  spells: dictionary(SpellSchema),
  selections: dictionary(SelectionSchema),
  slotsUsed: z.array(integer.min(0).max(99)).length(9),
  slotOverrides: z.array(integer.min(0).max(99)).length(9).nullable(),
  pactUsed: integer.min(0).max(99),
  attacks: notes,
  features: notes,
  biography: z.record(z.string(), notes),
  portraitId: short,
  symbolId: short,
  archived: z.boolean(),
  levelHistory: z
    .array(z.object({ at: z.string(), classId: short, level: integer, hpGain: num, notes: notes }))
    .max(500),
  overrides: z.array(z.object({ at: z.string(), reason: notes })).max(500),
});
export type Character = z.infer<typeof CharacterSchema>;
export interface Asset {
  id: string;
  characterId: string;
  kind: 'portrait' | 'symbol';
  dataUrl: string;
}
export interface Conflict {
  path: string[];
  base: unknown;
  local: unknown;
  remote: unknown;
}
export interface LocalDraft {
  key: string;
  campaign: string;
  characterId: string;
  base: Character | null;
  character: Character;
  pending: boolean;
  conflicts: Conflict[];
  error: string;
  localVersion: number;
  savedLocallyAt: number;
}
export interface HistoryEntry {
  id?: number;
  campaign: string;
  characterId: string;
  at: number;
  label: string;
  character: Character;
}
export const uid = () => crypto.randomUUID();
export function newCharacter(name = 'New adventurer'): Character {
  return CharacterSchema.parse({
    schemaVersion: 1,
    id: uid(),
    revision: 0,
    updatedAt: 0,
    name,
    player: '',
    race: '',
    background: '',
    alignment: '',
    xp: 0,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    classes: {},
    skills: {},
    saves: [],
    proficiencies: '',
    languages: '',
    combat: {
      hp: 1,
      tempHp: 0,
      hpOverride: null,
      acOverride: null,
      initiativeOverride: null,
      speed: 30,
      deathSuccess: 0,
      deathFailure: 0,
      inspiration: false,
      exhaustion: 0,
      conditions: [],
      concentration: '',
    },
    currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    items: {},
    resources: {},
    spells: {},
    selections: {},
    slotsUsed: Array(9).fill(0),
    slotOverrides: null,
    pactUsed: 0,
    attacks: '',
    features: '',
    biography: {},
    portraitId: '',
    symbolId: '',
    archived: false,
    levelHistory: [],
    overrides: [],
  });
}
export function newItem(name = 'New item'): Item {
  return {
    id: uid(),
    name,
    kind: 'gear',
    quantity: 1,
    weight: 0,
    charges: 0,
    maxCharges: 0,
    equipped: false,
    attuned: false,
    container: '',
    notes: '',
    armorBase: 10,
    dexCap: 100,
    attackBonus: '',
    damage: '',
  };
}
export function newResource(name = 'Custom resource'): Resource {
  return {
    id: uid(),
    name,
    current: 1,
    max: 1,
    trigger: 'long',
    recovery: 'full',
    amount: '0',
    sourceId: '',
    notes: '',
  };
}
export function validateCharacter(value: unknown): Character {
  const result = CharacterSchema.parse(value);
  if (new TextEncoder().encode(JSON.stringify(result)).length > 650000)
    throw new Error('Character exceeds the 650 KB limit. Export and shorten large notes.');
  if (Object.values(result.classes).reduce((n, c) => n + c.level, 0) > 20)
    throw new Error('A character may have at most 20 total levels.');
  for (const collection of [
    result.classes,
    result.items,
    result.resources,
    result.spells,
    result.selections,
  ])
    for (const [key, item] of Object.entries(collection))
      if (key !== item.id) throw new Error('Collection IDs must match their keys.');
  for (const track of Object.values(result.classes))
    if (track.hpRolls.length !== track.level || track.hitDiceUsed > track.level)
      throw new Error('Class level, HP rolls, and Hit Dice must agree.');
  return result;
}
