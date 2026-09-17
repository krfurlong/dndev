import { useState } from 'react';
import { abilities, type Character, type Selection } from '../domain/model';
import { catalog } from '../data/catalog';
import { Modal, Button, Input, Select, Notice, TextArea, CheckBox, number } from './common';
export function EffectEditor({
  character,
  selection,
  onClose,
  onSave,
}: {
  character: Character;
  selection: Selection;
  onClose: () => void;
  onSave: (s: Selection) => Promise<void>;
}) {
  const [draft, setDraft] = useState(() => structuredClone(selection)),
    [error, setError] = useState('');
  const m = draft.mechanics;
  const update = (change: Partial<typeof m>) =>
    setDraft({ ...draft, mechanics: { ...m, ...change } });
  return (
    <Modal title={'Character effects · ' + selection.name} onClose={onClose} wide>
      <Notice>
        These effects apply to this character. Your selected sourcebook version stays attached.
        Deactivating or replacing this feature removes its derived bonuses, linked resources, and
        granted spells.
      </Notice>
      <div className="ability-grid">
        {abilities.map((a) => (
          <Input
            key={a}
            label={a.toUpperCase() + ' bonus'}
            type="number"
            value={m.abilityBonuses[a] || 0}
            onChange={(v) => update({ abilityBonuses: { ...m.abilityBonuses, [a]: number(v) } })}
          />
        ))}
      </div>
      <div className="form-grid">
        <Input
          label="HP bonus per character level"
          type="number"
          value={m.hpPerLevel}
          onChange={(v) => update({ hpPerLevel: number(v) })}
        />
        <Input
          label="AC bonus"
          type="number"
          value={m.acBonus}
          onChange={(v) => update({ acBonus: number(v) })}
        />
        <Input
          label="Skill proficiencies (comma-separated)"
          value={m.skills.join(', ')}
          onChange={(v) =>
            update({
              skills: v
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
        />
        <Input
          label="Other granted proficiencies"
          value={m.proficiencies.join(', ')}
          onChange={(v) =>
            update({
              proficiencies: v
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
        />
      </div>
      <details>
        <summary>Granted spells & casting resources</summary>
        <Input
          label="Granted spell names (comma-separated)"
          value={m.grantedSpells.join(', ')}
          onChange={(v) =>
            update({
              grantedSpells: v
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
        />
        <div className="form-grid">
          <Select
            label="Granted spell casting ability"
            value={m.spellcastingAbility}
            onChange={(v) => update({ spellcastingAbility: v as typeof m.spellcastingAbility })}
          >
            {abilities.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </Select>
          <Input
            label="Free uses per spell"
            type="number"
            min={0}
            value={m.spellFreeUses}
            onChange={(v) => update({ spellFreeUses: Math.max(0, Math.floor(number(v))) })}
          />
          <Select
            label="Granted spell recovery"
            value={m.spellRecovery}
            onChange={(v) => update({ spellRecovery: v as typeof m.spellRecovery })}
          >
            {['short', 'long', 'manual'].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
          <Select
            label="Alternative resource"
            value={m.spellResourceId}
            onChange={(v) => update({ spellResourceId: v })}
          >
            <option value="">None</option>
            {Object.values(character.resources).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
          <Input
            label="Resource cost"
            type="number"
            min={1}
            value={m.spellResourceCost}
            onChange={(v) => update({ spellResourceCost: Math.max(1, Math.floor(number(v, 1))) })}
          />
        </div>
        <p className="muted">
          Use a spell name from the library. Each grant gets independent uses and its own casting
          ability. Configure individual spells on the Spells tab for exceptions.
        </p>
      </details>
      <details>
        <summary>Replace another feature</summary>
        <p className="muted">
          A replacement deactivates the prior effect. Check the sourcebook for mutually exclusive or
          optional features.
        </p>
        <div className="choice-scroll">
          {Object.values(character.selections)
            .filter((s) => s.id !== draft.id && s.category !== 'spell')
            .map((s) => (
              <CheckBox
                key={s.id}
                label={s.name}
                checked={m.replaces.includes(s.id)}
                onChange={(yes) =>
                  update({
                    replaces: yes ? [...m.replaces, s.id] : m.replaces.filter((id) => id !== s.id),
                  })
                }
              />
            ))}
        </div>
      </details>
      <TextArea
        label="Choices and character-specific notes"
        value={draft.choiceNotes}
        onChange={(choiceNotes) => setDraft({ ...draft, choiceNotes })}
      />
      {error && <Notice tone="error">{error}</Notice>}
      <div className="dialog-actions">
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          onClick={() => {
            const unknown = m.grantedSpells.find(
              (name) =>
                !catalog.some(
                  (e) => e.category === 'spell' && e.name.toLowerCase() === name.toLowerCase(),
                ),
            );
            if (unknown) {
              setError(
                'Spell not found in the library: ' +
                  unknown +
                  '. Add custom spells on the Spells tab.',
              );
              return;
            }
            void onSave(draft)
              .then(onClose)
              .catch((e) => setError(e.message));
          }}
        >
          Save effects
        </Button>
      </div>
    </Modal>
  );
}
