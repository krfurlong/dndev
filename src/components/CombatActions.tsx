import { useRef, useState, type ReactNode } from 'react';
import { Star, Sparkles } from 'lucide-react';
import type { Character, CharacterSpell, Item } from '../domain/model';
import { castSpell, castingOptions, consumeItem, spellReference } from '../domain/combat';
import type { EditCharacter } from './Inventory';
import { Button, Modal, Notice, Select, SourceLink } from './common';

export function FavoriteButton({
  name,
  favorite = false,
  onToggle,
}: {
  name: string;
  favorite: boolean;
  onToggle: () => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="icon-button favorite-toggle"
      aria-label={'Favorite ' + name}
      aria-pressed={favorite}
      title={favorite ? 'Remove from favorites' : 'Add to favorites'}
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void onToggle()
          .catch(() => {})
          .finally(() => setBusy(false));
      }}
    >
      <Star size={19} fill={favorite ? 'currentColor' : 'none'} />
    </button>
  );
}
export function SpellReference({
  character,
  spell,
  level = spell.level,
}: {
  character: Character;
  spell: CharacterSpell;
  level?: number;
}) {
  const lines = spellReference(character, spell, level);
  return (
    <div className="combat-reference">
      {lines.map((line, i) => (
        <p key={i}>{line}</p>
      ))}
      {!lines.length && (
        <p className="muted">See effect details or add a personal combat reference in Spells.</p>
      )}
      {spell.combat?.notes && <p className="muted">{spell.combat.notes}</p>}
    </div>
  );
}
export function CastButton({
  character,
  spell,
  edit,
}: {
  character: Character;
  spell: CharacterSpell;
  edit: EditCharacter;
}) {
  const [open, setOpen] = useState(false),
    [slot, setSlot] = useState(''),
    [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const current = character.spells[spell.id];
  const options = current ? castingOptions(character, current) : [];
  const selected = options.find((o) => o.value === slot);
  async function cast() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await edit((c) => castSpell(c, spell.id, slot), 'Cast ' + spell.name);
      setOpen(false);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <Button
        disabled={!options.length}
        onClick={() => {
          setSlot(
            options.find((o) => o.value === 'cantrip')?.value ||
              options.find((o) => o.value === 'free')?.value ||
              options[0]?.value ||
              '',
          );
          setError('');
          setOpen(true);
        }}
      >
        <Sparkles size={14} /> Cast
      </Button>
      {open && current && (
        <Modal
          title={'Cast ' + current.name}
          onClose={() => {
            if (!inFlight.current) setOpen(false);
          }}
        >
          <p className="muted">
            {current.concentration
              ? 'This replaces your current concentration.'
              : 'Choose how to cast this spell.'}
          </p>
          <Select label="Casting resource" value={slot} onChange={setSlot}>
            <option value="">Choose a resource</option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <SpellReference
            character={character}
            spell={current}
            level={selected?.level ?? current.level}
          />
          <details>
            <summary>Effect details & source</summary>
            <p className="reference-text">
              {current.description || 'Refer to the published source or your table’s ruling.'}
            </p>
            <SourceLink url={current.url}>{current.source || 'Personal spell'}</SourceLink>
          </details>
          {error && <Notice tone="error">{error}</Notice>}
          <div className="dialog-actions">
            <Button disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={!selected || busy} onClick={() => void cast()}>
              Cast spell
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
export function UseItemButton({
  item,
  kind,
  edit,
  children,
  label,
}: {
  item: Item;
  kind: 'quantity' | 'charges';
  edit: EditCharacter;
  children: ReactNode;
  label?: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const inFlight = useRef(false);
  async function use() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await edit((c) => consumeItem(c, item.id, kind), 'Use ' + item.name);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <Button
        aria-label={label}
        disabled={busy || item.quantity < 1 || item[kind] < 1}
        onClick={() => void use()}
      >
        {children}
      </Button>
      {error && <span role="alert">{error}</span>}
    </>
  );
}
