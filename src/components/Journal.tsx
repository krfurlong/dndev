import { useState } from 'react';
import { ImagePlus, BookHeart } from 'lucide-react';
import { uid, type Character } from '../domain/model';
import { db, draftKey } from '../storage/database';
import { compressImage } from '../storage/backup';
import { useQuery } from '../hooks';
import type { EditCharacter } from './Inventory';
import { Panel, Input, TextArea, Notice } from './common';
export function Journal({
  character,
  edit,
  campaign,
}: {
  character: Character;
  edit: EditCharacter;
  campaign: string;
}) {
  const [error, setError] = useState('');
  const { value: assets } = useQuery(
    () => db.assets.where('campaign').equals(campaign).toArray(),
    [campaign, character.id],
    [],
  );
  async function upload(file: File | undefined, kind: 'portrait' | 'symbol') {
    if (!file) return;
    try {
      const dataUrl = await compressImage(file),
        id = uid();
      await db.assets.put({
        key: draftKey(campaign, id),
        campaign,
        id,
        characterId: character.id,
        kind,
        dataUrl,
        pending: true,
      });
      await edit((c) => {
        if (kind === 'portrait') c.portraitId = id;
        else c.symbolId = id;
      });
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const bio = (key: string, label: string, rows = 4) => (
    <TextArea
      key={key}
      label={label}
      value={character.biography[key] || ''}
      onChange={(v) =>
        void edit((c) => {
          c.biography[key] = v;
        })
      }
      rows={rows}
    />
  );
  return (
    <>
      <Panel
        title="A story worth remembering"
        subtitle="The details that make this character yours."
      >
        <div className="portrait-layout">
          {(['portrait', 'symbol'] as const).map((kind) => {
            const id = kind === 'portrait' ? character.portraitId : character.symbolId,
              asset = assets.find((a) => a.id === id);
            return (
              <div className="portrait-upload" key={kind}>
                {asset ? (
                  <img
                    src={asset.dataUrl}
                    alt={kind === 'portrait' ? 'Character portrait' : 'Faction symbol'}
                  />
                ) : (
                  <ImagePlus size={30} />
                )}
                <label className="button secondary">
                  {kind === 'portrait' ? 'Upload portrait' : 'Upload faction symbol'}
                  <input
                    className="visually-hidden"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => void upload(e.target.files?.[0], kind)}
                  />
                </label>
              </div>
            );
          })}
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="form-grid">
          {['Age', 'Height', 'Weight', 'Eyes', 'Skin', 'Hair', 'Faction name'].map((label) => (
            <Input
              key={label}
              label={label}
              value={character.biography[label] || ''}
              onChange={(v) =>
                void edit((c) => {
                  c.biography[label] = v;
                })
              }
            />
          ))}
        </div>
        {bio('appearance', 'Character appearance', 3)}
      </Panel>
      <Panel title="Personality">
        <div className="form-grid">
          {bio('personality', 'Personality traits')}
          {bio('ideals', 'Ideals')}
          {bio('bonds', 'Bonds')}
          {bio('flaws', 'Flaws')}
        </div>
      </Panel>
      <Panel title="Your story">
        {bio('backstory', 'Backstory', 8)}
        {bio('allies', 'Allies & organizations')}
        {bio('treasure', 'Treasure & important discoveries')}
        {bio('sessions', 'Session journal', 10)}
      </Panel>
    </>
  );
}
