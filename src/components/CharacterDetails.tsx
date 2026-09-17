import { useState } from 'react';
import { Plus, BookOpen, ArrowUpRight, Settings2 } from 'lucide-react';
import {
  abilities,
  skills,
  uid,
  type Character,
  type ClassTrack,
  type Selection,
} from '../domain/model';
import { classById } from '../domain/classes';
import {
  maxHp,
  mod,
  proficiency,
  scores,
  skillBonus,
  totalLevel,
  reconcileClassResources,
  reconcileSelectionEffects,
} from '../domain/rules';
import { EffectEditor } from './EffectEditor';
import { ContentUpdates } from './ContentUpdates';
import { syncGrantedSpells, availableUpgrades, upgradeContent } from '../domain/progression';
import type { EditCharacter } from './Inventory';
import {
  Panel,
  Button,
  Input,
  Select,
  CheckBox,
  TextArea,
  Modal,
  Notice,
  SourceLink,
  Pill,
  number,
} from './common';
export function CharacterDetails({
  character,
  edit,
  onCatalog,
  onLevel,
}: {
  character: Character;
  edit: EditCharacter;
  onCatalog: () => void;
  onLevel: () => void;
}) {
  const [selection, setSelection] = useState<Selection | null>(null),
    [track, setTrack] = useState<ClassTrack | null>(null);
  return (
    <>
      <ContentUpdates character={character} edit={edit} />
      <Panel
        title="Character details"
        subtitle="The person behind the numbers."
        action={
          <Button onClick={onCatalog}>
            <BookOpen size={16} /> Published options
          </Button>
        }
      >
        <div className="form-grid">
          <Input
            label="Character name"
            value={character.name}
            onChange={(v) =>
              void edit((c) => {
                c.name = v || 'Unnamed adventurer';
              })
            }
          />
          <Input
            label="Player name"
            value={character.player}
            onChange={(v) =>
              void edit((c) => {
                c.player = v;
              })
            }
          />
          <Input
            label="Race / lineage"
            value={character.race}
            onChange={(v) =>
              void edit((c) => {
                c.race = v;
              })
            }
          />
          <Input
            label="Background"
            value={character.background}
            onChange={(v) =>
              void edit((c) => {
                c.background = v;
              })
            }
          />
          <Input
            label="Alignment"
            value={character.alignment}
            onChange={(v) =>
              void edit((c) => {
                c.alignment = v;
              })
            }
          />
          <Input
            label="Experience points"
            type="number"
            min={0}
            value={character.xp}
            onChange={(v) =>
              void edit((c) => {
                c.xp = Math.max(0, Math.floor(number(v)));
              })
            }
          />
        </div>
      </Panel>
      <Panel
        title="Classes & progression"
        action={
          <Button variant="primary" onClick={onLevel}>
            <ArrowUpRight size={16} /> Level up
          </Button>
        }
      >
        {Object.values(character.classes).map((t) => (
          <div className="class-row" key={t.id}>
            <div>
              <strong>
                {t.name} <span className="muted">Level {t.level}</span>
              </strong>
              <small>
                {t.subclass || 'Subclass not selected'} · d{t.hitDie} Hit Die
              </small>
            </div>
            <Button onClick={() => setTrack(t)}>Edit track</Button>
          </div>
        ))}
        <Button
          variant="ghost"
          onClick={() =>
            setTrack({
              id: uid(),
              classId: 'custom_' + uid(),
              name: 'Custom class',
              level: 1,
              hitDie: 8,
              caster: 'none',
              castingAbility: 'int',
              subclass: '',
              hitDiceUsed: 0,
              hpRolls: [8],
              customProgression: '',
            })
          }
        >
          <Plus size={15} /> Add custom class
        </Button>
      </Panel>
      <Panel
        title="Abilities & training"
        subtitle="Base values stay separate from selected feature bonuses."
      >
        <div className="ability-grid">
          {abilities.map((a) => (
            <Input
              label={a.toUpperCase() + ' base'}
              key={a}
              type="number"
              min={1}
              max={99}
              value={character.abilities[a]}
              onChange={(v) =>
                void edit((c) => {
                  c.abilities[a] = Math.max(1, Math.min(99, number(v, 10)));
                  Object.assign(c, reconcileClassResources(c));
                })
              }
            />
          ))}
        </div>
        <div className="inline">
          {abilities.map((a) => (
            <CheckBox
              key={a}
              label={a.toUpperCase() + ' save'}
              checked={character.saves.includes(a)}
              onChange={(yes) =>
                void edit((c) => {
                  c.saves = yes ? [...c.saves, a] : c.saves.filter((x) => x !== a);
                })
              }
            />
          ))}
        </div>
        <details>
          <summary>Skill training</summary>
          <div className="form-grid">
            {Object.entries(skills).map(([name, a]) => (
              <Select
                key={name}
                label={
                  name +
                  ' (' +
                  (skillBonus(character, name, a) >= 0 ? '+' : '') +
                  skillBonus(character, name, a) +
                  ')'
                }
                value={String(character.skills[name] || 0)}
                onChange={(v) =>
                  void edit((c) => {
                    c.skills[name] = Number(v) as 0 | 0.5 | 1 | 2;
                  })
                }
              >
                <option value="0">Untrained</option>
                <option value="0.5">Half proficiency</option>
                <option value="1">Proficient</option>
                <option value="2">Expertise</option>
              </Select>
            ))}
          </div>
        </details>
        <div className="form-grid">
          <TextArea
            label="Languages"
            value={character.languages}
            onChange={(v) =>
              void edit((c) => {
                c.languages = v;
              })
            }
          />
          <TextArea
            label="Other proficiencies"
            value={character.proficiencies}
            onChange={(v) =>
              void edit((c) => {
                c.proficiencies = v;
              })
            }
          />
        </div>
        {Object.values(character.selections)
          .filter((s) => s.active && s.mechanics.proficiencies.length)
          .map((s) => (
            <p className="muted" key={s.id}>
              {s.name}: {s.mechanics.proficiencies.join(', ')}
            </p>
          ))}
      </Panel>
      <Panel
        title="Features & choices"
        subtitle="Your selections retain their sourcebook version."
        action={
          <Button onClick={onCatalog}>
            <Plus size={16} /> Add published
          </Button>
        }
      >
        {Object.values(character.selections)
          .filter((s) => s.category !== 'spell')
          .map((s) => (
            <details className="feature" key={s.id}>
              <summary>
                <span>{s.name}</span>
                <Pill>{s.version}</Pill>
                {!s.active && <Pill>Replaced / inactive</Pill>}
              </summary>
              <p className="muted">
                {s.publisher} ·{' '}
                {s.automation === 'reference'
                  ? 'Configure sheet effects manually'
                  : s.automation + ' sheet effects'}
              </p>
              {s.description && <p className="description">{s.description}</p>}
              {s.choiceNotes && <p>{s.choiceNotes}</p>}
              {s.mechanics.choice && <Notice>{s.mechanics.choice}</Notice>}
              <div className="inline">
                <SourceLink url={s.url}>Source reference</SourceLink>
                <Button onClick={() => setSelection(s)}>
                  <Settings2 size={14} /> Effects & choices
                </Button>
                <CheckBox
                  label="Active"
                  checked={s.active}
                  onChange={(active) =>
                    void edit((c) => {
                      c.selections[s.id].active = active;
                      Object.assign(c, syncGrantedSpells(reconcileSelectionEffects(c)));
                    })
                  }
                />
              </div>
            </details>
          ))}
        <TextArea
          label="Custom features & traits"
          value={character.features}
          onChange={(v) =>
            void edit((c) => {
              c.features = v;
            })
          }
          rows={5}
        />
      </Panel>
      <Panel title="Calculated value overrides" subtitle="Leave blank to use the calculated value.">
        <div className="form-grid">
          <Input
            label={
              'Maximum HP override (calculated ' +
              maxHp({ ...character, combat: { ...character.combat, hpOverride: null } }) +
              ')'
            }
            type="number"
            min={1}
            value={character.combat.hpOverride ?? ''}
            onChange={(v) =>
              void edit((c) => {
                c.combat.hpOverride = v === '' ? null : Math.max(1, number(v));
              })
            }
          />
          <Input
            label="AC override"
            type="number"
            min={0}
            value={character.combat.acOverride ?? ''}
            onChange={(v) =>
              void edit((c) => {
                c.combat.acOverride = v === '' ? null : number(v);
              })
            }
          />
          <Input
            label="Initiative override"
            type="number"
            value={character.combat.initiativeOverride ?? ''}
            onChange={(v) =>
              void edit((c) => {
                c.combat.initiativeOverride = v === '' ? null : number(v);
              })
            }
          />
          <Input
            label="Speed (ft)"
            type="number"
            min={0}
            value={character.combat.speed}
            onChange={(v) =>
              void edit((c) => {
                c.combat.speed = Math.max(0, number(v));
              })
            }
          />
        </div>
        <details>
          <summary>Custom spell slot progression</summary>
          <CheckBox
            label="Override calculated spell slots"
            checked={!!character.slotOverrides}
            onChange={(yes) =>
              void edit((c) => {
                c.slotOverrides = yes ? Array(9).fill(0) : null;
              })
            }
          />
          {character.slotOverrides && (
            <div className="form-grid">
              {character.slotOverrides.map((n, i) => (
                <Input
                  key={i}
                  label={'Level ' + (i + 1) + ' slot maximum'}
                  type="number"
                  min={0}
                  max={99}
                  value={n}
                  onChange={(v) =>
                    void edit((c) => {
                      c.slotOverrides![i] = Math.max(0, Math.min(99, Math.floor(number(v))));
                    })
                  }
                />
              ))}
            </div>
          )}
        </details>
      </Panel>
      <Panel title="Level history">
        {[...character.levelHistory].reverse().map((h, i) => (
          <div className="history-row" key={i}>
            <strong>
              {h.classId} {h.level}
            </strong>
            <span>
              +{h.hpGain} HP · {new Date(h.at).toLocaleDateString()}
            </span>
            <p>{h.notes}</p>
          </div>
        ))}
      </Panel>
      {selection && (
        <EffectEditor
          character={character}
          selection={selection}
          onClose={() => setSelection(null)}
          onSave={(s) =>
            edit((c) => {
              c.selections[s.id] = s;
              for (const id of s.mechanics.replaces)
                if (c.selections[id]) c.selections[id].active = false;
              Object.assign(c, syncGrantedSpells(reconcileSelectionEffects(c)));
            }, 'Adjust feature effects').then(() => {})
          }
        />
      )}
      {track && (
        <TrackEditor
          character={character}
          track={track}
          onClose={() => setTrack(null)}
          onSave={(t) =>
            edit((c) => {
              c.classes[t.id] = t;
              c.combat.hp = Math.min(c.combat.hp, maxHp(c));
              Object.assign(c, reconcileClassResources(c));
            }, 'Edit class progression').then(() => {})
          }
        />
      )}
    </>
  );
}
function TrackEditor({
  character,
  track,
  onClose,
  onSave,
}: {
  character: Character;
  track: ClassTrack;
  onClose: () => void;
  onSave: (t: ClassTrack) => Promise<void>;
}) {
  const [draft, setDraft] = useState(() => structuredClone(track)),
    [error, setError] = useState('');
  const updateLevel = (v: number) => {
    const level = Math.max(1, Math.min(20, Math.floor(v)));
    setDraft({
      ...draft,
      level,
      hpRolls: Array.from({ length: level }, (_, i) => draft.hpRolls[i] ?? draft.hitDie / 2 + 1),
      hitDiceUsed: Math.min(draft.hitDiceUsed, level),
    });
  };
  return (
    <Modal title="Class track" onClose={onClose}>
      <Notice>
        Direct editing supports imported and custom characters. Use Level up for a guided
        advancement preview.
      </Notice>
      <div className="form-grid">
        <Input
          label="Class name"
          value={draft.name}
          onChange={(name) => setDraft({ ...draft, name })}
        />
        <Input
          label="Class level"
          type="number"
          min={1}
          max={20}
          value={draft.level}
          onChange={(v) => updateLevel(number(v, 1))}
        />
        <Select
          label="Hit Die"
          value={String(draft.hitDie)}
          onChange={(v) => setDraft({ ...draft, hitDie: Number(v) as ClassTrack['hitDie'] })}
        >
          {[6, 8, 10, 12].map((d) => (
            <option key={d} value={d}>
              d{d}
            </option>
          ))}
        </Select>
        <Input
          label="Hit Dice spent"
          type="number"
          min={0}
          max={draft.level}
          value={draft.hitDiceUsed}
          onChange={(v) =>
            setDraft({
              ...draft,
              hitDiceUsed: Math.max(0, Math.min(draft.level, Math.floor(number(v)))),
            })
          }
        />
        <Select
          label="Spellcasting progression"
          value={draft.caster}
          onChange={(v) => setDraft({ ...draft, caster: v as ClassTrack['caster'] })}
        >
          {['none', 'full', 'half', 'third', 'artificer', 'pact'].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </Select>
        <Select
          label="Spellcasting ability"
          value={draft.castingAbility}
          onChange={(v) =>
            setDraft({ ...draft, castingAbility: v as ClassTrack['castingAbility'] })
          }
        >
          {abilities.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </Select>
        <Input
          label="Subclass"
          value={draft.subclass}
          onChange={(subclass) => setDraft({ ...draft, subclass })}
        />
      </div>
      <Input
        label="HP rolls by level, before Constitution (comma-separated)"
        value={draft.hpRolls.join(', ')}
        onChange={(v) => {
          const rolls = v.split(',').map((x) => Math.max(1, Math.min(100, number(x, 1))));
          setDraft({ ...draft, hpRolls: rolls });
        }}
      />
      <TextArea
        label="Custom level progression and feature notes"
        value={draft.customProgression}
        onChange={(customProgression) => setDraft({ ...draft, customProgression })}
      />
      {error && <Notice tone="error">{error}</Notice>}
      <div className="dialog-actions">
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          onClick={() => {
            if (draft.hpRolls.length !== draft.level) {
              setError('Enter exactly one HP roll for each class level.');
              return;
            }
            void onSave(draft)
              .then(onClose)
              .catch((e) => setError(e.message));
          }}
        >
          Save class track
        </Button>
      </div>
    </Modal>
  );
}
