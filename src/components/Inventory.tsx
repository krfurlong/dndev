import { useState } from 'react';
import { Plus, Minus, Package, Search } from 'lucide-react';
import { newItem, type Character, type Item } from '../domain/model';
import { equipment, equipmentItem } from '../data/catalog';
import {
  Button,
  Panel,
  Input,
  Select,
  TextArea,
  CheckBox,
  Modal,
  Empty,
  Notice,
  number,
} from './common';
export type EditCharacter = (change: (c: Character) => void, label?: string) => Promise<unknown>;
export function Inventory({ character, edit }: { character: Character; edit: EditCharacter }) {
  const [query, setQuery] = useState(''),
    [item, setItem] = useState<Item | null>(null);
  const items = Object.values(character.items).filter((i) =>
    (i.name + ' ' + i.container).toLowerCase().includes(query.toLowerCase()),
  );
  const totalWeight = Object.values(character.items).reduce((n, i) => n + i.weight * i.quantity, 0);
  return (
    <>
      <Panel
        title="Your inventory"
        subtitle="The essentials, the discoveries, and the just-in-case."
        action={
          <Button variant="primary" onClick={() => setItem(newItem())}>
            <Plus size={16} /> Add item
          </Button>
        }
      >
        <div className="inventory-toolbar">
          <div className="search-field">
            <Search size={16} />
            <input
              aria-label="Search inventory"
              placeholder="Find an item or container…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <span className="muted">{totalWeight.toFixed(1)} lb carried</span>
        </div>
        {items.length ? (
          <div className="item-list">
            {items.map((i) => (
              <div className="item-row" key={i.id}>
                <span className="item-icon">
                  <Package size={18} />
                </span>
                <button className="text-button item-title" onClick={() => setItem(i)}>
                  <strong>{i.name}</strong>
                  <small>
                    {[i.kind, i.container, i.equipped ? 'Equipped' : '', i.attuned ? 'Attuned' : '']
                      .filter(Boolean)
                      .join(' · ')}
                  </small>
                </button>
                <div className="quantity">
                  <button
                    aria-label={'Consume ' + i.name}
                    disabled={i.quantity === 0}
                    onClick={() =>
                      void edit((c) => {
                        c.items[i.id].quantity = Math.max(0, c.items[i.id].quantity - 1);
                      })
                    }
                  >
                    <Minus size={14} />
                  </button>
                  <span aria-label={i.name + ' quantity'}>{i.quantity}</span>
                  <button
                    aria-label={'Add one ' + i.name}
                    onClick={() =>
                      void edit((c) => {
                        c.items[i.id].quantity++;
                      })
                    }
                  >
                    <Plus size={14} />
                  </button>
                </div>
                {i.maxCharges > 0 && (
                  <Button
                    disabled={!i.charges}
                    onClick={() =>
                      void edit((c) => {
                        c.items[i.id].charges = Math.max(0, c.items[i.id].charges - 1);
                      })
                    }
                  >
                    Use charge {i.charges}/{i.maxCharges}
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <Empty
            title="Room for your first discovery"
            action={<Button onClick={() => setItem(newItem())}>Add equipment</Button>}
          >
            Add equipment from the SRD list or create a custom item.
          </Empty>
        )}
      </Panel>
      <Panel title="Coin purse" subtitle="Keep each denomination, just as it is at the table.">
        <div className="coin-grid">
          {(['cp', 'sp', 'ep', 'gp', 'pp'] as const).map((coin) => (
            <Input
              key={coin}
              label={coin.toUpperCase()}
              type="number"
              min={0}
              value={character.currency[coin]}
              onChange={(v) =>
                void edit((c) => {
                  c.currency[coin] = Math.max(0, Math.floor(number(v)));
                })
              }
            />
          ))}
        </div>
      </Panel>
      {item && (
        <ItemEditor
          item={item}
          onClose={() => setItem(null)}
          onSave={(i) =>
            edit((c) => {
              c.items[i.id] = i;
            }, 'Edit inventory item').then(() => {})
          }
        />
      )}
    </>
  );
}
function ItemEditor({
  item,
  onClose,
  onSave,
}: {
  item: Item;
  onClose: () => void;
  onSave: (i: Item) => Promise<void>;
}) {
  const [draft, setDraft] = useState(() => structuredClone(item)),
    [error, setError] = useState('');
  const set = (key: keyof Item, v: unknown) => setDraft({ ...draft, [key]: v });
  return (
    <Modal title="Inventory item" onClose={onClose}>
      <Select
        label="Start from SRD equipment"
        value=""
        onChange={(v) => setDraft({ ...equipmentItem(v), id: draft.id })}
      >
        <option value="">Choose an item or enter your own</option>
        {equipment.map((e) => (
          <option key={e.index} value={e.index}>
            {e.name}
          </option>
        ))}
      </Select>
      <div className="form-grid">
        <Input label="Item name" value={draft.name} onChange={(v) => set('name', v)} />
        <Select label="Item type" value={draft.kind} onChange={(v) => set('kind', v)}>
          {['gear', 'weapon', 'armor', 'shield', 'consumable', 'scroll', 'treasure'].map((k) => (
            <option key={k}>{k}</option>
          ))}
        </Select>
        <Input
          label="Quantity"
          type="number"
          min={0}
          value={draft.quantity}
          onChange={(v) => set('quantity', Math.max(0, Math.floor(number(v))))}
        />
        <Input
          label="Weight each (lb)"
          type="number"
          min={0}
          value={draft.weight}
          onChange={(v) => set('weight', Math.max(0, number(v)))}
        />
        <Input
          label="Charges remaining"
          type="number"
          min={0}
          value={draft.charges}
          onChange={(v) => set('charges', Math.max(0, Math.floor(number(v))))}
        />
        <Input
          label="Maximum charges"
          type="number"
          min={0}
          value={draft.maxCharges}
          onChange={(v) => set('maxCharges', Math.max(0, Math.floor(number(v))))}
        />
        <Input
          label="Container / location"
          value={draft.container}
          onChange={(v) => set('container', v)}
        />
      </div>
      <div className="inline">
        <CheckBox label="Equipped" checked={draft.equipped} onChange={(v) => set('equipped', v)} />
        <CheckBox label="Attuned" checked={draft.attuned} onChange={(v) => set('attuned', v)} />
      </div>
      {draft.kind === 'armor' && (
        <div className="form-grid">
          <Input
            label="Base armor class"
            type="number"
            value={draft.armorBase}
            onChange={(v) => set('armorBase', number(v))}
          />
          <Input
            label="Maximum DEX contribution (100 = unlimited)"
            type="number"
            value={draft.dexCap}
            onChange={(v) => set('dexCap', number(v))}
          />
        </div>
      )}
      {draft.kind === 'weapon' && (
        <div className="form-grid">
          <Input
            label="Attack bonus / formula"
            value={draft.attackBonus}
            onChange={(v) => set('attackBonus', v)}
          />
          <Input label="Damage / type" value={draft.damage} onChange={(v) => set('damage', v)} />
        </div>
      )}
      <TextArea label="Item notes" value={draft.notes} onChange={(v) => set('notes', v)} />
      {draft.kind === 'scroll' && (
        <Notice>
          Scrolls are consumable inventory. Add a custom rest resource if your table replenishes
          them.
        </Notice>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      <div className="dialog-actions">
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          onClick={() =>
            void onSave(draft)
              .then(onClose)
              .catch((e) => setError(e.message))
          }
        >
          Save item
        </Button>
      </div>
    </Modal>
  );
}
