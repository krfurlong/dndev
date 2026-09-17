import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import type { Character } from '../domain/model';
import { classes, classById } from '../domain/classes';
import {
  addLevel,
  classSummary,
  levelGains,
  maxHp,
  multiclassWarnings,
  spellSlots,
  totalLevel,
} from '../domain/rules';
import { advance, type AdvancementChoices as Choices } from '../domain/progression';
import { AdvancementChoices } from './AdvancementChoices';
import { Modal, Button, Input, Select, TextArea, Notice, number } from './common';
export function LevelUp({
  character,
  onClose,
  onApply,
}: {
  character: Character;
  onClose: () => void;
  onApply: (c: Character) => Promise<void>;
}) {
  const [id, setId] = useState(Object.values(character.classes)[0]?.classId || 'fighter');
  const custom = Object.values(character.classes).filter((t) => !classById(t.classId));
  const definitions = [
    ...classes,
    ...custom.map((t) => ({ id: t.classId, name: t.name, hitDie: t.hitDie })),
  ];
  const def = definitions.find((d) => d.id === id)!;
  const [roll, setRoll] = useState(def.hitDie / 2 + 1),
    [reason, setReason] = useState(''),
    [choices, setChoices] = useState<Choices>({}),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const next = (Object.values(character.classes).find((t) => t.classId === id)?.level || 0) + 1,
    warnings = multiclassWarnings(character, id);
  let preview: Character | undefined, finalPreview: Character | undefined;
  try {
    preview = addLevel(character, id, roll, warnings.length ? 'preview' : '');
    finalPreview = advance(character, id, roll, { ...choices, override: reason || 'preview' });
  } catch {}
  async function commit() {
    setBusy(true);
    try {
      await onApply(advance(character, id, roll, { ...choices, override: reason }));
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Level up" onClose={onClose} wide>
      <p className="muted">
        {character.name} · {classSummary(character)}
      </p>
      <div className="level-banner">
        <span>{totalLevel(character)}</span>
        <ArrowUpRight />
        <span>{totalLevel(character) + 1}</span>
      </div>
      <div className="form-grid">
        <Select
          label="Advance in class"
          value={id}
          onChange={(v) => {
            setId(v);
            setRoll(definitions.find((d) => d.id === v)!.hitDie / 2 + 1);
            setChoices({});
          }}
        >
          {definitions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Input
          label={'HP roll (d' + def.hitDie + ')'}
          type="number"
          min={1}
          max={def.hitDie}
          value={roll}
          onChange={(v) => setRoll(number(v))}
        />
      </div>
      <p className="muted">
        Default uses the fixed average. Constitution is applied automatically.
      </p>
      {warnings.length > 0 && (
        <Notice tone="warning">
          <strong>Multiclass prerequisites</strong>
          <ul>
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Notice>
      )}
      <h3>
        {def.name} level {next} gains
      </h3>
      <ul className="checklist">
        {levelGains(id, next).map((g) => (
          <li key={g}>{g}</li>
        ))}
        {!levelGains(id, next).length && (
          <li>Advance class progression and review subclass or custom features.</li>
        )}
      </ul>
      {preview && (
        <AdvancementChoices
          key={id}
          character={preview}
          classId={id}
          value={choices}
          onChange={setChoices}
        />
      )}
      {finalPreview && (
        <div className="preview-rows">
          <div>
            <span>Maximum HP</span>
            <strong>
              {maxHp(character)} → {maxHp(finalPreview)}
            </strong>
          </div>
          <div>
            <span>Spell slots</span>
            <strong>
              {spellSlots(character).reduce((a, b) => a + b, 0)} →{' '}
              {spellSlots(finalPreview).reduce((a, b) => a + b, 0)}
            </strong>
          </div>
          <div>
            <span>Recorded features</span>
            <strong>
              {Object.keys(character.selections).length} →{' '}
              {Object.keys(finalPreview.selections).length}
            </strong>
          </div>
        </div>
      )}
      <TextArea label="House-rule override reason" value={reason} onChange={setReason} rows={2} />
      {error && <Notice tone="error">{error}</Notice>}
      <div className="dialog-actions">
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          disabled={!preview || busy || (warnings.length > 0 && !reason.trim())}
          onClick={() => void commit()}
        >
          Apply level {totalLevel(character) + 1}
        </Button>
      </div>
    </Modal>
  );
}
