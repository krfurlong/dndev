import { useEffect, useMemo, useState } from 'react';
import {
  Dices,
  Plus,
  ArrowUpRight,
  BookOpen,
  Backpack,
  UserRound,
  Heart,
  ChevronLeft,
  Cloud,
  CloudOff,
  Check,
  Download,
  Upload,
  Palette,
  History,
  Archive,
  Link as LinkIcon,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  Sparkles,
  Settings2,
  RefreshCw,
} from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { db, draftKey } from './storage/database';
import { mergeCharacter, FirebaseRemote, firebaseConfigured } from './storage/remote';
import { SyncEngine } from './storage/sync';
import {
  downloadBackup,
  duplicateBackup,
  makeBackup,
  parseBackup,
  type Backup,
} from './storage/backup';
import { useQuery } from './hooks';
import {
  newCharacter,
  uid,
  type Character,
  type ContentEntry,
  type LocalDraft,
  type Asset,
} from './domain/model';
import { addLevel, applyContent, classSummary, maxHp, totalLevel } from './domain/rules';
import { attachProgression, syncGrantedSpells } from './domain/progression';
import { toCharacterSpell, catalog } from './data/catalog';
import { exampleCharacters } from './data/fixtures';
import { Button, Panel, Modal, Notice, Empty, Input, Pill, Menu } from './components/common';
import { ThemeDialog, useAppearance } from './components/ThemeDialog';
import { Builder } from './components/Builder';
import { LevelUp } from './components/LevelUp';
import { RestDialog } from './components/RestDialog';
import { CatalogDialog } from './components/CatalogDialog';
import { AbilityRail, Play } from './components/Play';
import { CharacterDetails } from './components/CharacterDetails';
import { Spells } from './components/Spells';
import { Inventory } from './components/Inventory';
import { CharacterExtras } from './components/CharacterExtras';
type Tab = 'play' | 'character' | 'spells' | 'inventory' | 'journal';
const tabs: { id: Tab; name: string; Icon: typeof Heart }[] = [
  { id: 'play', name: 'Play', Icon: Heart },
  { id: 'spells', name: 'Spells', Icon: Sparkles },
  { id: 'inventory', name: 'Inventory', Icon: Backpack },
];
function getRoute() {
  const match = location.hash.match(/^#\/character\/([a-f0-9-]+)(?:\/(\w+))?(?:\/notes)?$/);
  return {
    id: match?.[1] || '',
    tab: (['play', 'character', 'spells', 'inventory', 'journal'].includes(match?.[2] || '')
      ? match![2]
      : 'play') as Tab,
  };
}
export default function App() {
  const appearance = useAppearance();
  const [localWrites, setLocalWrites] = useState(0);
  const [campaign, setCampaign] = useState(() => localStorage.getItem('dndev.campaign') || '');
  const [campaignName, setCampaignName] = useState('Your campaign'),
    [route, setRoute] = useState(getRoute);
  const [dialog, setDialog] = useState(''),
    [error, setError] = useState(''),
    [toast, setToast] = useState(''),
    [busy, setBusy] = useState(false),
    [showArchived, setShowArchived] = useState(false);
  const [imported, setImported] = useState<Backup | null>(null),
    [conflictChoices, setConflictChoices] = useState<Record<number, 'local' | 'remote'>>({});
  const [invitation, setInvitation] = useState(''),
    [catalogCategory, setCatalogCategory] = useState('');
  const engine = useMemo(
    () =>
      new SyncEngine(
        db,
        campaign,
        campaign && campaign !== 'local' && firebaseConfigured
          ? new FirebaseRemote(campaign)
          : null,
      ),
    [campaign],
  );
  const { value: drafts, error: dbError } = useQuery(
    () => db.drafts.where('campaign').equals(campaign).toArray(),
    [campaign],
    [] as LocalDraft[],
  );
  const { value: history } = useQuery(
    () =>
      route.id
        ? db.history
            .where('[campaign+characterId]')
            .equals([campaign, route.id])
            .reverse()
            .sortBy('at')
        : Promise.resolve([]),
    [campaign, route.id],
    [],
  );
  const draft = drafts.find((d) => d.characterId === route.id),
    character = draft?.character;
  const sw = useRegisterSW();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [route.id, route.tab]);
  useEffect(() => {
    function navigate() {
      const join = location.hash.match(/^#\/join\/([a-f0-9]{64})$/);
      if (join) {
        localStorage.setItem('dndev.campaign', join[1]);
        setCampaign(join[1]);
        historyReplace('#/');
      }
      const next = getRoute();
      if (next.tab === 'journal') historyReplace('#/character/' + next.id + '/character/notes');
      setRoute(next.tab === 'journal' ? { ...next, tab: 'character' } : next);
    }
    navigate();
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, []);
  useEffect(() => {
    if (!campaign) return;
    void engine.start();
    if (engine.remote) {
      engine.remote
        .checkAccess()
        .then((name) => {
          setCampaignName(name);
          return engine.refresh();
        })
        .catch((e) => setError(e.message));
    } else setCampaignName('Your local campaign');
    return () => engine.stop();
  }, [engine, campaign]);
  useEffect(() => {
    engine.watch(route.id);
    if (!route.id && engine.remote) void engine.refresh().catch((e) => setError(e.message));
  }, [route.id, engine]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 4500);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    if (character) void ensureAssets([character]).catch((e) => setError(e.message));
  }, [character?.portraitId, character?.symbolId, campaign]);
  function historyReplace(hash: string) {
    window.history.replaceState(null, '', location.pathname + location.search + hash);
  }
  function go(id = '', tab: Tab = 'play') {
    location.hash = id ? '#/character/' + id + '/' + tab : '#/';
    if (!id) setRoute({ id: '', tab: 'play' });
  }
  async function ensureAssets(chars: Character[]): Promise<Asset[]> {
    const assets: Asset[] = [];
    for (const c of chars)
      for (const id of [c.portraitId, c.symbolId].filter(Boolean)) {
        let asset = await db.assets.get(draftKey(campaign, id));
        if (!asset && engine.remote) {
          const remote = await engine.remote.getAsset(id);
          if (remote) {
            asset = { ...remote, key: draftKey(campaign, id), campaign, pending: false };
            await db.assets.put(asset);
          }
        }
        if (asset) assets.push(asset);
        else
          throw new Error(
            'An image is unavailable on this device. Reconnect before exporting a complete backup.',
          );
      }
    return assets;
  }
  async function edit(change: (c: Character) => void, label?: string) {
    if (!character) return;
    setLocalWrites((n) => n + 1);
    try {
      await engine.edit(character.id, change, label);
      setError('');
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setLocalWrites((n) => n - 1);
    }
  }
  async function replace(c: Character, label: string) {
    const original = character!;
    await edit((current) => {
      const merged = mergeCharacter(original, c, current);
      if (merged.conflicts.length)
        throw new Error(
          'The sheet changed while this preview was open. Close it and review a fresh preview.',
        );
      Object.assign(current, merged.character);
    }, label);
  }
  async function create(c: Character) {
    await engine.create(c);
    go(c.id);
  }
  async function exportData(chars: Character[]) {
    try {
      const assets = await ensureAssets(chars);
      downloadBackup(
        makeBackup(chars, assets),
        chars.length === 1 ? chars[0].name.replace(/[^a-z0-9-]/gi, '-') : 'dndev-campaign',
      );
      setToast('Backup downloaded. Keep a copy outside this browser.');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function importFile(file: File | undefined) {
    if (!file) return;
    try {
      setImported(parseBackup(await file.text()));
      setDialog('import');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function applyImport() {
    if (!imported) return;
    try {
      const data = duplicateBackup(imported);
      await db.transaction('rw', db.drafts, db.assets, async () => {
        for (const a of data.assets)
          await db.assets.put({ ...a, campaign, key: draftKey(campaign, a.id), pending: true });
        for (const c of data.characters) await engine.create(c);
      });
      setImported(null);
      setDialog('');
      setToast('Imported as new characters. Existing sheets were kept.');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function local(examples: boolean) {
    setBusy(true);
    try {
      const localEngine = new SyncEngine(db, 'local', null);
      if (examples) {
        const existing = await db.drafts.where('campaign').equals('local').count();
        if (!existing) for (const c of exampleCharacters()) await localEngine.create(c);
      }
      localStorage.setItem('dndev.campaign', 'local');
      setCampaign('local');
      go();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function openCatalog(category = '') {
    setCatalogCategory(category);
    setDialog('catalog');
  }
  async function addContent(e: ContentEntry, override = '') {
    await edit((c) => {
      if (override) c.overrides.push({ at: new Date().toISOString(), reason: override });
      Object.assign(c, syncGrantedSpells(attachProgression(applyContent(c, e))));
      if (e.category === 'spell') {
        const s = toCharacterSpell(e);
        s.castingAbility =
          Object.values(c.classes).find((t) => t.caster !== 'none')?.castingAbility || 'int';
        c.spells[s.id] = s;
      }
    }, 'Select ' + e.name);
  }
  const visible = drafts
    .filter((d) => d.character.archived === showArchived)
    .sort((a, b) => a.character.name.localeCompare(b.character.name));
  const statusDrafts = draft ? [draft] : drafts;
  const hasConflicts = statusDrafts.some((d) => d.conflicts.length > 0);
  const hasErrors = statusDrafts.some((d) => !!d.error);
  const hasPending = statusDrafts.some((d) => d.pending);
  const status = localWrites
    ? 'Saving on this device…'
    : !engine.remote
      ? 'Saved on this device'
      : hasConflicts
        ? 'Resolve save conflict'
        : hasErrors
          ? 'Cloud save needs attention'
          : hasPending
            ? 'Saved locally · syncing…'
            : 'All changes synced';
  const statusClass = localWrites
    ? 'pending'
    : hasConflicts || hasErrors
      ? 'warning'
      : hasPending && engine.remote
        ? 'pending'
        : 'saved';
  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => go()} aria-label="DnDev campaign home">
          <span className="brand-mark">
            <Dices size={23} />
          </span>
          <span>
            DnDev<span className="brand-dot">.</span>
          </span>
        </button>
        <div className="breadcrumb">
          <span className="divider">/</span>
          <span>{campaignName}</span>
          {character && (
            <>
              <span className="divider">/</span>
              <strong>{character.name}</strong>
            </>
          )}
        </div>
        <div className="header-actions">
          {campaign && (
            <span className={'save-status ' + statusClass} role="status">
              {engine.remote ? <Cloud size={15} /> : <CloudOff size={15} />}
              <span>{status}</span>
            </span>
          )}
          {campaign && (
            <button
              className="icon-button"
              aria-label="Switch character"
              onClick={() => setDialog('switch')}
            >
              <UserRound size={19} />
            </button>
          )}
          <button
            className="icon-button theme-trigger"
            aria-label="Change appearance"
            onClick={() => setDialog('theme')}
          >
            <Palette size={19} />
          </button>
          {campaign && (
            <Menu label="Actions">
              <button
                onClick={() => {
                  void engine.flushAll();
                  setToast(
                    engine.remote
                      ? 'Sending pending changes…'
                      : 'Saved on this device. Join a campaign to enable cloud sync.',
                  );
                }}
              >
                <Check size={16} /> Save now
              </button>
              {character && (
                <>
                  <button onClick={() => go(character.id, 'character')}>
                    <Settings2 size={16} /> Advanced settings
                  </button>
                  <button onClick={() => setDialog('level')}>
                    <ArrowUpRight size={16} /> Level up
                  </button>
                  <button onClick={() => setDialog('rest')}>
                    <Heart size={16} /> Take a rest
                  </button>
                  <button onClick={() => setDialog('history')}>
                    <History size={16} /> Recovery history
                  </button>
                  <button onClick={() => void exportData([character])}>
                    <Download size={16} /> Export character
                  </button>
                  <button
                    onClick={() => {
                      void edit((c) => {
                        c.archived = !c.archived;
                      }, 'Archive / restore character').then(() => go());
                    }}
                  >
                    <Archive size={16} />{' '}
                    {character.archived ? 'Restore character' : 'Archive character'}
                  </button>
                </>
              )}
              <button onClick={() => void exportData(drafts.map((d) => d.character))}>
                <Download size={16} /> Export campaign
              </button>
              <button onClick={() => setDialog('join')}>
                <LinkIcon size={16} /> Join another campaign
              </button>
              {engine.remote && (
                <button
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(location.origin + location.pathname + '#/join/' + campaign)
                      .then(() =>
                        setToast('Private invitation copied. Share only with your group.'),
                      )
                      .catch(() =>
                        setError('Clipboard is unavailable. Use your original invitation link.'),
                      );
                  }}
                >
                  <LinkIcon size={16} /> Copy private invitation
                </button>
              )}
              <button onClick={() => setDialog('about')}>
                <BookOpen size={16} /> About & setup
              </button>
            </Menu>
          )}
        </div>
      </header>
      {(error || dbError) && (
        <div className="global-notice">
          <Notice tone="error">
            {error || dbError}
            <Button variant="ghost" onClick={() => setError('')}>
              Dismiss
            </Button>
          </Notice>
        </div>
      )}
      {sw.needRefresh[0] && (
        <div className="global-notice">
          <Notice>
            A new app version is ready. Local drafts are retained.
            <Button onClick={() => void sw.updateServiceWorker(true)}>Update app</Button>
          </Notice>
        </div>
      )}
      {campaign && campaign !== 'local' && !firebaseConfigured && (
        <div className="global-notice">
          <Notice tone="warning">
            This deployment has no Firebase configuration. Your invitation cannot connect yet.
            Follow the deployment guide or use the local demo.
          </Notice>
        </div>
      )}
      {!campaign ? (
        <main className="welcome">
          <div className="welcome-badge">
            <ShieldCheck size={15} /> Made for the way you play
          </div>
          <h1>
            Your character.
            <br />
            <span>Every chapter.</span>
          </h1>
          <p className="welcome-intro">
            A place for every spell, scar, and story.
            <br />
            Keep your whole adventure close, from the first roll to the final session.
          </p>
          <div className="welcome-actions">
            <Button variant="primary" onClick={() => setDialog('join')}>
              Open your campaign <ArrowRight size={17} />
            </Button>
            <Button onClick={() => void local(true)} disabled={busy}>
              Explore an example campaign
            </Button>
          </div>
          <button className="text-button muted" onClick={() => void local(false)}>
            Or start a blank campaign on this device
          </button>
          <div className="welcome-preview">
            <div className="preview-title">
              <span className="avatar mini">LM</span>
              <div>
                <strong>Lyra Mosswood</strong>
                <small>Wood Elf · Ranger 4</small>
              </div>
              <Pill>Your next adventure</Pill>
            </div>
            <div className="preview-stats">
              <div>
                <span>HIT POINTS</span>
                <strong>
                  24 <small>/ 32</small>
                </strong>
                <div className="preview-bar" />
              </div>
              <div>
                <span>ARMOR CLASS</span>
                <strong>15</strong>
              </div>
              <div>
                <span>INITIATIVE</span>
                <strong>+3</strong>
              </div>
            </div>
            <div className="preview-bottom">
              <span>
                <BookOpen size={16} /> Your spells, at a glance
              </span>
              <span>
                <CloudOff size={16} /> Ready when the Wi-Fi isn’t
              </span>
            </div>
          </div>
          <div className="welcome-features">
            <div>
              <Dices />
              <strong>Built for your table</strong>
              <p>Published 2014 rules, flexible choices, and room for your own ideas.</p>
            </div>
            <div>
              <Cloud />
              <strong>Pick up where you left off</strong>
              <p>Local saving first. Private campaign sync when you connect.</p>
            </div>
            <div>
              <BookOpen />
              <strong>Your story stays yours</strong>
              <p>Portable backups. No subscriptions. No player accounts.</p>
            </div>
          </div>
        </main>
      ) : !character ? (
        <main className="campaign-page">
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {campaign === 'local' ? 'YOUR LOCAL WORKSPACE' : 'THE CAMPAIGN'}
              </span>
              <h1>Your adventurers</h1>
              <p>Different paths. One shared story.</p>
            </div>
            <div className="inline">
              <label className="button secondary">
                <Upload size={16} /> Import backup
                <input
                  className="visually-hidden"
                  type="file"
                  accept=".json,application/json"
                  onChange={(e) => {
                    void importFile(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </label>
              <Button variant="primary" onClick={() => setDialog('build')}>
                <Plus size={17} /> New character
              </Button>
            </div>
          </div>
          {campaign === 'local' && (
            <div className="local-banner">
              <CloudOff size={18} />
              <div>
                <strong>This campaign lives on this device.</strong>
                <span>
                  Export a backup to keep an independent copy, or join your group for cloud sync.
                </span>
              </div>
              <Button variant="ghost" onClick={() => setDialog('join')}>
                Connect a campaign <ArrowRight size={15} />
              </Button>
            </div>
          )}
          <div className="roster-heading">
            <span>
              {visible.length} {showArchived ? 'archived' : 'active'} characters
            </span>
            <button className="text-button" onClick={() => setShowArchived(!showArchived)}>
              <Archive size={14} /> {showArchived ? 'Show active' : 'View archived'}
            </button>
          </div>
          <div className="character-grid">
            {visible.map((d) => {
              const c = d.character;
              return (
                <button className="character-card" key={c.id} onClick={() => go(c.id)}>
                  <div className="card-top">
                    <span
                      className={
                        'avatar color-' + (Object.values(c.classes)[0]?.classId || 'custom')
                      }
                    >
                      {c.name
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')}
                    </span>
                    <span className="level-label">
                      LVL <strong>{totalLevel(c)}</strong>
                    </span>
                  </div>
                  <h2>{c.name}</h2>
                  <p>{[c.race, classSummary(c)].filter(Boolean).join(' · ')}</p>
                  <div className="card-player">
                    <UserRound size={13} />
                    {c.player || 'Your adventurer'}
                  </div>
                  <small
                    className="card-save"
                    title={'Last local save: ' + new Date(d.savedLocallyAt).toLocaleString()}
                  >
                    {d.conflicts.length
                      ? 'Save conflict · open to review'
                      : d.error
                        ? 'Cloud save needs attention'
                        : !engine.remote
                          ? 'Saved on this device'
                          : d.pending
                            ? 'Saved locally · sync pending'
                            : 'All changes synced'}
                  </small>
                  <div className="card-bottom">
                    <span>
                      <Heart size={14} /> {c.combat.hp} / {maxHp(c)} HP
                    </span>
                    <span>
                      Open sheet <ArrowUpRight size={15} />
                    </span>
                  </div>
                </button>
              );
            })}
            <button className="character-card new-card" onClick={() => setDialog('build')}>
              <span className="new-character-icon">
                <Plus size={24} />
              </span>
              <strong>A new story awaits</strong>
              <span>Create your next character</span>
            </button>
          </div>
          {!visible.length && (
            <p className="muted">
              Create a character from scratch or import a DnDev backup to get started.
            </p>
          )}
          <footer className="page-footer">
            <Dices size={16} />
            <span>DnDev · 2014 fifth edition</span>
            <button className="text-button" onClick={() => setDialog('about')}>
              Sources & setup
            </button>
          </footer>
        </main>
      ) : (
        <main className="sheet-page">
          <div className="character-banner">
            <button className="icon-button" aria-label="Back to campaign" onClick={() => go()}>
              <ChevronLeft size={22} />
            </button>
            <span className="avatar">
              {character.name
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')}
            </span>
            <div className="character-heading">
              <span className="eyebrow">{character.player || 'YOUR ADVENTURER'}</span>
              <h1>{character.name}</h1>
              <p>
                {[character.race, classSummary(character), character.background]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            <Button onClick={() => setDialog('level')} disabled={totalLevel(character) >= 20}>
              <ArrowUpRight size={16} /> Level up
            </Button>
          </div>
          {draft && draft.conflicts.length > 0 && (
            <Notice tone="warning">
              Another device changed the same fields. Both versions are retained.
              <Button
                onClick={() => {
                  setConflictChoices({});
                  setDialog('conflict');
                }}
              >
                Resolve conflict
              </Button>
            </Notice>
          )}
          <div className="sheet-layout">
            <AbilityRail character={character} />
            <div className="sheet-main">
              <nav className="section-tabs" aria-label="Character sections">
                {tabs.map(({ id, name, Icon }) => (
                  <button
                    key={id}
                    className={route.tab === id ? 'active' : ''}
                    aria-current={route.tab === id ? 'page' : undefined}
                    onClick={() => go(character.id, id)}
                  >
                    <Icon size={17} />
                    <span>{name}</span>
                  </button>
                ))}
              </nav>
              <div className="sheet-content">
                {route.tab === 'play' && (
                  <Play
                    character={character}
                    edit={edit}
                    onRest={() => setDialog('rest')}
                    onNavigate={(tab) => go(character.id, tab)}
                  />
                )}
                {route.tab === 'character' && (
                  <>
                    <Panel
                      title="Advanced settings"
                      subtitle="Character configuration, artwork, and personal notes."
                      action={<Button onClick={() => go(character.id)}>Back to Play</Button>}
                    >
                      {null}
                    </Panel>
                    <CharacterDetails
                      character={character}
                      edit={edit}
                      onCatalog={() => openCatalog()}
                      onLevel={() => setDialog('level')}
                    />
                    <CharacterExtras
                      character={character}
                      edit={edit}
                      campaign={campaign}
                      notesOpen={location.hash.endsWith('/notes')}
                    />
                  </>
                )}
                {route.tab === 'spells' && (
                  <Spells
                    character={character}
                    edit={edit}
                    onCatalog={() => openCatalog('spell')}
                  />
                )}
                {route.tab === 'inventory' && <Inventory character={character} edit={edit} />}
              </div>
            </div>
          </div>
        </main>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
      {dialog === 'theme' && <ThemeDialog appearance={appearance} onClose={() => setDialog('')} />}
      {dialog === 'build' && <Builder onClose={() => setDialog('')} onCreate={create} />}
      {dialog === 'level' && character && (
        <LevelUp
          character={character}
          onClose={() => setDialog('')}
          onApply={(c) => replace(c, 'Level up')}
        />
      )}
      {dialog === 'rest' && character && (
        <RestDialog character={character} onClose={() => setDialog('')} onApply={replace} />
      )}
      {dialog === 'catalog' && character && (
        <CatalogDialog
          character={character}
          initialCategory={catalogCategory}
          onClose={() => setDialog('')}
          onAdd={addContent}
        />
      )}
      {dialog === 'switch' && (
        <Modal title="Switch character" onClose={() => setDialog('')}>
          <div className="switch-list">
            {drafts
              .filter((d) => !d.character.archived)
              .sort((a, b) => a.character.name.localeCompare(b.character.name))
              .map((d) => (
                <Button
                  key={d.characterId}
                  onClick={() => {
                    go(d.characterId, route.tab);
                    setDialog('');
                  }}
                >
                  <UserRound size={18} />
                  <span>
                    <strong>{d.character.name}</strong>
                    <small>{classSummary(d.character)}</small>
                  </span>
                  {d.characterId === route.id && <Check size={17} />}
                </Button>
              ))}
          </div>
          <div className="dialog-actions">
            <Button
              onClick={() => {
                go();
                setDialog('');
              }}
            >
              Campaign roster
            </Button>
          </div>
        </Modal>
      )}
      {dialog === 'join' && (
        <Modal title="Join your campaign" onClose={() => setDialog('')}>
          <p className="muted">
            Paste the private invitation your campaign organizer shared. No account or password
            needed.
          </p>
          <Input
            label="Private invitation link"
            value={invitation}
            onChange={setInvitation}
            placeholder="https://…/#/join/…"
          />
          <Notice>
            Anyone with this link can view and edit the campaign. Keep it within your group.
          </Notice>
          <div className="dialog-actions">
            <Button
              onClick={() => {
                void local(false);
                setDialog('');
              }}
            >
              Use this device only
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                const match = invitation.match(/(?:#\/join\/|^)([a-f0-9]{64})$/);
                if (!match) {
                  setError('Paste a valid private invitation link.');
                  return;
                }
                location.hash = '#/join/' + match[1];
                setInvitation('');
                setDialog('');
              }}
            >
              Open campaign
            </Button>
          </div>
        </Modal>
      )}
      {dialog === 'import' && imported && (
        <Modal title="Review your backup" onClose={() => setDialog('')}>
          <p>
            {imported.characters.length} characters and {imported.assets.length} images, exported{' '}
            {new Date(imported.exportedAt).toLocaleDateString()}.
          </p>
          <ul>
            {imported.characters.map((c) => (
              <li key={c.id}>
                {c.name} · {classSummary(c)}
              </li>
            ))}
          </ul>
          <Notice>
            Import creates new characters. Your existing characters will not be replaced.
          </Notice>
          <div className="dialog-actions">
            <Button onClick={() => setDialog('')}>Cancel</Button>
            <Button variant="primary" onClick={() => void applyImport()}>
              Import as new characters
            </Button>
          </div>
        </Modal>
      )}
      {dialog === 'history' && character && (
        <Modal title="Recovery history" onClose={() => setDialog('')}>
          <p className="muted">
            Up to 20 checkpoints are kept on this device before major changes. Export JSON for an
            independent backup.
          </p>
          {[...history].reverse().map((h) => (
            <div className="history-row" key={h.id}>
              <strong>{h.label}</strong>
              <p>{new Date(h.at).toLocaleString()}</p>
              <Button
                onClick={() => {
                  void replace(h.character, 'Before recovery restore').then(() => {
                    setDialog('');
                    setToast('Checkpoint restored.');
                  });
                }}
              >
                Restore this checkpoint
              </Button>
            </div>
          ))}
          {!history.length && <p>No checkpoints yet.</p>}
        </Modal>
      )}
      {dialog === 'conflict' && draft && (
        <Modal title="Resolve competing edits" onClose={() => setDialog('')} wide>
          <Notice>Your local draft is retained until every conflict is resolved.</Notice>
          {draft.conflicts.map((c, i) => (
            <div className="conflict" key={i}>
              <h3>{c.path.join(' › ') || 'Character'}</h3>
              <div className="form-grid">
                <label className="conflict-choice">
                  <input
                    type="radio"
                    name={'conflict-' + i}
                    checked={conflictChoices[i] === 'local'}
                    onChange={() => setConflictChoices({ ...conflictChoices, [i]: 'local' })}
                  />
                  <strong>This device</strong>
                  <pre>{JSON.stringify(c.local, null, 2)}</pre>
                </label>
                <label className="conflict-choice">
                  <input
                    type="radio"
                    name={'conflict-' + i}
                    checked={conflictChoices[i] === 'remote'}
                    onChange={() => setConflictChoices({ ...conflictChoices, [i]: 'remote' })}
                  />
                  <strong>Cloud version</strong>
                  <pre>{JSON.stringify(c.remote, null, 2)}</pre>
                </label>
              </div>
            </div>
          ))}
          <div className="dialog-actions">
            <Button onClick={() => setDialog('')}>Keep reviewing later</Button>
            <Button
              variant="primary"
              disabled={Object.keys(conflictChoices).length !== draft.conflicts.length}
              onClick={() =>
                void engine
                  .resolve(draft.characterId, conflictChoices)
                  .then(() => setDialog(''))
                  .catch((e) => setError(e.message))
              }
            >
              Apply choices & save
            </Button>
          </div>
        </Modal>
      )}
      {dialog === 'about' && (
        <Modal title="About DnDev" onClose={() => setDialog('')}>
          <p>
            A lightweight companion for a long-running campaign. {catalog.length.toLocaleString()}{' '}
            bundled published-content records, with sourcebook and version labels.
          </p>
          <h3>Connect your campaign</h3>
          <ol>
            <li>
              Create a free Firebase Spark project; enable anonymous authentication and Firestore
              Standard.
            </li>
            <li>Publish the security rules and create an enabled campaign with a random key.</li>
            <li>Add the public web configuration to GitHub Actions Variables and enable Pages.</li>
            <li>
              Open the private invitation. See the repository deployment guide for exact steps.
            </li>
          </ol>
          <h3>Sources</h3>
          <p>
            This work includes material taken from the System Reference Document 5.1 (“SRD 5.1”) by
            Wizards of the Coast LLC and available at
            https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed
            under the Creative Commons Attribution 4.0 International License available at
            https://creativecommons.org/licenses/by/4.0/legalcode.
          </p>
          <p>
            Additional catalog entries contain references and structured mechanics, with full text
            only where licensed. DnDev is independent and is not endorsed by Wizards of the Coast or
            other publishers.
          </p>
          <p className="muted">
            Remember to export campaign backups. Browser storage can be cleared, and closing a page
            cannot guarantee remote delivery.
          </p>
        </Modal>
      )}
    </div>
  );
}
