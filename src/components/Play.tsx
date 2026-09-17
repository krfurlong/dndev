import { useState } from 'react';
import { Heart, Shield, Zap, Footprints, Dices, Plus, Minus } from 'lucide-react';
import { abilities, conditions, skills, type Character } from '../domain/model';
import {
  ac,
  damage,
  maxHp,
  mod,
  proficiency,
  rollDice,
  scores,
  signed,
  skillBonus,
  savingThrowBonus,
} from '../domain/rules';
import { Resources } from './Resources';
import type { EditCharacter } from './Inventory';
import { Panel, Button, Input, TextArea, CheckBox, Modal, Notice, number } from './common';
export function AbilityRail({
  character,
  onRoll,
}: {
  character: Character;
  onRoll: (label: string, bonus: number) => void;
}) {
  const a = scores(character);
  return (
    <aside className="stats-rail">
      <Panel title="Abilities">
        <div className="ability-grid">
          {abilities.map((key) => (
            <button
              className="ability-tile"
              key={key}
              onClick={() => onRoll(key.toUpperCase() + ' check', mod(a[key]))}
            >
              <span>{key.toUpperCase()}</span>
              <strong>{signed(mod(a[key]))}</strong>
              <small>{a[key]}</small>
            </button>
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
            <button
              key={key}
              onClick={() => onRoll(key.toUpperCase() + ' save', savingThrowBonus(character, key))}
            >
              <span
                className={'proficiency-dot ' + (character.saves.includes(key) ? 'trained' : '')}
              />
              <span>{key.toUpperCase()}</span>
              <strong>{signed(savingThrowBonus(character, key))}</strong>
            </button>
          ))}
        </div>
      </Panel>
      <Panel title="Skills">
        <div className="skill-list">
          {Object.entries(skills).map(([name, ability]) => (
            <button key={name} onClick={() => onRoll(name, skillBonus(character, name, ability))}>
              <span className={'proficiency-dot ' + (character.skills[name] ? 'trained' : '')} />
              <span>{name}</span>
              <strong>{signed(skillBonus(character, name, ability))}</strong>
            </button>
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
}: {
  character: Character;
  edit: EditCharacter;
  onRest: () => void;
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
      <Panel title="Attacks & actions" subtitle="Keep your go-to moves close.">
        {Object.values(character.items)
          .filter((i) => i.kind === 'weapon' && i.equipped)
          .map((i) => (
            <div className="preview-rows" key={i.id}>
              <div>
                <span>{i.name}</span>
                <strong>
                  {i.attackBonus || 'Set attack bonus in Inventory'} · {i.damage}
                </strong>
              </div>
            </div>
          ))}
        <TextArea
          label="Attacks, spellcasting & action notes"
          rows={4}
          value={character.attacks}
          onChange={(v) =>
            void edit((c) => {
              c.attacks = v;
            })
          }
        />
      </Panel>
    </>
  );
}
export function DiceDialog({
  label,
  bonus,
  onClose,
}: {
  label: string;
  bonus: number;
  onClose: () => void;
}) {
  const [formula, setFormula] = useState('1d20' + signed(bonus)),
    [result, setResult] = useState(() => rollDice('1d20' + signed(bonus))),
    [error, setError] = useState('');
  function roll() {
    try {
      setResult(rollDice(formula));
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Modal title={label} onClose={onClose}>
      <div className="dice-result">
        <Dices size={24} />
        <strong>{result.total}</strong>
        <span>Dice: {result.rolls.join(', ')}</span>
      </div>
      <Input label="Dice formula" value={formula} onChange={setFormula} />
      {error && <Notice tone="error">{error}</Notice>}
      <div className="dialog-actions">
        <Button onClick={onClose}>Done</Button>
        <Button variant="primary" onClick={roll}>
          Roll again
        </Button>
      </div>
    </Modal>
  );
}
