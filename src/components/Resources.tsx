import { useState } from 'react';
import { Plus, Settings2 } from 'lucide-react';
import { newResource, uid, type Character, type Resource } from '../domain/model';
import type { EditCharacter } from './Inventory';
import { Button, Panel, Modal, Input, Select, TextArea, Notice, number } from './common';
export function Resources({ character, edit }: { character: Character; edit: EditCharacter }) {
  const [draft, setDraft] = useState<Resource | null>(null),
    [error, setError] = useState('');
  const resources = Object.values(character.resources);
  return (
    <>
      <Panel
        title="Resources"
        subtitle="A little magic. A second wind. What’s left in reserve."
        action={
          <Button
            variant="ghost"
            onClick={() => {
              setDraft(newResource());
              setError('');
            }}
          >
            <Plus size={16} /> Add
          </Button>
        }
      >
        <div className="resource-grid">
          {resources.map((r) => (
            <div className="resource-card" key={r.id}>
              <div className="resource-heading">
                <strong>{r.name}</strong>
                <button
                  className="icon-button"
                  aria-label={'Edit ' + r.name}
                  onClick={() => setDraft(r)}
                >
                  <Settings2 size={15} />
                </button>
              </div>
              <div className="resource-count">
                <button
                  aria-label={'Spend ' + r.name}
                  disabled={r.current === 0}
                  onClick={() =>
                    void edit((c) => {
                      c.resources[r.id].current--;
                    })
                  }
                >
                  −
                </button>
                <span>
                  {r.current}
                  <small> / {r.max}</small>
                </span>
                <button
                  aria-label={'Restore ' + r.name}
                  disabled={r.current >= r.max}
                  onClick={() =>
                    void edit((c) => {
                      c.resources[r.id].current++;
                    })
                  }
                >
                  +
                </button>
              </div>
              <div className="resource-track">
                <span
                  style={{ width: (r.max ? Math.min(100, (100 * r.current) / r.max) : 0) + '%' }}
                />
              </div>
              <small className="muted">
                {r.trigger === 'both'
                  ? 'Short or long rest'
                  : r.trigger === 'manual'
                    ? 'Manual recovery'
                    : r.trigger + ' rest'}
              </small>
            </div>
          ))}
        </div>
        {!resources.length && (
          <p className="muted">Add a custom resource, or gain class resources by leveling up.</p>
        )}
      </Panel>
      {draft && (
        <Modal title="Resource settings" onClose={() => setDraft(null)}>
          <div className="form-grid">
            <Input
              label="Resource name"
              value={draft.name}
              onChange={(name) => setDraft({ ...draft, name })}
            />
            <Input
              label="Current amount"
              type="number"
              min={0}
              value={draft.current}
              onChange={(v) => setDraft({ ...draft, current: Math.max(0, Math.floor(number(v))) })}
            />
            <Input
              label="Maximum amount"
              type="number"
              min={0}
              value={draft.max}
              onChange={(v) => setDraft({ ...draft, max: Math.max(0, Math.floor(number(v))) })}
            />
            <Select
              label="Recovery trigger"
              value={draft.trigger}
              onChange={(v) => setDraft({ ...draft, trigger: v as Resource['trigger'] })}
            >
              {['short', 'long', 'both', 'manual'].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </Select>
            <Select
              label="Recovery amount"
              value={draft.recovery}
              onChange={(v) => setDraft({ ...draft, recovery: v as Resource['recovery'] })}
            >
              <option value="full">Restore to maximum</option>
              <option value="fixed">Restore fixed amount</option>
              <option value="dice">Roll recovery dice</option>
            </Select>
            {draft.recovery !== 'full' && (
              <Input
                label={
                  draft.recovery === 'dice' ? 'Recovery dice (e.g. 1d4+1)' : 'Amount to restore'
                }
                value={draft.amount}
                onChange={(amount) => setDraft({ ...draft, amount })}
              />
            )}
          </div>
          <TextArea
            label="Resource notes"
            value={draft.notes}
            onChange={(notes) => setDraft({ ...draft, notes })}
          />
          {draft.id.startsWith('class_') && (
            <Notice>
              Class resources follow class progression. Duplicate as a custom resource to keep
              independent house-rule settings.
              <Button
                onClick={() =>
                  setDraft({ ...draft, id: uid(), sourceId: '', name: draft.name + ' (custom)' })
                }
              >
                Duplicate as custom
              </Button>
            </Notice>
          )}
          {error && <Notice tone="error">{error}</Notice>}
          <div className="dialog-actions">
            <Button onClick={() => setDraft(null)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() =>
                void edit((c) => {
                  c.resources[draft.id] = { ...draft, current: Math.min(draft.current, draft.max) };
                }, 'Edit resource')
                  .then(() => setDraft(null))
                  .catch((e) => setError(e.message))
              }
            >
              Save resource
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
