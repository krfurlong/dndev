import type { Character } from '../domain/model';
import { castingOptions, weaponReference } from '../domain/combat';
import type { EditCharacter } from './Inventory';
import { CastButton, FavoriteButton, SpellReference, UseItemButton } from './CombatActions';
import { Button, Empty, Panel, SourceLink } from './common';

export function Favorites({
  character,
  edit,
  onNavigate,
}: {
  character: Character;
  edit: EditCharacter;
  onNavigate: (tab: 'inventory' | 'spells') => void;
}) {
  const sort = <T extends { name: string; id: string }>(a: T, b: T) =>
    a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
  const items = Object.values(character.items)
    .filter((i) => i.favorite)
    .sort(sort);
  const spells = Object.values(character.spells)
    .filter((s) => s.favorite)
    .sort(sort);
  return (
    <Panel title="Favorites" subtitle="Your go-to equipment and spells, ready for the table.">
      {!items.length && !spells.length ? (
        <Empty
          title="Keep your next move close"
          action={
            <div className="inline">
              <Button onClick={() => onNavigate('inventory')}>Open Inventory</Button>
              <Button onClick={() => onNavigate('spells')}>Open Spells</Button>
            </div>
          }
        >
          Star equipment in Inventory or spells in Spells to see them here.
        </Empty>
      ) : (
        <div className="favorites-grid">
          {items.map((i) => (
            <article className="favorite-card" aria-label={i.name + ' favorite'} key={i.id}>
              <div className="favorite-heading">
                <h3>{i.name}</h3>
                <FavoriteButton
                  name={i.name}
                  favorite={i.favorite}
                  onToggle={() =>
                    edit((c) => {
                      if (c.items[i.id]) c.items[i.id].favorite = !c.items[i.id].favorite;
                    })
                  }
                />
              </div>
              <p className="muted">
                {[i.kind, i.equipped ? 'Equipped' : 'Not equipped', i.attuned ? 'Attuned' : '']
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <div className="combat-reference">
                {i.attackBonus && <p>Attack {i.attackBonus}</p>}
                {weaponReference(character, i).map((line, n) => (
                  <p key={n}>{line}</p>
                ))}
                {i.combat?.range && <p className="muted">{i.combat.range}</p>}
              </div>
              <p>
                Quantity {i.quantity}
                {i.maxCharges > 0 ? ' · Charges ' + i.charges + '/' + i.maxCharges : ''}
              </p>
              {(i.quantity === 0 || (i.maxCharges > 0 && i.charges === 0)) && (
                <p className="availability">
                  Unavailable · {i.quantity === 0 ? 'none remaining' : 'no charges remaining'}
                </p>
              )}
              {i.notes && (
                <details>
                  <summary>Item notes</summary>
                  <p className="reference-text">{i.notes}</p>
                </details>
              )}
              <div className="favorite-actions">
                {['consumable', 'scroll'].includes(i.kind) && (
                  <UseItemButton item={i} kind="quantity" edit={edit}>
                    Consume one
                  </UseItemButton>
                )}
                {i.maxCharges > 0 && (
                  <UseItemButton item={i} kind="charges" edit={edit}>
                    Use charge
                  </UseItemButton>
                )}
                <Button variant="ghost" onClick={() => onNavigate('inventory')}>
                  Edit in Inventory
                </Button>
              </div>
            </article>
          ))}
          {spells.map((s) => (
            <article className="favorite-card" aria-label={s.name + ' favorite'} key={s.id}>
              <div className="favorite-heading">
                <h3>{s.name}</h3>
                <FavoriteButton
                  name={s.name}
                  favorite={s.favorite}
                  onToggle={() =>
                    edit((c) => {
                      if (c.spells[s.id]) c.spells[s.id].favorite = !c.spells[s.id].favorite;
                    })
                  }
                />
              </div>
              <p className="muted">
                {s.level === 0
                  ? 'Cantrip'
                  : 'Level ' + s.level + (s.prepared ? ' · Prepared' : ' · Not prepared')}
                {s.ritual ? ' · Ritual' : ''}
                {s.concentration ? ' · Concentration' : ''}
              </p>
              <p className="muted">
                {s.origin || s.source} · {s.castingAbility.toUpperCase()}
              </p>
              <p>{[s.metadata['Casting Time'], s.metadata.Range].filter(Boolean).join(' · ')}</p>
              <SpellReference character={character} spell={s} />
              {!!s.freeMax && (
                <p>
                  Free uses {s.freeUses}/{s.freeMax}
                </p>
              )}
              {!castingOptions(character, s).length && (
                <p className="availability">Unavailable · no casting resources remaining</p>
              )}
              <details>
                <summary>Effect details & source</summary>
                <p className="reference-text">
                  {s.description ||
                    'Add a personal effect summary in Spells, or consult the source.'}
                </p>
                <SourceLink url={s.url}>{s.source || 'Personal spell'}</SourceLink>
              </details>
              <div className="favorite-actions">
                <CastButton character={character} spell={s} edit={edit} />
                <Button variant="ghost" onClick={() => onNavigate('spells')}>
                  Edit in Spells
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </Panel>
  );
}
