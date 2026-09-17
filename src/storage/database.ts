import Dexie, { type Table } from 'dexie';
import {
  validateCharacter,
  type Asset,
  type Character,
  type HistoryEntry,
  type LocalDraft,
} from '../domain/model';
export interface StoredAsset extends Asset {
  key: string;
  campaign: string;
  pending: boolean;
}
export class CampaignDB extends Dexie {
  drafts!: Table<LocalDraft, string>;
  history!: Table<HistoryEntry, number>;
  assets!: Table<StoredAsset, string>;
  constructor(name = 'dndev-v1') {
    super(name);
    this.version(1).stores({
      drafts: 'key,campaign,characterId,[campaign+characterId]',
      history: '++id,[campaign+characterId],at',
      assets: 'key,campaign,characterId',
    });
  }
}
export const db = new CampaignDB();
export const draftKey = (campaign: string, id: string) => campaign + ':' + id;
export async function writeLocal(
  database: CampaignDB,
  campaign: string,
  id: string,
  change: (c: Character) => void,
  label?: string,
): Promise<LocalDraft> {
  return database.transaction('rw', database.drafts, database.history, async () => {
    const key = draftKey(campaign, id),
      draft = await database.drafts.get(key);
    if (!draft) throw new Error('Character was not found on this device.');
    if (label) {
      await database.history.add({
        campaign,
        characterId: id,
        at: Date.now(),
        label,
        character: structuredClone(draft.character),
      });
      const old = await database.history
        .where('[campaign+characterId]')
        .equals([campaign, id])
        .sortBy('at');
      await database.history.bulkDelete(old.slice(0, -20).map((h) => h.id!));
    }
    const changed = structuredClone(draft.character);
    change(changed);
    const next = validateCharacter(changed);
    if (JSON.stringify(next) === JSON.stringify(draft.character)) return draft;
    const conflicts = draft.conflicts.map((conflict) => ({
      ...conflict,
      local: conflict.path.reduce(
        (v: unknown, k) =>
          v && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined,
        next,
      ),
    }));
    const updated = {
      ...draft,
      character: next,
      conflicts,
      pending: true,
      error: '',
      localVersion: draft.localVersion + 1,
      savedLocallyAt: Date.now(),
    };
    await database.drafts.put(updated);
    return updated;
  });
}
export async function addLocal(database: CampaignDB, campaign: string, character: Character) {
  character = validateCharacter(character);
  const draft: LocalDraft = {
    key: draftKey(campaign, character.id),
    campaign,
    characterId: character.id,
    base: null,
    character,
    pending: true,
    conflicts: [],
    error: '',
    localVersion: 1,
    savedLocallyAt: Date.now(),
  };
  await database.drafts.add(draft);
  return draft;
}
