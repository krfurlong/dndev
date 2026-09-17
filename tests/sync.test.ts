import 'fake-indexeddb/auto';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { CampaignDB, draftKey } from '../src/storage/database';
import { SyncEngine } from '../src/storage/sync';
import { mergeCharacter, type RemoteStore, type CommitResult } from '../src/storage/remote';
import { newCharacter, type Character } from '../src/domain/model';
import { threeWayMerge, setAtPath } from '../src/domain/merge';
class MemoryRemote implements RemoteStore {
  data: Character | null = null;
  calls = 0;
  failure: Error | null = null;
  async checkAccess() {
    return 'Test';
  }
  async list() {
    return this.data ? [this.data] : [];
  }
  async commit(base: Character | null, local: Character) {
    this.calls++;
    if (this.failure) throw this.failure;
    const r = mergeCharacter(base, local, this.data);
    if (r.conflicts.length) return r;
    this.data = { ...r.character, revision: (this.data?.revision || 0) + 1, updatedAt: Date.now() };
    return {
      character: structuredClone(this.data),
      remote: structuredClone(this.data),
      conflicts: [],
    };
  }
  subscribe() {
    return () => {};
  }
  async putAsset() {}
  async getAsset() {
    return null;
  }
}
const stores: CampaignDB[] = [],
  engines: SyncEngine[] = [];
function setup(remote: RemoteStore | null = new MemoryRemote()) {
  const db = new CampaignDB('test-' + crypto.randomUUID());
  stores.push(db);
  const engine = new SyncEngine(db, 'test', remote);
  engines.push(engine);
  return { db, engine, remote: remote as MemoryRemote };
}
afterEach(async () => {
  engines.splice(0).forEach((e) => e.stop());
  vi.useRealTimers();
  for (const db of stores.splice(0)) await db.delete();
});
describe('draft queue', () => {
  it('persists before acknowledgement and saves pending changes after 3 seconds without debounce starvation', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { db, engine } = setup();
    const c = newCharacter();
    const flush = vi.spyOn(engine, 'flush').mockResolvedValue();
    await engine.create(c);
    await vi.advanceTimersByTimeAsync(1000);
    await engine.edit(c.id, (c) => {
      c.name = 'Continuous 1';
    });
    await vi.advanceTimersByTimeAsync(1000);
    await engine.edit(c.id, (c) => {
      c.name = 'Continuous 2';
    });
    expect((await db.drafts.get(draftKey('test', c.id)))?.character.name).toBe('Continuous 2');
    await vi.advanceTimersByTimeAsync(1000);
    expect(flush).toHaveBeenCalledOnce();
  });
  it('manual saving acknowledges revisions and clean values', async () => {
    const { db, engine, remote } = setup(),
      c = newCharacter();
    await engine.create(c);
    await engine.flushAll();
    expect(remote.calls).toBe(1);
    const d = await db.drafts.get(draftKey('test', c.id));
    expect(d?.pending).toBe(false);
    expect(d?.base?.revision).toBe(1);
    await engine.edit(c.id, (x) => {
      x.name = x.name;
    });
    await engine.flushAll();
    expect(remote.calls).toBe(1);
  });
  it('retains local drafts after quota errors and retries after reconnect', async () => {
    const { db, engine, remote } = setup(),
      c = newCharacter();
    await engine.create(c);
    remote.failure = new Error('resource-exhausted');
    await engine.flushAll();
    let d = await db.drafts.get(draftKey('test', c.id));
    expect(d?.pending).toBe(true);
    expect(d?.error).toContain('resource-exhausted');
    remote.failure = null;
    await engine.flushAll();
    d = await db.drafts.get(draftKey('test', c.id));
    expect(d?.pending).toBe(false);
  });
  it('retains in-flight edits and sends them on a subsequent save', async () => {
    const { db, engine, remote } = setup(),
      c = newCharacter();
    await engine.create(c);
    await engine.flushAll();
    let release!: (r: CommitResult) => void;
    const original = remote.commit.bind(remote);
    let entered!: () => void;
    const ready = new Promise<void>((r) => (entered = r));
    remote.commit = async (b, l) => {
      const result = await original(b, l);
      entered();
      return new Promise((r) => {
        release = () => r(result);
      });
    };
    await engine.edit(c.id, (x) => {
      x.name = 'First';
    });
    const saving = engine.flush(c.id);
    await ready;
    await engine.edit(c.id, (x) => {
      x.currency.gp = 40;
    });
    release(null!);
    await saving;
    expect((await db.drafts.get(draftKey('test', c.id)))?.pending).toBe(true);
    remote.commit = original;
    await engine.flush(c.id);
    expect(remote.data?.name).toBe('First');
    expect(remote.data?.currency.gp).toBe(40);
  });
  it('merges independent device changes and resolves overlaps without losing other remote edits', async () => {
    const shared = new MemoryRemote(),
      a = setup(shared),
      b = setup(shared),
      c = newCharacter();
    await a.engine.create(c);
    await a.engine.flush(c.id);
    await b.engine.refresh();
    await a.engine.edit(c.id, (x) => {
      x.combat.hp = 4;
    });
    await b.engine.edit(c.id, (x) => {
      x.currency.gp = 8;
    });
    await b.engine.flush(c.id);
    await a.engine.flush(c.id);
    expect(shared.data?.currency.gp).toBe(8);
    expect(shared.data?.combat.hp).toBe(4);
    await b.engine.refresh();
    await a.engine.edit(c.id, (x) => {
      x.name = 'Local name';
    });
    await b.engine.edit(c.id, (x) => {
      x.name = 'Remote name';
      x.currency.gp = 33;
    });
    await b.engine.flush(c.id);
    await a.engine.flush(c.id);
    const d = await a.db.drafts.get(draftKey('test', c.id));
    expect(d?.conflicts).toHaveLength(1);
    expect(d?.character.currency.gp).toBe(33);
    await a.engine.resolve(c.id, { 0: 'local' });
    await a.engine.flush(c.id);
    expect(shared.data?.name).toBe('Local name');
    expect(shared.data?.currency.gp).toBe(33);
  });
  it('preserves drafts across engine restart and bounds recovery checkpoints', async () => {
    const { db, engine, remote } = setup(),
      c = newCharacter();
    await engine.create(c);
    for (let i = 0; i < 23; i++)
      await engine.edit(
        c.id,
        (x) => {
          x.currency.gp = i;
        },
        'checkpoint',
      );
    expect(await db.history.count()).toBe(20);
    engine.stop();
    const next = new SyncEngine(db, 'test', remote);
    engines.push(next);
    await next.start();
    await next.flushAll();
    expect(remote.data?.currency.gp).toBe(22);
  });
  it('applies incoming independent edits while keeping local pending values', async () => {
    const { db, engine, remote } = setup(),
      c = newCharacter();
    await engine.create(c);
    await engine.flush(c.id);
    await engine.edit(c.id, (x) => {
      x.name = 'Local';
    });
    const incoming = {
      ...structuredClone(remote.data!),
      revision: 2,
      currency: { ...c.currency, gp: 99 },
    };
    await engine.receive(incoming);
    const d = await db.drafts.get(draftKey('test', c.id));
    expect(d?.character.name).toBe('Local');
    expect(d?.character.currency.gp).toBe(99);
    expect(d?.pending).toBe(true);
  });
});
describe('three-way collection merge', () => {
  it('merges stable item IDs and flags overlapping scalar changes', () => {
    const base = { items: { a: { qty: 1 }, b: { qty: 1 } } },
      l = { items: { a: { qty: 2 }, b: { qty: 1 } } },
      r = { items: { a: { qty: 1 }, b: { qty: 4 } } };
    expect(threeWayMerge(base, l, r)).toEqual({
      value: { items: { a: { qty: 2 }, b: { qty: 4 } } },
      conflicts: [],
    });
    expect(threeWayMerge({ hp: 1 }, { hp: 2 }, { hp: 3 }).conflicts).toHaveLength(1);
  });
  it('rejects prototype-polluting conflict paths', () => {
    expect(() => setAtPath({}, ['__proto__', 'x'], true)).toThrow();
    expect(({} as { x?: boolean }).x).toBeUndefined();
  });
});
