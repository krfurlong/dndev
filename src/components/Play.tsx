import { useState } from 'react';
import { Heart, Shield, Zap, Footprints, Dices, Plus, Minus } from 'lucide-react';
import { abilities, conditions, skills, type Character } from '../domain/model';
import {
  ac,
  damage,
  maxHp,
  mod,
  proficiency,
  scores,
  signed,
  skillBonus,
  savingThrowBonus,
} from '../domain/rules';
import { Resources } from './Resources';
import type { EditCharacter } from './Inventory';
import { Favorites } from './Favorites';
import { Panel, Button, Input, CheckBox, number } from './common';
export function AbilityRail({ character }: { character: Character }) {
  const a = scores(character);
  return (
    <aside className="stats-rail">
      <Panel title="Abilities">
        <div className="ability-grid">
          {abilities.map((key) => (
            <div className="ability-tile" key={key}>
              <span>{key.toUpperCase()}</span>
              <strong>{signed(mod(a[key]))}</strong>
              <small>{a[key]}</small>
            </div>
          ))}
        </div>
        <div className="proficiency-line">
          <span>Proficiency bonus</span>
          <strong>{signed(proficiency(character))}</strong>
        </div>
      </Panel>
      <Panel title="Saving throws">
        <div className="skill-list">
          {abilities.map((key) => (
            <div className="stat-reference" key={key}>
              <span
                className={'proficiency-dot ' + (character.saves.includes(key) ? 'trained' : '')}
              />
              <span>{key.toUpperCase()}</span>
              <strong>{signed(savingThrowBonus(character, key))}</strong>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Skills">
        <div className="skill-list">
          {Object.entries(skills).map(([name, ability]) => (
            <div className="stat-reference" key={name}>
              <span className={'proficiency-dot ' + (character.skills[name] ? 'trained' : '')} />
              <span>{name}</span>
              <strong>{signed(skillBonus(character, name, ability))}</strong>
            </div>
          ))}
        </div>
        <div className="proficiency-line">
          <span>Passive perception</span>
          <strong>{10 + skillBonus(character, 'Perception', 'wis')}</strong>
        </div>
      </Panel>
    </aside>
  );
}
export function Play({
  character,
  edit,
  onRest,
  onNavigate,
}: {
  character: Character;
  edit: EditCharacter;
  onRest: () => void;
  onNavigate: (tab: 'inventory' | 'spells') => void;
}) {
  const [amount, setAmount] = useState(1);
  return (
    <>
      <div className="combat-grid">
        <Panel className="hp-panel" title="Hit points" action={<Heart size={19} />}>
          <div className="hp-value">
            <strong>{character.combat.hp}</strong>
            <span>/ {maxHp(character)}</span>
          </div>
          <div className="hp-track">
            <span
              style={{ width: Math.min(100, (100 * character.combat.hp) / maxHp(character)) + '%' }}
            />
          </div>
          <div className="hp-controls">
            <Button onClick={() => void edit((c) => Object.assign(c, damage(c, amount)))}>
              <Minus size={14} /> Damage
            </Button>
            <input
              aria-label="Damage or healing amount"
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(Math.max(0, number(e.target.value)))}
            />
            <Button
              onClick={() =>
                void edit((c) => {
                  c.combat.hp = Math.min(maxHp(c), c.combat.hp + amount);
                  if (c.combat.hp > 0) {
                    c.combat.deathFailure = 0;
                    c.combat.deathSuccess = 0;
                  }
                })
              }
            >
              <Plus size={14} /> Heal
            </Button>
          </div>
          <div className="form-grid small-fields">
            <Input
              label="Current HP"
              type="number"
              min={0}
              value={character.combat.hp}
              onChange={(v) =>
                void edit((c) => {
                  c.combat.hp = Math.max(0, number(v));
                })
              }
            />
            <Input
              label="Temporary HP"
              type="number"
              min={0}
              value={character.combat.tempHp}
              onChange={(v) =>
                void edit((c) => {
                  c.combat.tempHp = Math.max(0, number(v));
                })
              }
            />
          </div>
        </Panel>
        <div className="combat-metrics">
          <div className="stat-card">
            <Shield size={20} />
            <strong>{ac(character)}</strong>
            <span>Armor class</span>
          </div>
          <div className="stat-card">
            <Zap size={20} />
            <strong>
              {signed(character.combat.initiativeOverride ?? mod(scores(character).dex))}
            </strong>
            <span>Initiative</span>
          </div>
          <div className="stat-card">
            <Footprints size={20} />
            <strong>
              {character.combat.speed}
              <small> ft</small>
            </strong>
            <span>Speed</span>
          </div>
          <div className="stat-card">
            <Dices size={20} />
            <strong>
              {Object.values(character.classes).reduce((n, t) => n + t.level - t.hitDiceUsed, 0)}
            </strong>
            <span>Hit Dice left</span>
          </div>
        </div>
      </div>
      <Favorites character={character} edit={edit} onNavigate={onNavigate} />
      <Panel title="At the table" action={<Button onClick={onRest}>Take a rest</Button>}>
        <div className="inline">
          <CheckBox
            label="Inspiration"
            checked={character.combat.inspiration}
            onChange={(v) =>
              void edit((c) => {
                c.combat.inspiration = v;
              })
            }
          />
          <Input
            label="Exhaustion"
            type="number"
            min={0}
            max={6}
            value={character.combat.exhaustion}
            onChange={(v) =>
              void edit((c) => {
                c.combat.exhaustion = Math.max(0, Math.min(6, Math.floor(number(v))));
              })
            }
          />
        </div>
        <details>
          <summary>Conditions & death saves</summary>
          <div className="checkbox-grid">
            {conditions.map((cond) => (
              <CheckBox
                key={cond}
                label={cond}
                checked={character.combat.conditions.includes(cond)}
                onChange={(yes) =>
                  void edit((c) => {
                    c.combat.conditions = yes
                      ? [...c.combat.conditions, cond]
                      : c.combat.conditions.filter((x) => x !== cond);
                  })
                }
              />
            ))}
          </div>
          <div className="form-grid">
            <Input
              label="Death save successes"
              type="number"
              min={0}
              max={3}
              value={character.combat.deathSuccess}
              onChange={(v) =>
                void edit((c) => {
                  c.combat.deathSuccess = Math.max(0, Math.min(3, Math.floor(number(v))));
                })
              }
            />
            <Input
              label="Death save failures"
              type="number"
              min={0}
              max={3}
              value={character.combat.deathFailure}
              onChange={(v) =>
                void edit((c) => {
                  c.combat.deathFailure = Math.max(0, Math.min(3, Math.floor(number(v))));
                })
              }
            />
          </div>
        </details>
      </Panel>
      <Resources character={character} edit={edit} />
    </>
  );
}
