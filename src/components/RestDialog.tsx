import { useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import type { Character } from '../domain/model';
import { applyRest, maxHp, mod, restPreview, rollDice, scores, totalLevel } from '../domain/rules';
import { Modal, Button, Input, CheckBox, Notice, number } from './common';
export function RestDialog({
  character,
  onClose,
  onApply,
}: {
  character: Character;
  onClose: () => void;
  onApply: (c: Character, label: string) => Promise<void>;
}) {
  const [type, setType] = useState<'short' | 'long'>('short'),
    [preview, setPreview] = useState(() => restPreview(character, 'short')),
    [override, setOverride] = useState(false),
    [error, setError] = useState(''),
    [rolls, setRolls] = useState<string[]>([]);
  const tracks = Object.values(character.classes);
  const recovered = tracks.reduce(
    (n, t) => n + Math.max(0, t.hitDiceUsed - preview.hitDiceUsed[t.id]),
    0,
  );
  const allowance = Math.max(1, Math.floor(totalLevel(character) / 2));
  const exceeds = type === 'long' && recovered > allowance;
  function spend(id: string) {
    const t = character.classes[id];
    if (preview.hitDiceUsed[id] >= t.level) return;
    const roll = rollDice('1d' + t.hitDie),
      heal = Math.max(0, roll.total + mod(scores(character).con));
    setRolls([...rolls, t.name + ': ' + roll.total + ' + CON = ' + heal + ' HP']);
    setPreview({
      ...preview,
      hp: Math.min(maxHp(character), preview.hp + heal),
      hitDiceUsed: { ...preview.hitDiceUsed, [id]: preview.hitDiceUsed[id] + 1 },
    });
  }
  async function commit() {
    try {
      if (exceeds && !override)
        throw new Error('Adjust recovered Hit Dice or enable a house-rule override.');
      const next = applyRest(character, preview);
      if (override)
        next.overrides.push({
          at: new Date().toISOString(),
          reason: 'Customized ' + type + ' rest recovery',
        });
      await onApply(next, (type === 'short' ? 'Short' : 'Long') + ' rest');
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Modal title="Take a breath" onClose={onClose}>
      <div className="segmented">
        <button
          aria-pressed={type === 'short'}
          onClick={() => {
            setType('short');
            setPreview(restPreview(character, 'short'));
            setRolls([]);
          }}
        >
          <Sun size={16} /> Short rest
        </button>
        <button
          aria-pressed={type === 'long'}
          onClick={() => {
            setType('long');
            setPreview(restPreview(character, 'long'));
            setRolls([]);
          }}
        >
          <Moon size={16} /> Long rest
        </button>
      </div>
      {preview.notes.map((n) => (
        <p className="muted" key={n}>
          {n}
        </p>
      ))}
      <div className="form-grid">
        <Input
          label="HP after rest"
          type="number"
          min={0}
          max={maxHp(character)}
          value={preview.hp}
          onChange={(v) => setPreview({ ...preview, hp: number(v) })}
        />
        <Input
          label="Temporary HP after rest"
          type="number"
          min={0}
          value={preview.tempHp}
          onChange={(v) => setPreview({ ...preview, tempHp: number(v) })}
        />
        <Input
          label="Exhaustion after rest"
          type="number"
          min={0}
          max={6}
          value={preview.exhaustion}
          onChange={(v) => setPreview({ ...preview, exhaustion: number(v) })}
        />
      </div>
      <h3>Hit Dice</h3>
      {tracks.map((t) => (
        <div className="rest-row" key={t.id}>
          <span>
            {t.name} · d{t.hitDie}
          </span>
          {type === 'short' ? (
            <Button onClick={() => spend(t.id)} disabled={preview.hitDiceUsed[t.id] >= t.level}>
              Spend 1 ({t.level - preview.hitDiceUsed[t.id]} left)
            </Button>
          ) : (
            <Input
              label={t.name + ' dice used after rest'}
              type="number"
              min={0}
              max={t.level}
              value={preview.hitDiceUsed[t.id]}
              onChange={(v) =>
                setPreview({
                  ...preview,
                  hitDiceUsed: { ...preview.hitDiceUsed, [t.id]: number(v) },
                })
              }
            />
          )}
        </div>
      ))}
      {rolls.map((r, i) => (
        <p className="roll-line" key={i}>
          {r}
        </p>
      ))}
      {type === 'long' && (
        <p className="muted">
          {recovered} of {allowance} Hit Dice recovered.
        </p>
      )}
      <h3>Resources</h3>
      <div className="form-grid">
        {Object.values(character.resources).map((r) => (
          <Input
            key={r.id}
            label={r.name + ' (was ' + r.current + '/' + r.max + ')'}
            type="number"
            min={0}
            max={r.max}
            value={preview.resources[r.id]}
            onChange={(v) =>
              setPreview({ ...preview, resources: { ...preview.resources, [r.id]: number(v) } })
            }
          />
        ))}
      </div>
      <details>
        <summary>Customize spell recovery</summary>
        <div className="form-grid">
          {preview.slotsUsed.map((used, i) => (
            <Input
              key={i}
              label={'Level ' + (i + 1) + ' slots used'}
              type="number"
              min={0}
              value={used}
              onChange={(v) =>
                setPreview({
                  ...preview,
                  slotsUsed: preview.slotsUsed.map((n, j) => (i === j ? number(v) : n)),
                })
              }
            />
          ))}
          <Input
            label="Pact slots used"
            type="number"
            min={0}
            value={preview.pactUsed}
            onChange={(v) => setPreview({ ...preview, pactUsed: number(v) })}
          />
          {Object.values(character.spells)
            .filter((s) => s.freeMax > 0)
            .map((s) => (
              <Input
                key={s.id}
                label={s.name + ' free uses remaining'}
                type="number"
                min={0}
                max={s.freeMax}
                value={preview.freeUses[s.id]}
                onChange={(v) =>
                  setPreview({ ...preview, freeUses: { ...preview.freeUses, [s.id]: number(v) } })
                }
              />
            ))}
        </div>
      </details>
      <CheckBox
        label="Use a house-rule recovery override"
        checked={override}
        onChange={setOverride}
      />
      {exceeds && !override && (
        <Notice tone="warning">
          This recovers more Hit Dice than the standard long-rest allowance.
        </Notice>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      <div className="dialog-actions">
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={() => void commit()} disabled={exceeds && !override}>
          Complete {type} rest
        </Button>
      </div>
    </Modal>
  );
}
