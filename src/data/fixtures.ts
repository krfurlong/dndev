import { newCharacter, newItem, newResource, type Character } from '../domain/model';
import { addLevel, applyContent, maxHp } from '../domain/rules';
import { catalog, equipmentItem, toCharacterSpell } from './catalog';
function build(name: string, classId: string, level: number): Character {
  let c = newCharacter(name);
  c.abilities = { str: 12, dex: 16, con: 14, int: 16, wis: 14, cha: 14 };
  for (let n = 0; n < level; n++) c = addLevel(c, classId);
  return c;
}
export function exampleCharacters(): Character[] {
  const starter = build('Rowan Ashford', 'fighter', 1);
  starter.player = 'Example · starting adventurer';
  starter.race = 'Human';
  starter.background = 'Soldier';
  starter.currency.gp = 15;
  starter.biography.personality =
    'Always first to offer a hand, occasionally first to start a fight.';
  const sword = equipmentItem('longsword');
  sword.equipped = true;
  sword.attackBonus = '+3';
  starter.items[sword.id] = sword;
  const ranger = build('Lyra Mosswood', 'ranger', 4);
  ranger.player = 'Example · the pathfinder';
  ranger.race = 'Wood Elf';
  ranger.background = 'Outlander';
  ranger.combat.hp = 24;
  ranger.currency.gp = 87;
  ranger.skills = { Perception: 2, Stealth: 1, Survival: 1, Nature: 1 };
  ranger.biography.backstory = 'A cartographer following a river that does not appear on any map.';
  const bow = equipmentItem('longbow');
  bow.equipped = true;
  bow.attackBonus = '+5';
  ranger.items[bow.id] = bow;
  const arrows = newItem('Arrows');
  arrows.quantity = 20;
  arrows.weight = 0.05;
  ranger.items[arrows.id] = arrows;
  const potion = newItem('Potion of healing');
  potion.kind = 'consumable';
  potion.quantity = 2;
  potion.notes = '2d4+2 HP';
  ranger.items[potion.id] = potion;
  const wizard = build('Orin Vale', 'wizard', 10);
  wizard.player = 'Example · copied character';
  wizard.race = 'High Elf';
  wizard.background = 'Sage';
  wizard.combat.hp = 48;
  for (const name of ['Fire Bolt', 'Shield', 'Misty Step', 'Fireball', 'Counterspell']) {
    const e = catalog.find((e) => e.category === 'spell' && e.name === name);
    if (e) {
      const spell = toCharacterSpell(e);
      spell.prepared = true;
      wizard.spells[spell.id] = spell;
    }
  }
  let multi = build('Mira Bellweather', 'wizard', 3);
  multi = addLevel(multi, 'bard', 5);
  multi = addLevel(multi, 'bard', 5);
  multi.player = 'Example · multiclass';
  let expanded = build('Cassian Grey', 'warlock', 4);
  expanded.player = 'Example · expanded sources';
  const hex = catalog.find((e) => e.category === 'subclass' && e.name.includes('Hexblade'));
  if (hex) expanded = applyContent(expanded, hex);
  const feat = catalog.find((e) => e.category === 'feat' && e.name === 'Fey Touched');
  if (feat) expanded = applyContent(expanded, feat);
  const custom = build('Ember Reed', 'sorcerer', 4);
  custom.player = 'Example · custom resources';
  custom.features =
    'Personal campaign ability: starlight reserve. This is a synthetic editor fixture, not published catalog content.';
  const resource = newResource('Starlight reserve');
  resource.max = 5;
  resource.current = 2;
  resource.trigger = 'short';
  resource.recovery = 'dice';
  resource.amount = '1d4';
  custom.resources[resource.id] = resource;
  return [starter, ranger, wizard, multi, expanded, custom];
}
