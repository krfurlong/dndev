import { useState } from 'react';
import { Plus, Search, Sparkles } from 'lucide-react';
import { abilities, uid, type Character, type CharacterSpell } from '../domain/model';
import { mod, scores, proficiency, spellSlots, pactSlots } from '../domain/rules';
import type { EditCharacter } from './Inventory';
import {
  Button,
  Panel,
  Modal,
  Input,
  Select,
  TextArea,
  CheckBox,
  Notice,
  Empty,
  SourceLink,
  number,
} from './common';
export function Spells({
  character,
  edit,
  onCatalog,
}: {
  character: Character;
  edit: EditCharacter;
  onCatalog: () => void;
}) {
  const [query, setQuery] = useState(''),
    [prepared, setPrepared] = useState(false),
    [draft, setDraft] = useState<CharacterSpell | null>(null),
    [cast, setCast] = useState<CharacterSpell | null>(null),
    [slot, setSlot] = useState(''),
    [error, setError] = useState('');
  const slots = spellSlots(character),
    pact = pactSlots(character),
    spells = Object.values(character.spells)
      .filter(
        (s) => (!prepared || s.prepared) && s.name.toLowerCase().includes(query.toLowerCase()),
      )
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  function custom() {
    setDraft({
      id: uid(),
      contentId: '',
      grantSourceId: '',
      resourceId: '',
      resourceCost: 1,
      name: 'Custom spell',
      level: 1,
      prepared: false,
      ritual: false,
      concentration: false,
      castingAbility: 'int',
      origin: 'Custom',
      freeUses: 0,
      freeMax: 0,
      recovery: 'long',
      description: '',
      source: 'custom',
      url: '',
      metadata: {},
    });
  }
  async function doCast() {
    if (!cast) return;
    try {
      await edit((c) => {
        const spell = c.spells[cast.id];
        if (!spell) throw new Error('Spell is no longer available.');
        if (slot === 'resource') {
          const resource = c.resources[spell.resourceId];
          if (!resource || resource.current < spell.resourceCost)
            throw new Error('Not enough resource remaining.');
          resource.current -= spell.resourceCost;
        } else if (slot === 'free') {
          if (spell.freeUses < 1) throw new Error('No free uses remain.');
          spell.freeUses--;
        } else if (slot === 'pact') {
          if (pactSlots(c).level < spell.level || c.pactUsed >= pactSlots(c).count)
            throw new Error('No qualifying Pact Magic slot remains.');
          c.pactUsed++;
        } else if (slot === 'ritual') {
          if (!spell.ritual) throw new Error('This spell is not a ritual.');
        } else if (spell.level > 0) {
          const index = Number(slot) - 1;
          if (
            !Number.isInteger(index) ||
            index < spell.level - 1 ||
            index > 8 ||
            c.slotsUsed[index] >= spellSlots(c)[index]
          )
            throw new Error('Choose an available slot.');
          c.slotsUsed[index]++;
        }
        if (spell.concentration) c.combat.concentration = spell.name;
      });
      setCast(null);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <Panel
        title="Spellcasting"
        subtitle="A little preparation goes a long way."
        action={
          <Button variant="primary" onClick={onCatalog}>
            <Plus size={16} /> Find spells
          </Button>
        }
      >
        <div className="spellcasting-stats">
          {Object.values(character.classes)
            .filter((t) => t.caster !== 'none')
            .map((t) => (
              <div key={t.id}>
                <span>
                  {t.name} · {t.castingAbility.toUpperCase()}
                </span>
                <strong>
                  DC {8 + proficiency(character) + mod(scores(character)[t.castingAbility])}
                </strong>
                <small>
                  Attack +{proficiency(character) + mod(scores(character)[t.castingAbility])}
                </small>
              </div>
            ))}
        </div>
        <div className="slot-grid">
          {slots.map(
            (max, i) =>
              max > 0 && (
                <div className="slot-group" key={i}>
                  <span>Level {i + 1}</span>
                  <div className="slot-dots">
                    {Array.from({ length: max }, (_, j) => (
                      <button
                        key={j}
                        className={j < character.slotsUsed[i] ? 'spent' : ''}
                        aria-label={
                          'Level ' +
                          (i + 1) +
                          ' slot ' +
                          (j + 1) +
                          (j < character.slotsUsed[i] ? ' expended' : ' available')
                        }
                        onClick={() =>
                          void edit((c) => {
                            c.slotsUsed[i] = j < c.slotsUsed[i] ? j : j + 1;
                          })
                        }
                      />
                    ))}
                  </div>
                  <small>
                    {Math.max(0, max - character.slotsUsed[i])} / {max} remaining
                  </small>
                </div>
              ),
          )}
          {pact.count > 0 && (
            <div className="slot-group pact">
              <span>Pact Magic · level {pact.level}</span>
              <div className="slot-dots">
                {Array.from({ length: pact.count }, (_, j) => (
                  <button
                    key={j}
                    className={j < character.pactUsed ? 'spent' : ''}
                    aria-label={'Pact slot ' + (j + 1)}
                    onClick={() =>
                      void edit((c) => {
                        c.pactUsed = j < c.pactUsed ? j : j + 1;
                      })
                    }
                  />
                ))}
              </div>
              <small>Short or long rest</small>
            </div>
          )}
        </div>
        {character.combat.concentration && (
          <Notice>
            Concentrating on <strong>{character.combat.concentration}</strong>{' '}
            <Button
              variant="ghost"
              onClick={() =>
                void edit((c) => {
                  c.combat.concentration = '';
                })
              }
            >
              End
            </Button>
          </Notice>
        )}
      </Panel>
      <Panel title="Your spellbook" action={<Button onClick={custom}>Custom spell</Button>}>
        <div className="inventory-toolbar">
          <div className="search-field">
            <Search size={16} />
            <input
              aria-label="Search your spells"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a spell…"
            />
          </div>
          <CheckBox label="Prepared only" checked={prepared} onChange={setPrepared} />
        </div>
        {spells.length ? (
          <div className="spell-list">
            {spells.map((s) => (
              <div className="spell-row" key={s.id}>
                <input
                  type="checkbox"
                  checked={s.prepared}
                  aria-label={'Prepare ' + s.name}
                  onChange={(e) =>
                    void edit((c) => {
                      c.spells[s.id].prepared = e.target.checked;
                    })
                  }
                />
                <button className="text-button spell-title" onClick={() => setDraft(s)}>
                  <strong>{s.name}</strong>
                  <small>
                    {s.level === 0 ? 'Cantrip' : 'Level ' + s.level}
                    {s.ritual ? ' · Ritual' : ''}
                    {s.concentration ? ' · Concentration' : ''} ·{' '}
                    {s.grantSourceId ? s.origin : s.source}
                  </small>
                </button>
                <span className="spell-meta">{s.metadata['Casting Time'] || ''}</span>
                <Button
                  onClick={() => {
                    setCast(s);
                    setSlot(
                      s.level === 0
                        ? 'cantrip'
                        : s.freeUses
                          ? 'free'
                          : String(
                              slots.findIndex(
                                (n, i) => i >= s.level - 1 && n > character.slotsUsed[i],
                              ) + 1,
                            ),
                    );
                    setError('');
                  }}
                >
                  <Sparkles size={14} /> Cast
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <Empty
            title="A spellbook waiting to be written"
            action={<Button onClick={onCatalog}>Browse published spells</Button>}
          >
            Choose published spells or add a custom spell with its own recovery rules.
          </Empty>
        )}
      </Panel>
      {draft && (
        <Modal title={draft.name} onClose={() => setDraft(null)}>
          <div className="form-grid">
            <Input
              label="Spell name"
              value={draft.name}
              onChange={(name) => setDraft({ ...draft, name })}
            />
            <Input
              label="Spell level"
              type="number"
              min={0}
              max={9}
              value={draft.level}
              onChange={(v) =>
                setDraft({ ...draft, level: Math.max(0, Math.min(9, Math.floor(number(v)))) })
              }
            />
            <Select
              label="Casting ability"
              value={draft.castingAbility}
              onChange={(v) =>
                setDraft({ ...draft, castingAbility: v as CharacterSpell['castingAbility'] })
              }
            >
              {abilities.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </Select>
            <Select
              label="Alternative casting resource"
              value={draft.resourceId}
              onChange={(resourceId) => setDraft({ ...draft, resourceId })}
            >
              <option value="">None</option>
              {Object.values(character.resources).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
            <Input
              label="Resource cost per cast"
              type="number"
              min={1}
              value={draft.resourceCost}
              onChange={(v) =>
                setDraft({ ...draft, resourceCost: Math.max(1, Math.floor(number(v, 1))) })
              }
            />
            <Input
              label="Origin / granting feature"
              value={draft.origin}
              onChange={(origin) => setDraft({ ...draft, origin })}
            />
            <Input
              label="Free uses remaining"
              type="number"
              min={0}
              value={draft.freeUses}
              onChange={(v) => setDraft({ ...draft, freeUses: Math.max(0, Math.floor(number(v))) })}
            />
            <Input
              label="Maximum free uses"
              type="number"
              min={0}
              value={draft.freeMax}
              onChange={(v) => setDraft({ ...draft, freeMax: Math.max(0, Math.floor(number(v))) })}
            />
            <Select
              label="Free-use recovery"
              value={draft.recovery}
              onChange={(v) => setDraft({ ...draft, recovery: v as CharacterSpell['recovery'] })}
            >
              {['short', 'long', 'manual'].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </Select>
          </div>
          <div className="inline">
            <CheckBox
              label="Ritual"
              checked={draft.ritual}
              onChange={(ritual) => setDraft({ ...draft, ritual })}
            />
            <CheckBox
              label="Concentration"
              checked={draft.concentration}
              onChange={(concentration) => setDraft({ ...draft, concentration })}
            />
          </div>
          <TextArea
            label="Spell description / personal notes"
            value={draft.description}
            onChange={(description) => setDraft({ ...draft, description })}
            rows={8}
          />
          <SourceLink url={draft.url}>Source reference · {draft.source}</SourceLink>
          <div className="dialog-actions">
            <Button onClick={() => setDraft(null)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() =>
                void edit((c) => {
                  c.spells[draft.id] = draft;
                }, 'Edit spell').then(() => setDraft(null))
              }
            >
              Save spell
            </Button>
          </div>
        </Modal>
      )}
      {cast && (
        <Modal title={'Cast ' + cast.name} onClose={() => setCast(null)}>
          <p className="muted">
            {cast.concentration
              ? 'This replaces your current concentration.'
              : 'Choose how to cast this spell.'}
          </p>
          <Select label="Casting resource" value={slot} onChange={setSlot}>
            <option value="">Choose a resource</option>
            {cast.resourceId && character.resources[cast.resourceId] && (
              <option value="resource">
                {character.resources[cast.resourceId].name} · cost {cast.resourceCost}
              </option>
            )}
            {cast.level === 0 && <option value="cantrip">Cantrip · no slot</option>}
            {cast.freeUses > 0 && <option value="free">Free use ({cast.freeUses} left)</option>}
            {cast.ritual && (
              <option value="ritual">Ritual · no slot (confirm class eligibility)</option>
            )}
            {pact.level >= cast.level && pact.count > character.pactUsed && (
              <option value="pact">Pact slot · level {pact.level}</option>
            )}
            {slots.map(
              (n, i) =>
                i >= cast.level - 1 &&
                n > character.slotsUsed[i] && (
                  <option key={i} value={String(i + 1)}>
                    Level {i + 1} slot ({n - character.slotsUsed[i]} remaining)
                  </option>
                ),
            )}
          </Select>
          {error && <Notice tone="error">{error}</Notice>}
          <div className="dialog-actions">
            <Button onClick={() => setCast(null)}>Cancel</Button>
            <Button variant="primary" disabled={!slot} onClick={() => void doCast()}>
              Cast spell
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
