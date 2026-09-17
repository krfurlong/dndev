// Structured 2014 training facts. Choice reminders are resolved in Character → Training.
// SRD 5.1 attribution: docs/attribution.md. Artificer: Tasha's Cauldron of Everything.
const simple = ['Simple weapons'];
const martial = [...simple, 'Martial weapons'];
const light = ['Light armor'];
const medium = [...light, 'Medium armor', 'Shields'];
const heavy = [...medium, 'Heavy armor'];
const arcaneWeapons = ['Daggers', 'Darts', 'Slings', 'Quarterstaffs', 'Light crossbows'];
const druidArmor = ['Light armor (nonmetal)', 'Medium armor (nonmetal)', 'Shields (nonmetal)'];
const first: Record<string, string[]> = {
  artificer: [
    ...medium,
    ...simple,
    "Thieves' tools",
    "Tinker's tools",
    'Choose one artisan tool proficiency',
  ],
  barbarian: [...medium, ...martial],
  bard: [
    ...light,
    ...simple,
    'Hand crossbows',
    'Longswords',
    'Rapiers',
    'Shortswords',
    'Choose three musical instrument proficiencies',
  ],
  cleric: [...medium, ...simple],
  druid: [
    ...druidArmor,
    'Clubs',
    'Daggers',
    'Darts',
    'Javelins',
    'Maces',
    'Quarterstaffs',
    'Scimitars',
    'Sickles',
    'Slings',
    'Spears',
    'Herbalism kit',
  ],
  fighter: [...heavy, ...martial],
  monk: [...simple, 'Shortswords', 'Choose one artisan tool or musical instrument proficiency'],
  paladin: [...heavy, ...martial],
  ranger: [...medium, ...martial],
  rogue: [
    ...light,
    ...simple,
    'Hand crossbows',
    'Longswords',
    'Rapiers',
    'Shortswords',
    "Thieves' tools",
  ],
  sorcerer: arcaneWeapons,
  warlock: [...light, ...simple],
  wizard: arcaneWeapons,
};
const multiclass: Record<string, string[]> = {
  artificer: [...medium, "Thieves' tools", "Tinker's tools"],
  barbarian: ['Shields', ...martial],
  bard: [...light, 'Choose one skill proficiency', 'Choose one musical instrument proficiency'],
  cleric: medium,
  druid: druidArmor,
  fighter: [...medium, ...martial],
  monk: [...simple, 'Shortswords'],
  paladin: [...medium, ...martial],
  ranger: [...medium, ...martial, 'Choose one ranger skill proficiency'],
  rogue: [...light, "Thieves' tools", 'Choose one rogue skill proficiency'],
  warlock: [...light, ...simple],
};
export const classTraining = (id: string, initial: boolean): string[] => [
  ...((initial ? first : multiclass)[id] || []),
];
