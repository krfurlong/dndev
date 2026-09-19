import {
  abilities,
  SpellCombatSchema,
  WeaponCombatSchema,
  type Character,
  type CharacterSpell,
  type Item,
  type SpellCombat,
} from '../domain/model';
import { catalog, equipmentItem } from '../data/catalog';
import { weaponReference } from '../domain/combat';
import { Button, Input, Select, TextArea, number } from './common';
import { SpellReference } from './CombatActions';

export function SpellCombatEditor({
  character,
  spell,
  onChange,
}: {
  character: Character;
  spell: CharacterSpell;
  onChange: (combat: SpellCombat | null) => void;
}) {
  const p = spell.combat;
  const source = catalog.find((e) => e.id === spell.contentId);
  const update = (key: keyof SpellCombat, value: unknown) => onChange({ ...p!, [key]: value });
  return (
    <section className="combat-editor">
      <h3>Combat reference</h3>
      {source?.combat && (
        <Button onClick={() => onChange(structuredClone(source.combat))}>
          Use catalog combat details
        </Button>
      )}
      <p className="muted">
        Review changes here, then save the spell to apply them. Overrides belong to this copy of the
        spell.
      </p>
      {!p ? (
        <Button onClick={() => onChange(SpellCombatSchema.parse({}))}>Add combat details</Button>
      ) : (
        <>
          <div className="form-grid">
            <Select
              label="Spell attack type"
              value={p.attack}
              onChange={(v) => update('attack', v)}
            >
              <option value="">No spell attack</option>
              <option value="melee">Melee</option>
              <option value="ranged">Ranged</option>
            </Select>
            <Select label="Target saving throw" value={p.save} onChange={(v) => update('save', v)}>
              <option value="">No saving throw</option>
              {abilities.map((a) => (
                <option key={a} value={a}>
                  {a.toUpperCase()}
                </option>
              ))}
            </Select>
            <Input
              label="Spell attack bonus override"
              type="number"
              value={p.attackOverride ?? ''}
              hint="Blank uses proficiency plus this spell’s casting ability."
              onChange={(v) => update('attackOverride', v === '' ? null : number(v))}
            />
            <Input
              label="Spell save DC override"
              type="number"
              value={p.dcOverride ?? ''}
              hint="Blank uses 8 + proficiency + this spell’s casting ability."
              onChange={(v) => update('dcOverride', v === '' ? null : number(v))}
            />
          </div>
          {p.effects.map((effect, i) => {
            const change = (key: string, v: string) =>
              update(
                'effects',
                p.effects.map((e, n) => (n === i ? { ...e, [key]: v } : e)),
              );
            return (
              <fieldset key={i}>
                <legend>Effect {i + 1}</legend>
                <div className="form-grid">
                  <Input
                    label={'Effect ' + (i + 1) + ' label'}
                    value={effect.label}
                    onChange={(v) => change('label', v)}
                  />
                  <Input
                    label={'Effect ' + (i + 1) + ' damage type'}
                    value={effect.type}
                    onChange={(v) => change('type', v)}
                  />
                  <Input
                    label={'Effect ' + (i + 1) + ' formula override'}
                    value={effect.formula}
                    hint="Use MOD only when the effect adds your casting modifier. Blank keeps catalog scaling."
                    onChange={(v) => change('formula', v)}
                  />
                </div>
                {(Object.keys(effect.bySlot).length > 0 ||
                  Object.keys(effect.byLevel).length > 0) && (
                  <details>
                    <summary>Catalog scaling</summary>
                    <p>
                      {Object.entries(effect.byLevel)
                        .map(([l, v]) => 'Character level ' + l + ': ' + v)
                        .join(' · ')}
                    </p>
                    <p>
                      {Object.entries(effect.bySlot)
                        .map(([l, v]) => 'Slot level ' + l + ': ' + v)
                        .join(' · ')}
                    </p>
                  </details>
                )}
                <Button
                  onClick={() =>
                    update(
                      'effects',
                      p.effects.filter((_, n) => n !== i),
                    )
                  }
                >
                  Remove effect {i + 1}
                </Button>
              </fieldset>
            );
          })}
          <Button
            onClick={() =>
              update('effects', [
                ...p.effects,
                SpellCombatSchema.parse({ effects: [{ label: 'Damage' }] }).effects[0],
              ])
            }
            disabled={p.effects.length >= 20}
          >
            Add damage or healing effect
          </Button>
          <TextArea
            label="Combat effect notes"
            value={p.notes}
            onChange={(v) => update('notes', v)}
          />
          <SpellReference character={character} spell={spell} />
          <Button variant="ghost" onClick={() => onChange(null)}>
            Clear combat details
          </Button>
        </>
      )}
    </section>
  );
}
export function WeaponCombatEditor({
  character,
  item,
  onChange,
}: {
  character: Character;
  item: Item;
  onChange: (combat: Item['combat']) => void;
}) {
  const p = item.combat;
  const update = (key: string, value: unknown) => onChange({ ...p!, [key]: value });
  return (
    <section className="combat-editor">
      <h3>Weapon damage</h3>
      {item.equipmentId && (
        <Button onClick={() => onChange(equipmentItem(item.equipmentId).combat)}>
          Use catalog weapon details
        </Button>
      )}
      {!p ? (
        <Button onClick={() => onChange(WeaponCombatSchema.parse({}))}>
          Configure calculated damage
        </Button>
      ) : (
        <>
          <div className="form-grid">
            <Input label="Weapon damage dice" value={p.dice} onChange={(v) => update('dice', v)} />
            <Input label="Weapon damage type" value={p.type} onChange={(v) => update('type', v)} />
            <Input
              label="Two-handed damage dice"
              value={p.versatile}
              onChange={(v) => update('versatile', v)}
            />
            <Select
              label="Weapon damage ability"
              value={p.ability}
              onChange={(v) => update('ability', v)}
            >
              <option value="auto">Standard weapon ability</option>
              {abilities.map((a) => (
                <option key={a} value={a}>
                  {a.toUpperCase()}
                </option>
              ))}
              <option value="none">No ability modifier</option>
            </Select>
            <Input
              label="Additional weapon damage bonus"
              type="number"
              value={p.bonus}
              onChange={(v) => update('bonus', number(v))}
            />
            <Input label="Weapon range" value={p.range} onChange={(v) => update('range', v)} />
            <Select
              label="Weapon properties for damage"
              value={p.finesse ? 'finesse' : p.ranged ? 'ranged' : 'melee'}
              onChange={(v) => onChange({ ...p, finesse: v === 'finesse', ranged: v === 'ranged' })}
            >
              <option value="melee">Melee / thrown melee · STR</option>
              <option value="ranged">Ranged · DEX</option>
              <option value="finesse">Finesse · better of STR / DEX</option>
            </Select>
          </div>
          <p className="muted">
            Your Damage / type text takes priority. Leave it blank to use calculated damage.
          </p>
          <div className="combat-reference">
            {weaponReference(character, item).map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
