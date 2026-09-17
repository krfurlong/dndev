import { useState } from 'react';
import { ArrowRight, ArrowLeft, Check, Sparkles } from 'lucide-react';
import { abilities, newCharacter, uid, type Character, type ClassTrack } from '../domain/model';
import { classes, classById } from '../domain/classes';
import {
  addLevel,
  applyContent,
  levelGains,
  maxHp,
  reconcileClassResources,
  scores,
  spellSlots,
  totalLevel,
} from '../domain/rules';
import { catalog, bookName } from '../data/catalog';
import { applyChoices, type AdvancementChoices as Choices } from '../domain/progression';
import { AdvancementChoices } from './AdvancementChoices';
import { Modal, Button, Input, Select, CheckBox, Notice, Field, number } from './common';

export function Builder({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (c: Character) => Promise<void>;
}) {
  const [choices, setChoices] = useState<Choices>({});
  const [step, setStep] = useState(0),
    [mode, setMode] = useState('guided'),
    [draft, setDraft] = useState(() => ({ ...newCharacter(), name: '' }));
  const [classId, setClassId] = useState('fighter'),
    [level, setLevel] = useState(1),
    [raceId, setRaceId] = useState(''),
    [backgroundId, setBackgroundId] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const def = classById(classId)!;
  function build(includeChoices = true) {
    let c = structuredClone(draft);
    c.name = c.name.trim() || 'Unnamed adventurer';
    for (let i = 0; i < (mode === 'existing' ? level : 1); i++) c = addLevel(c, classId);
    if (raceId)
      c = applyContent(
        c,
        catalog.find((x) => x.id === raceId)!,
      );
    if (backgroundId)
      c = applyContent(
        c,
        catalog.find((x) => x.id === backgroundId)!,
      );
    selectedSkills.forEach((s) => (c.skills[s] = 1));
    c = reconcileClassResources(c);
    if (includeChoices) c = applyChoices(c, choices);
    c.combat.hp = maxHp(c);
    return c;
  }
  const options = (category: 'race' | 'background') =>
    catalog.filter((e) => e.category === category).sort((a, b) => a.name.localeCompare(b.name));
  const canNext = step !== 0 || !!draft.name.trim();
  const next = () => {
    if (canNext) setStep((s) => s + 1);
  };
  async function finish() {
    setBusy(true);
    try {
      await onCreate(build());
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="A new chapter" onClose={onClose} wide>
      <div className="steps">
        {['Identity', 'Abilities', 'Training', 'Review'].map((s, i) => (
          <span key={s} className={step === i ? 'active' : step > i ? 'complete' : ''}>
            {step > i ? <Check size={14} /> : i + 1}
            <span>{s}</span>
          </span>
        ))}
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {step === 0 && (
        <>
          <p className="muted">
            Build an adventurer from the beginning, or bring one from another table.
          </p>
          <div className="segmented">
            <button
              aria-pressed={mode === 'guided'}
              onClick={() => {
                setMode('guided');
                setLevel(1);
              }}
            >
              Start at level 1
            </button>
            <button aria-pressed={mode === 'existing'} onClick={() => setMode('existing')}>
              Enter existing character
            </button>
          </div>
          <div className="form-grid">
            <Input
              label="Character name"
              value={draft.name}
              onChange={(name) => setDraft({ ...draft, name })}
              placeholder="What will they call you?"
            />
            <Input
              label="Player name"
              value={draft.player}
              onChange={(player) => setDraft({ ...draft, player })}
            />
            <Select
              label="Class"
              value={classId}
              onChange={(id) => {
                setClassId(id);
                setSelectedSkills([]);
              }}
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            {mode === 'existing' && (
              <Input
                label="Starting level"
                type="number"
                min={1}
                max={20}
                value={level}
                onChange={(v) => setLevel(Math.max(1, Math.min(20, number(v, 1))))}
              />
            )}
            <Select label="Race / lineage" value={raceId} onChange={setRaceId}>
              <option value="">Choose later / custom</option>
              {options('race').map((r) => (
                <option value={r.id} key={r.id}>
                  {r.name} · {r.sourceIds.map(bookName).join(', ')}
                </option>
              ))}
            </Select>
            <Select label="Background" value={backgroundId} onChange={setBackgroundId}>
              <option value="">Choose later / custom</option>
              {options('background').map((b) => (
                <option value={b.id} key={b.id}>
                  {b.name} · {b.sourceIds.map(bookName).join(', ')}
                </option>
              ))}
            </Select>
          </div>
        </>
      )}
      {step === 1 && (
        <>
          <div className="section-title">
            <div>
              <h3>Six abilities. Endless possibilities.</h3>
              <p>Enter scores before racial or selected feature adjustments.</p>
            </div>
            <Button
              onClick={() =>
                setDraft({
                  ...draft,
                  abilities: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
                })
              }
            >
              Use standard array
            </Button>
          </div>
          <div className="ability-grid builder-abilities">
            {abilities.map((a) => (
              <Input
                key={a}
                label={a.toUpperCase()}
                type="number"
                min={1}
                max={99}
                value={draft.abilities[a]}
                onChange={(v) =>
                  setDraft({
                    ...draft,
                    abilities: {
                      ...draft.abilities,
                      [a]: Math.max(1, Math.min(99, number(v, 10))),
                    },
                  })
                }
              />
            ))}
          </div>
          <Notice>
            Assign rolled scores, the standard array, or your table’s point-buy results. Published
            bonuses are shown on the final sheet; flexible choices remain editable.
          </Notice>
        </>
      )}
      {step === 2 && (
        <>
          <h3>{def.name} training</h3>
          <p className="muted">
            Choose {def.skills} class skills. Background and racial proficiencies apply separately.
          </p>
          <div className="checkbox-grid">
            {def.skillOptions.map((s) => (
              <CheckBox
                key={s}
                label={s}
                checked={selectedSkills.includes(s)}
                onChange={(yes) =>
                  setSelectedSkills(
                    yes ? [...selectedSkills, s] : selectedSkills.filter((x) => x !== s),
                  )
                }
              />
            ))}
          </div>
          {selectedSkills.length !== def.skills && (
            <Notice tone="warning">
              {selectedSkills.length} of {def.skills} selected. You can finish and adjust training
              on the sheet.
            </Notice>
          )}
          <div className="form-grid">
            <Input
              label="Languages"
              value={draft.languages}
              onChange={(languages) => setDraft({ ...draft, languages })}
            />
            <Input
              label="Other proficiencies"
              value={draft.proficiencies}
              onChange={(proficiencies) => setDraft({ ...draft, proficiencies })}
            />
            <Input
              label="Alignment"
              value={draft.alignment}
              onChange={(alignment) => setDraft({ ...draft, alignment })}
            />
          </div>
          <AdvancementChoices
            character={build(false)}
            classId={classId}
            value={choices}
            onChange={setChoices}
            initial
          />
          <Notice>Add your starting equipment from the SRD list on the Inventory tab.</Notice>
        </>
      )}
      {step === 3 &&
        (() => {
          let c: Character;
          try {
            c = build();
          } catch (e) {
            return (
              <Notice tone="error">{(e as Error).message} Go back to adjust your choices.</Notice>
            );
          }
          return (
            <>
              <div className="builder-summary">
                <div className="avatar">
                  <Sparkles size={30} />
                </div>
                <h3>{c.name}</h3>
                <p>
                  {def.name} · Level {totalLevel(c)}
                </p>
                <div className="metric-grid">
                  <div>
                    <strong>{maxHp(c)}</strong>
                    <span>Hit points</span>
                  </div>
                  <div>
                    <strong>d{def.hitDie}</strong>
                    <span>Hit Die</span>
                  </div>
                  <div>
                    <strong>{spellSlots(c).reduce((a, b) => a + b, 0)}</strong>
                    <span>Spell slots</span>
                  </div>
                </div>
              </div>
              <h3>Ready for the next step</h3>
              <ul className="checklist">
                <li>Review features and choose a subclass when eligible.</li>
                <li>Add starting equipment, spells, and any flexible sourcebook choices.</li>
                <li>
                  {mode === 'existing'
                    ? 'Copy current HP, inventory, notes, and custom values directly into the sheet.'
                    : 'Use Level up from the action menu to advance with a preview.'}
                </li>
              </ul>
              <p className="muted">
                Every change is saved on this device. Cloud saves are available when you join your
                campaign.
              </p>
            </>
          );
        })()}
      <div className="dialog-actions">
        <Button onClick={step ? () => setStep(step - 1) : onClose}>
          {step ? (
            <>
              <ArrowLeft size={16} /> Back
            </>
          ) : (
            'Cancel'
          )}
        </Button>
        {step < 3 ? (
          <Button variant="primary" onClick={next} disabled={!canNext}>
            Continue <ArrowRight size={16} />
          </Button>
        ) : (
          <Button variant="primary" onClick={() => void finish()} disabled={busy}>
            {busy ? 'Creating…' : 'Create character'} <Check size={16} />
          </Button>
        )}
      </div>
    </Modal>
  );
}
