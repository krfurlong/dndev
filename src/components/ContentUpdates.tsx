import { useState } from 'react';
import type { Character } from '../domain/model';
import { availableUpgrades, upgradeContent, syncGrantedSpells } from '../domain/progression';
import { Modal, Button, Notice, Panel } from './common';
import type { EditCharacter } from './Inventory';
export function ContentUpdates({ character, edit }: { character: Character; edit: EditCharacter }) {
  const updates = availableUpgrades(character),
    [selected, setSelected] = useState<string>(''),
    [error, setError] = useState('');
  const upgrade = updates.find((u) => u.current.id === selected);
  if (!updates.length) return null;
  return (
    <Panel title="Content updates">
      <Notice>
        {updates.length} selected entries have a newer reviewed revision. Your current rules stay
        pinned until you approve a change.
      </Notice>
      {updates.map((u) => (
        <Button key={u.current.id} onClick={() => setSelected(u.current.id)}>
          Preview {u.current.name}
        </Button>
      ))}
      {upgrade && (
        <Modal
          title={'Review update · ' + upgrade.current.name}
          onClose={() => setSelected('')}
          wide
        >
          <p>
            {upgrade.previous.version} / {upgrade.previous.revision} → {upgrade.current.version} /{' '}
            {upgrade.current.revision}
          </p>
          <Notice tone="warning">
            This replaces the selected entry’s mechanics, including character-specific changes to
            those mechanics. Choice notes remain. A recovery checkpoint is saved first.
          </Notice>
          <div className="form-grid">
            <div>
              <h3>Current mechanics</h3>
              <pre>{JSON.stringify(upgrade.previous.mechanics, null, 2)}</pre>
            </div>
            <div>
              <h3>Reviewed mechanics</h3>
              <pre>{JSON.stringify(upgrade.current.mechanics, null, 2)}</pre>
            </div>
          </div>
          {error && <Notice tone="error">{error}</Notice>}
          <div className="dialog-actions">
            <Button onClick={() => setSelected('')}>Keep current version</Button>
            <Button
              variant="primary"
              onClick={() =>
                void edit(
                  (c) => Object.assign(c, syncGrantedSpells(upgradeContent(c, upgrade.current))),
                  'Before content upgrade',
                )
                  .then(() => setSelected(''))
                  .catch((e) => setError(e.message))
              }
            >
              Apply reviewed update
            </Button>
          </div>
        </Modal>
      )}
    </Panel>
  );
}
