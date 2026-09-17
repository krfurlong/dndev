import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, getDocs, collection, updateDoc, deleteDoc } from 'firebase/firestore';
import { newCharacter, uid } from '../../src/domain/model';
let env: RulesTestEnvironment;
const key = 'a'.repeat(64),
  disabled = 'b'.repeat(64);
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-dndev',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), 'campaigns', key), { name: 'Test campaign', enabled: true });
    await setDoc(doc(c.firestore(), 'campaigns', disabled), { name: 'Disabled', enabled: false });
  });
});
afterAll(async () => env?.cleanup());
const auth = () =>
  env
    .authenticatedContext('anonymous-player', { firebase: { sign_in_provider: 'anonymous' } })
    .firestore();
describe('private campaign boundary', () => {
  it('allows invited anonymous players to read the known campaign', async () => {
    const snap = await assertSucceeds(getDoc(doc(auth(), 'campaigns', key)));
    expect(snap.data()?.name).toBe('Test campaign');
  });
  it('denies unauthenticated access', async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'campaigns', key)));
  });
  it('denies enumeration, absent and disabled invitations', async () => {
    const db = auth();
    await assertFails(getDocs(collection(db, 'campaigns')));
    await assertFails(getDoc(doc(db, 'campaigns', 'c'.repeat(64))));
    await assertFails(getDoc(doc(db, 'campaigns', disabled)));
    await assertFails(getDocs(collection(db, 'campaigns', disabled, 'characters')));
  });
  it('denies client administration', async () => {
    const db = auth();
    await assertFails(setDoc(doc(db, 'campaigns', 'd'.repeat(64)), { enabled: true }));
    await assertFails(updateDoc(doc(db, 'campaigns', key), { enabled: false }));
    await assertFails(deleteDoc(doc(db, 'campaigns', key)));
  });
  it('allows revision-checked creation, editing, archive and roster', async () => {
    const c = { ...newCharacter('Test'), revision: 1 },
      ref = doc(auth(), 'campaigns', key, 'characters', c.id);
    await assertSucceeds(setDoc(ref, c));
    await assertSucceeds(updateDoc(ref, { revision: 2, archived: true }));
    await assertSucceeds(getDocs(collection(auth(), 'campaigns', key, 'characters')));
    await assertFails(updateDoc(ref, { revision: 2, name: 'stale' }));
    await assertFails(deleteDoc(ref));
  });
  it('rejects invalid IDs and unexpected root fields', async () => {
    const c = { ...newCharacter(), revision: 1 };
    await assertFails(setDoc(doc(auth(), 'campaigns', key, 'characters', 'not-a-uuid'), c));
    await assertFails(
      setDoc(doc(auth(), 'campaigns', key, 'characters', c.id), { ...c, administrator: true }),
    );
  });
  it.each(['name', 'abilities', 'combat', 'currency', 'items', 'spells'])(
    'rejects malformed %s',
    async (field) => {
      const c = { ...newCharacter(), revision: 1, [field]: null };
      await assertFails(setDoc(doc(auth(), 'campaigns', key, 'characters', c.id), c));
    },
  );
  it('rejects out-of-bounds combat and oversized notes', async () => {
    const c = { ...newCharacter(), revision: 1 },
      ref = doc(auth(), 'campaigns', key, 'characters', c.id);
    await assertFails(setDoc(ref, { ...c, combat: { ...c.combat, hp: -1 } }));
    await assertFails(setDoc(ref, { ...c, features: 'a'.repeat(30001) }));
  });
  it('limits images and blocks executable image types', async () => {
    const id = uid(),
      ref = doc(auth(), 'campaigns', key, 'assets', id),
      a = { id, characterId: uid(), kind: 'portrait', dataUrl: 'data:image/png;base64,YQ==' };
    await assertSucceeds(setDoc(ref, a));
    await assertSucceeds(getDoc(ref));
    await assertFails(setDoc(ref, { ...a, dataUrl: 'data:image/svg+xml;base64,YQ==' }));
    await assertFails(
      setDoc(ref, { ...a, dataUrl: 'data:image/png;base64,' + 'A'.repeat(180000) }),
    );
    await assertFails(getDocs(collection(auth(), 'campaigns', key, 'assets')));
  });
  it('revocation blocks known child documents', async () => {
    const temp = 'e'.repeat(64),
      db = auth(),
      c = { ...newCharacter(), revision: 1 };
    await env.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), 'campaigns', temp), { enabled: true }),
    );
    const ref = doc(db, 'campaigns', temp, 'characters', c.id);
    await assertSucceeds(setDoc(ref, c));
    await env.withSecurityRulesDisabled((ctx) =>
      updateDoc(doc(ctx.firestore(), 'campaigns', temp), { enabled: false }),
    );
    await assertFails(updateDoc(ref, { revision: 2 }));
    await assertFails(getDoc(ref));
  });
});
