import { useState } from 'react';
import { abilities, type Character } from '../domain/model';
import { catalog, bookName } from '../data/catalog';
import { classById } from '../domain/classes';
import { spellSlots, pactSlots } from '../domain/rules';
import type { AdvancementChoices as Choices } from '../domain/progression';
import { Select, Input, TextArea, Notice, CheckBox, number } from './common';
export function AdvancementChoices({
  character,
  classId,
  value,
  onChange,
  initial = false,
}: {
  character: Character;
  classId: string;
  value: Choices;
  onChange: (c: Choices) => void;
  initial?: boolean;
}) {
  const [search, setSearch] = useState(''),
    [asiMode, setAsiMode] = useState(value.featId ? 'feat' : 'ability');
  const track = Object.values(character.classes).find((t) => t.classId === classId),
    def = classById(classId);
  if (!track) return null;
  const subclasses = catalog.filter(
    (e) => e.category === 'subclass' && e.classIds.includes(classId),
  );
  const featLevel = def?.asi.includes(track.level),
    subclassNeeded = !track.subclass && track.level >= (def?.subclassLevel || 1);
  const selectedSubclass = catalog.find((e) => e.id === value.subclassId);
  const caster = /eldritch knight|arcane trickster/i.test(selectedSubclass?.name || '')
    ? 'third'
    : track.caster;
  const singleClass = {
    ...character,
    slotOverrides: null,
    classes: { [track.id]: { ...track, caster } },
  };
  const maxSpell = Math.max(
    pactSlots(singleClass).level,
    spellSlots(singleClass).findLastIndex((n) => n > 0) + 1,
    0,
  );
  const spellClass =
    caster === 'third' && ['fighter', 'rogue'].includes(classId) ? 'wizard' : classId;
  const options = catalog.filter(
    (e) =>
      e.category === 'feature' &&
      e.classIds.includes(classId) &&
      e.level <= track.level &&
      e.metadata.choiceParent,
  );
  const spells = catalog.filter(
    (e) =>
      e.category === 'spell' &&
      e.classIds.includes(spellClass) &&
      e.level <= maxSpell &&
      e.name.toLowerCase().includes(search.toLowerCase()) &&
      !Object.values(character.spells).some((s) => s.contentId === e.id),
  );
  return (
    <div className="advancement-choices">
      {subclassNeeded && (
        <Select
          label="Choose subclass"
          value={value.subclassId || ''}
          onChange={(subclassId) => onChange({ ...value, subclassId })}
        >
          <option value="">Choose later / custom</option>
          {subclasses.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {s.sourceIds.map(bookName).join(', ')}
            </option>
          ))}
        </Select>
      )}
      {featLevel && (
        <>
          <h3>Ability improvement or feat</h3>
          <div className="segmented">
            <button
              aria-pressed={asiMode === 'ability'}
              onClick={() => {
                setAsiMode('ability');
                onChange({ ...value, featId: '' });
              }}
            >
              Ability scores
            </button>
            <button
              aria-pressed={asiMode === 'feat'}
              onClick={() => {
                setAsiMode('feat');
                onChange({ ...value, abilityIncreases: {} });
              }}
            >
              Published feat
            </button>
          </div>
          {asiMode === 'ability' ? (
            <>
              <p className="muted">
                Assign two points, or leave all at zero to decide later. Maximum score 20.
              </p>
              <div className="ability-grid">
                {abilities.map((a) => (
                  <Input
                    key={a}
                    label={a.toUpperCase() + ' increase'}
                    type="number"
                    min={0}
                    max={2}
                    value={value.abilityIncreases?.[a] || 0}
                    onChange={(v) =>
                      onChange({
                        ...value,
                        abilityIncreases: {
                          ...value.abilityIncreases,
                          [a]: Math.min(2, Math.max(0, Math.floor(number(v)))),
                        },
                      })
                    }
                  />
                ))}
              </div>
            </>
          ) : (
            <Select
              label="Choose feat"
              value={value.featId || ''}
              onChange={(featId) => onChange({ ...value, featId })}
            >
              <option value="">Choose later</option>
              {catalog
                .filter((e) => e.category === 'feat')
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} · {f.sourceIds.map(bookName).join(', ')}
                  </option>
                ))}
            </Select>
          )}
        </>
      )}
      {options.length > 0 && (
        <details>
          <summary>Fighting styles & feature choices</summary>
          <p className="muted">
            Select the options granted by your class. Counts and prerequisites remain visible in the
            source reference.
          </p>
          <div className="choice-scroll">
            {options.map((e) => (
              <CheckBox
                key={e.id}
                label={e.name}
                checked={value.featureIds?.includes(e.id) || !!character.selections[e.id]?.active}
                onChange={(yes) =>
                  onChange({
                    ...value,
                    featureIds: yes
                      ? [...(value.featureIds || []), e.id]
                      : (value.featureIds || []).filter((id) => id !== e.id),
                  })
                }
              />
            ))}
          </div>
        </details>
      )}
      {caster !== 'none' && (
        <details>
          <summary>
            {initial ? 'Starting spells' : 'New spells'} · {value.spellIds?.length || 0} selected
          </summary>
          <Input label="Search eligible class spells" value={search} onChange={setSearch} />
          <p className="muted">
            Choose spells according to this class’s known/prepared rules. Multiclass slots can
            exceed the spells a particular class can learn; check the source before selecting.
          </p>
          <div className="choice-scroll">
            {spells.slice(0, 60).map((s) => (
              <CheckBox
                key={s.id}
                label={
                  s.name +
                  ' · ' +
                  (s.level ? 'Level ' + s.level : 'Cantrip') +
                  ' · ' +
                  s.sourceIds.map(bookName).join(', ')
                }
                checked={!!value.spellIds?.includes(s.id)}
                onChange={(yes) =>
                  onChange({
                    ...value,
                    spellIds: yes
                      ? [...(value.spellIds || []), s.id]
                      : (value.spellIds || []).filter((id) => id !== s.id),
                  })
                }
              />
            ))}
          </div>
        </details>
      )}
      <TextArea
        label="New choices and progression notes"
        rows={2}
        value={value.notes || ''}
        onChange={(notes) => onChange({ ...value, notes })}
      />
      <Notice>
        Flexible racial bonuses, feat spell grants, and optional replacements can be configured in
        Character → Effects & choices. Sourcebook references stay attached.
      </Notice>
    </div>
  );
}
