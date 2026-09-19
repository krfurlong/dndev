import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, connectAuthEmulator } from 'firebase/auth';
import {
  initializeFirestore,
  memoryLocalCache,
  doc,
  getDoc,
  getDocs,
  collection,
  onSnapshot,
  runTransaction,
  connectFirestoreEmulator,
  type Firestore,
} from 'firebase/firestore';
import { threeWayMerge } from '../domain/merge';
import { validateCharacter, type Asset, type Character, type Conflict } from '../domain/model';
export type CommitResult = {
  character: Character;
  conflicts: Conflict[];
  remote: Character | null;
};
export interface RemoteStore {
  checkAccess(): Promise<string>;
  list(): Promise<Character[]>;
  commit(base: Character | null, local: Character): Promise<CommitResult>;
  subscribe(id: string, receive: (c: Character) => void, error: (e: Error) => void): () => void;
  putAsset(asset: Asset): Promise<void>;
  getAsset(id: string): Promise<Asset | null>;
}
export function mergeCharacter(
  base: Character | null,
  local: Character,
  remote: Character | null,
): CommitResult {
  // Older local bases may predate defaulted fields that a remote read now supplies.
  // Normalize all three versions so adding defaults is not mistaken for an edit.
  base = base ? validateCharacter(base) : null;
  local = validateCharacter(local);
  remote = remote ? validateCharacter(remote) : null;
  if (!remote)
    return base
      ? { character: local, remote: null, conflicts: [{ path: [], base, local, remote: null }] }
      : { character: local, remote: null, conflicts: [] };
  if (!base)
    return { character: local, remote, conflicts: [{ path: [], base: null, local, remote }] };
  const b = { ...base, revision: 0, updatedAt: 0 },
    l = { ...local, revision: 0, updatedAt: 0 },
    r = { ...remote, revision: 0, updatedAt: 0 };
  const merged = threeWayMerge(b, l, r);
  return {
    character: { ...merged.value, revision: remote.revision, updatedAt: remote.updatedAt },
    conflicts: merged.conflicts,
    remote,
  };
}
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
export const firebaseConfigured = Object.values(config).every(Boolean);
let firestore: Firestore | undefined;
let authentication: Promise<unknown> | undefined;
async function connect() {
  if (!firebaseConfigured)
    throw new Error(
      'Firebase is not configured. Use the local demo or follow the deployment guide.',
    );
  if (!firestore) {
    const app = initializeApp(config),
      auth = getAuth(app);
    firestore = initializeFirestore(app, { localCache: memoryLocalCache() });
    if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true') {
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
    }
  }
  const auth = getAuth();
  await auth.authStateReady();
  if (!auth.currentUser) {
    authentication ??= signInAnonymously(auth).finally(() => {
      authentication = undefined;
    });
    await authentication;
  }
  return firestore;
}
export class FirebaseRemote implements RemoteStore {
  private name = 'Campaign';
  constructor(private campaign: string) {
    if (!/^[a-f0-9]{64}$/.test(campaign)) throw new Error('Invalid invitation.');
  }
  private async path(id?: string) {
    const f = await connect();
    return id
      ? doc(f, 'campaigns', this.campaign, 'characters', id)
      : doc(f, 'campaigns', this.campaign);
  }
  async checkAccess() {
    const snap = await getDoc(await this.path());
    if (!snap.exists() || snap.data().enabled !== true)
      throw new Error('This invitation is unavailable or disabled.');
    this.name = String(snap.data().name || 'Campaign');
    return this.name;
  }
  async list() {
    const f = await connect();
    const result = await getDocs(collection(f, 'campaigns', this.campaign, 'characters'));
    return result.docs.map((d) => validateCharacter(d.data()));
  }
  async commit(base: Character | null, local: Character): Promise<CommitResult> {
    const f = await connect(),
      ref = await this.path(local.id);
    return runTransaction(f, async (tx) => {
      const snap = await tx.get(ref),
        remote = snap.exists() ? validateCharacter(snap.data()) : null;
      const result = mergeCharacter(base, local, remote);
      if (result.conflicts.length) return result;
      const character = validateCharacter({
        ...result.character,
        revision: (remote?.revision || 0) + 1,
        updatedAt: Date.now(),
      });
      tx.set(ref, character);
      return { character, remote: character, conflicts: [] };
    });
  }
  subscribe(id: string, receive: (c: Character) => void, error: (e: Error) => void) {
    let stopped = false,
      unsubscribe = () => {};
    this.path(id)
      .then((ref) => {
        if (!stopped)
          unsubscribe = onSnapshot(
            ref,
            (snap) => {
              if (snap.exists() && !snap.metadata.hasPendingWrites) {
                try {
                  receive(validateCharacter(snap.data()));
                } catch (e) {
                  error(e as Error);
                }
              }
            },
            error,
          );
      })
      .catch(error);
    return () => {
      stopped = true;
      unsubscribe();
    };
  }
  async putAsset(asset: Asset) {
    const f = await connect();
    await runTransaction(f, async (tx) => {
      tx.set(doc(f, 'campaigns', this.campaign, 'assets', asset.id), asset);
    });
  }
  async getAsset(id: string) {
    const f = await connect(),
      snap = await getDoc(doc(f, 'campaigns', this.campaign, 'assets', id));
    return snap.exists() ? (snap.data() as Asset) : null;
  }
}
