import { validateCharacter, type Character, type LocalDraft } from '../domain/model';
import { setAtPath } from '../domain/merge';
import { CampaignDB, draftKey, writeLocal, addLocal } from './database';
import { mergeCharacter, type RemoteStore } from './remote';
export const SYNC_DELAY = 3000;
export class SyncEngine {
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private inFlight = new Set<string>();
  private attempts = new Map<string, number>();
  private stopped = false;
  private unsubscribe = () => {};
  private lifecycle: () => void = () => {};
  constructor(
    readonly database: CampaignDB,
    readonly campaign: string,
    readonly remote: RemoteStore | null,
  ) {}
  async start() {
    this.stopped = false;
    const drafts = await this.database.drafts.where('campaign').equals(this.campaign).toArray();
    if (this.stopped) return;
    drafts.filter((d) => d.pending).forEach((d) => this.schedule(d.characterId, 0));
    if (typeof window !== 'undefined') {
      const flush = () => {
        void this.flushAll();
      };
      const visible = () => {
        if (document.visibilityState === 'hidden') flush();
        else void this.refresh().catch(() => {});
      };
      window.addEventListener('online', flush);
      window.addEventListener('pagehide', flush);
      document.addEventListener('visibilitychange', visible);
      this.lifecycle = () => {
        window.removeEventListener('online', flush);
        window.removeEventListener('pagehide', flush);
        document.removeEventListener('visibilitychange', visible);
      };
    }
  }
  stop() {
    this.stopped = true;
    this.timers.forEach(clearTimeout);
    this.timers.clear();
    this.unsubscribe();
    this.lifecycle();
  }
  async create(c: Character) {
    await addLocal(this.database, this.campaign, c);
    this.schedule(c.id);
  }
  async edit(id: string, change: (c: Character) => void, label?: string) {
    const draft = await writeLocal(this.database, this.campaign, id, change, label);
    this.schedule(id);
    return draft;
  }
  schedule(id: string, delay = SYNC_DELAY) {
    if (this.stopped || !this.remote || this.timers.has(id)) return;
    this.timers.set(
      id,
      setTimeout(() => {
        this.timers.delete(id);
        void this.flush(id);
      }, delay),
    );
  }
  async refresh() {
    if (!this.remote) return;
    const characters = await this.remote.list();
    for (const c of characters) await this.receive(c);
  }
  watch(id: string) {
    this.unsubscribe();
    this.unsubscribe = () => {};
    if (!id) return;
    this.unsubscribe =
      this.remote?.subscribe(
        id,
        (c) => {
          void this.receive(c);
        },
        (e) => {
          void this.error(id, e);
        },
      ) || (() => {});
  }
  private async error(id: string, e: unknown) {
    const key = draftKey(this.campaign, id);
    await this.database.drafts.update(key, {
      error: e instanceof Error ? e.message : 'Remote save failed. Your local draft is retained.',
    });
  }
  async receive(remote: Character) {
    // A transaction result, not the listener, acknowledges an in-flight save.
    if (this.inFlight.has(remote.id)) return;
    await this.database.transaction('rw', this.database.drafts, async () => {
      const key = draftKey(this.campaign, remote.id),
        draft = await this.database.drafts.get(key);
      if (!draft) {
        await this.database.drafts.put({
          key,
          campaign: this.campaign,
          characterId: remote.id,
          base: remote,
          character: remote,
          pending: false,
          conflicts: [],
          error: '',
          localVersion: 0,
          savedLocallyAt: Date.now(),
        });
        return;
      }
      if (draft.base && remote.revision <= draft.base.revision) return;
      if (draft.pending || draft.conflicts.length) {
        const result = mergeCharacter(draft.base, draft.character, remote);
        await this.database.drafts.put({
          ...draft,
          base: remote,
          character: result.character,
          conflicts: [
            ...new Map(
              [...draft.conflicts, ...result.conflicts].map((c) => [JSON.stringify(c.path), c]),
            ).values(),
          ],
        });
      } else
        await this.database.drafts.put({ ...draft, base: remote, character: remote, error: '' });
    });
  }
  async flush(id: string) {
    const timer = this.timers.get(id);
    if (timer) clearTimeout(timer);
    this.timers.delete(id);
    if (!this.remote || this.stopped || this.inFlight.has(id)) return;
    const key = draftKey(this.campaign, id),
      draft = await this.database.drafts.get(key);
    if (!draft?.pending || draft.conflicts.length) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.schedule(id, 10000);
      return;
    }
    this.inFlight.add(id);
    try {
      // Upload assets before a character begins referring to them remotely.
      const assets = await this.database.assets.where('campaign').equals(this.campaign).toArray();
      for (const a of assets.filter((a) => a.characterId === id && a.pending)) {
        await this.remote.putAsset({
          id: a.id,
          characterId: a.characterId,
          kind: a.kind,
          dataUrl: a.dataUrl,
        });
        await this.database.assets.update(a.key, { pending: false });
      }
      const result = await this.remote.commit(draft.base, draft.character);
      await this.database.transaction('rw', this.database.drafts, async () => {
        const current = await this.database.drafts.get(key);
        if (!current) return;
        if (result.conflicts.length) {
          const merged = mergeCharacter(draft.base, current.character, result.remote);
          await this.database.drafts.put({
            ...current,
            base: result.remote,
            character: merged.character,
            conflicts: merged.conflicts,
            error: '',
          });
          return;
        }
        // Edits made while the request was in flight are rebased, never overwritten.
        const after = mergeCharacter(draft.character, current.character, result.character);
        const pending = current.localVersion !== draft.localVersion;
        await this.database.drafts.put({
          ...current,
          base: result.character,
          character: pending ? after.character : result.character,
          pending,
          conflicts: after.conflicts,
          error: '',
        });
      });
      this.attempts.delete(id);
    } catch (e) {
      await this.error(id, e);
      this.attempts.set(id, (this.attempts.get(id) || 0) + 1);
    } finally {
      this.inFlight.delete(id);
      const latest = await this.database.drafts.get(key);
      if (latest?.pending && !latest.conflicts.length)
        this.schedule(id, Math.min(60000, SYNC_DELAY * 2 ** (this.attempts.get(id) || 0)));
    }
  }
  async flushAll() {
    const drafts = await this.database.drafts.where('campaign').equals(this.campaign).toArray();
    await Promise.all(drafts.filter((d) => d.pending).map((d) => this.flush(d.characterId)));
  }
  async resolve(id: string, choices: Record<number, 'local' | 'remote'>) {
    const key = draftKey(this.campaign, id);
    await this.database.transaction('rw', this.database.drafts, async () => {
      const draft = await this.database.drafts.get(key);
      if (!draft) return;
      let character = draft.character;
      for (let i = 0; i < draft.conflicts.length; i++) {
        const conflict = draft.conflicts[i];
        if (!choices[i]) throw new Error('Choose a value for every conflict.');
        const value = conflict[choices[i]];
        if (conflict.path.length === 0 && value === null)
          throw new Error(
            'The remote character was removed. Export the local version and import it as a new character.',
          );
        character = setAtPath(character, conflict.path, value);
      }
      validateCharacter(character);
      await this.database.drafts.put({
        ...draft,
        character,
        conflicts: [],
        pending: true,
        localVersion: draft.localVersion + 1,
      });
    });
    this.schedule(id, 0);
  }
}
