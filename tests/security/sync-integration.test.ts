import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, it, expect, vi } from 'vitest';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { newCharacter } from '../../src/domain/model';
import { CampaignDB } from '../../src/storage/database';
let env: RulesTestEnvironment;
const campaign = 'f'.repeat(64),
  stores: CampaignDB[] = [];
beforeAll(async () => {
  vi.stubEnv('VITE_FIREBASE_API_KEY', 'demo-key');
  vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', 'localhost');
  vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'demo-dndev');
  vi.stubEnv('VITE_FIREBASE_APP_ID', 'demo-app');
  vi.stubEnv('VITE_USE_EMULATORS', 'true');
  env = await initializeTestEnvironment({
    projectId: 'demo-dndev',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
  await env.withSecurityRulesDisabled((ctx) =>
    setDoc(doc(ctx.firestore(), 'campaigns', campaign), {
      name: 'Integration test',
      enabled: true,
    }),
  );
}, 20000);
afterAll(async () => {
  vi.unstubAllEnvs();
  await env?.cleanup();
  for (const store of stores) await store.delete();
});
it('authenticates invisibly and synchronizes two persistent queues through real Firestore transactions', async () => {
  const { FirebaseRemote } = await import('../../src/storage/remote');
  const { SyncEngine } = await import('../../src/storage/sync');
  const remoteA = new FirebaseRemote(campaign),
    remoteB = new FirebaseRemote(campaign);
  expect(await remoteA.checkAccess()).toBe('Integration test');
  const da = new CampaignDB('integration-a-' + crypto.randomUUID()),
    db = new CampaignDB('integration-b-' + crypto.randomUUID());
  stores.push(da, db);
  const a = new SyncEngine(da, campaign, remoteA),
    b = new SyncEngine(db, campaign, remoteB);
  try {
    const c = newCharacter('Networked adventurer');
    await a.create(c);
    await a.flush(c.id);
    await b.refresh();
    expect((await db.drafts.toArray())[0].character.name).toBe(c.name);
    await a.edit(c.id, (x) => {
      x.currency.gp = 11;
    });
    await b.edit(c.id, (x) => {
      x.name = 'Renamed by B';
    });
    await b.flush(c.id);
    await a.flush(c.id);
    let actual = (await remoteA.list()).find((x) => x.id === c.id)!;
    expect(actual.name).toBe('Renamed by B');
    expect(actual.currency.gp).toBe(11);
    await b.refresh();
    await a.edit(c.id, (x) => {
      x.combat.hp = 4;
    });
    await b.edit(c.id, (x) => {
      x.combat.hp = 6;
      x.currency.sp = 7;
    });
    await b.flush(c.id);
    await a.flush(c.id);
    const draft = (await da.drafts.toArray()).find((d) => d.characterId === c.id)!;
    expect(draft.conflicts).toHaveLength(1);
    expect(draft.character.currency.sp).toBe(7);
    await a.resolve(c.id, { 0: 'remote' });
    await a.flush(c.id);
    actual = (await remoteB.list()).find((x) => x.id === c.id)!;
    expect(actual.combat.hp).toBe(6);
    expect(actual.currency.sp).toBe(7);
  } finally {
    a.stop();
    b.stop();
  }
}, 30000);
