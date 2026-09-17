/**
 * Deliberate catalog audit. Downloads reference pages; only metadata/structured facts
 * are emitted for non-SRD works. Raw HTML remains in ignored .cache/catalog.
 * Review the audit report before committing generated data.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { load } from 'cheerio';
const root = 'https://dnd5e.wikidot.com';
const books = JSON.parse(await readFile('src/data/books.json', 'utf8'));
const classNames = [
  'artificer',
  'barbarian',
  'bard',
  'cleric',
  'druid',
  'fighter',
  'monk',
  'paladin',
  'ranger',
  'rogue',
  'sorcerer',
  'warlock',
  'wizard',
];
const allowed =
  /^\/(?:spell:|feat:|background:|lineage:|race:|artificer(?::|$)|barbarian(?::|$)|bard(?::|$)|cleric(?::|$)|druid(?::|$)|fighter(?::|$)|monk(?::|$)|paladin(?::|$)|ranger(?::|$)|rogue(?::|$)|sorcerer(?::|$)|warlock(?::|$)|wizard(?::|$)|spells(?::|$))/;
const normalize = (s) => s.replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();
const slug = (s) =>
  normalize(s)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const emptyMechanics = () => ({
  abilityBonuses: {},
  skills: [],
  saves: [],
  proficiencies: [],
  hpPerLevel: 0,
  acBonus: 0,
  resources: [],
  grantedSpells: [],
  replaces: [],
  prerequisites: '',
  choice: '',
});
await mkdir('.cache/catalog', { recursive: true });
await mkdir('src/data', { recursive: true });
await mkdir('docs', { recursive: true });
let requests = 0;
async function page(path) {
  const file = '.cache/catalog/' + createHash('sha256').update(path).digest('hex') + '.html';
  try {
    return await readFile(file, 'utf8');
  } catch {}
  await new Promise((r) => setTimeout(r, 350));
  let res;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      res = await fetch(root + path, { signal: AbortSignal.timeout(12000) });
      break;
    } catch (e) {
      if (attempt === 2) throw e;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const html = await res.text();
  if (!html.includes('id="page-content"')) throw new Error('Missing page content');
  await writeFile(file, html);
  requests++;
  return html;
}
const queue = ['/', '/spells', '/lineage', ...classNames.map((c) => '/' + c)];
const seen = new Set(),
  entries = [],
  excluded = [],
  failed = [];
const auditDate = new Date().toISOString().slice(0, 10);
function matchedBooks(text) {
  let left = normalize(text),
    result = [];
  const candidates = books
    .flatMap((b) => b.aliases.map((a) => ({ book: b, alias: normalize(a) })))
    .sort((a, b) => b.alias.length - a.alias.length);
  for (const candidate of candidates)
    if (left.includes(candidate.alias)) {
      if (!result.some((b) => b.id === candidate.book.id)) result.push(candidate.book);
      left = left.replaceAll(candidate.alias, '');
    }
  return result;
}
function parse(path, html) {
  const $ = load(html),
    content = $('#page-content');
  content.find('a[href]').each((_, el) => {
    try {
      const u = new URL($(el).attr('href'), root);
      if (
        u.hostname === 'dnd5e.wikidot.com' &&
        allowed.test(u.pathname) &&
        !queue.includes(u.pathname) &&
        !seen.has(u.pathname)
      )
        queue.push(u.pathname);
    } catch {}
  });
  if (path === '/' || /^\/spells/.test(path) || path === '/lineage') return;
  const title = (
    $('#page-title').text().trim() ||
    $('title')
      .text()
      .replace(/ - DND 5th Edition$/, '')
      .trim()
  )
    .replace(/\s*\(HB\)/gi, '')
    .replace(/^Background:\s*/, '');
  if (/\bUA\b|Unearthed Arcana|Archived|playtest/i.test(title)) {
    excluded.push({ path, name: title, reason: 'Playtest/archived page' });
    return;
  }

  const collectionSources = {
    '/artificer:infusions': 'tce',
    '/fighter:battle-master:maneuvers': 'phb',
    '/monk:four-elements:disciplines': 'phb',
  };
  if (collectionSources[path]) {
    const group = path.split(':').at(-1),
      classId = path.slice(1).split(':')[0];
    const newerManeuvers = [
      'Ambush',
      'Bait and Switch',
      'Brace',
      'Commanding Presence',
      'Grappling Strike',
      'Quick Toss',
      'Tactical Assessment',
    ];
    const headings = content.find('h1,h2,h3').toArray();
    for (const h of headings) {
      const name = $(h).text().trim();
      if (!name || /Table of Contents|Level Infusions/i.test(name)) continue;
      if (/\bUA\b|Unearthed|Homebrew/i.test(name)) {
        excluded.push({ path, name, reason: 'Playtest option within mixed collection' });
        continue;
      }
      const b = books.find(
        (b) =>
          b.id ===
          (group === 'maneuvers' && newerManeuvers.includes(name)
            ? 'tce'
            : collectionSources[path]),
      );
      const text = $(h).nextUntil('h1,h2,h3').text(),
        prereq = (text.match(/Prerequisite:\s*([^\n]+)/i) || [])[1] || '';
      const level = Number(
        (prereq.match(/(\d+)(?:st|nd|rd|th)[- ]level/i) || [])[1] ||
          (group === 'infusions' ? 2 : 3),
      );
      entries.push({
        id: slug('feature-' + path + '-' + name + '-' + b.id),
        name,
        category: 'feature',
        sourceIds: [b.id],
        version: b.id + '-2014',
        edition: '2014',
        url: root + path,
        publisher: b.publisher,
        description: '',
        license: 'reference',
        automation: 'reference',
        level,
        classIds: [classId],
        metadata: { selectionGroup: group, choiceParent: group },
        mechanics: { ...emptyMechanics(), prerequisites: prereq.slice(0, 180) },
        dependencies: [],
        supersedes: [],
      });
    }
    return;
  }
  if (path === '/background:marine') content.prepend('<p>Source: Ghosts of Saltmarsh</p>');

  if (/^\/(lineage|race):/.test(path)) {
    const nodes = content.find('h1,h2,p,ul').toArray();
    const headings = nodes.map((el, i) => (el.tagName === 'h1' ? i : -1)).filter((i) => i >= 0);
    if (headings.length) {
      for (let k = 0; k < headings.length; k++) {
        const start = headings[k],
          end = headings[k + 1] ?? nodes.length,
          bookHeading = $(nodes[start]).text().trim();
        const sources = matchedBooks(bookHeading);
        if (!sources.length || /Unearthed|Plane Shift|Homebrew/i.test(bookHeading)) {
          excluded.push({
            path,
            name: title,
            source: bookHeading,
            reason: 'Unverified book or excluded source section',
          });
          continue;
        }
        const section = nodes.slice(start + 1, end);
        const variants = section
          .map((el, i) => (el.tagName === 'h2' ? i : -1))
          .filter((i) => i >= 0);
        const makeRace = (suffix, parts) => {
          const text = parts.map((el) => $(el).text()).join('\n'),
            mechanics = emptyMechanics();
          const speed = text.match(/(?:walking )?speed (?:is|of)\s*(\d+)\s*feet/i);
          if (speed) mechanics.speed = Number(speed[1]);
          const abilityIds = {
            strength: 'str',
            dexterity: 'dex',
            constitution: 'con',
            intelligence: 'int',
            wisdom: 'wis',
            charisma: 'cha',
          };
          for (const match of text.matchAll(
            /(?:Your )?(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) score increases by (\d)/gi,
          )) {
            const id = abilityIds[match[1].toLowerCase()];
            mechanics.abilityBonuses[id] = (mechanics.abilityBonuses[id] || 0) + Number(match[2]);
          }
          if (/increase one ability score|ability scores? of your choice/i.test(text))
            mechanics.choice =
              'Configure flexible ability increases in the character effect editor.';
          entries.push({
            id: slug(
              'race-' + path.slice(1) + '-' + sources.map((b) => b.id).join('-') + '-' + suffix,
            ),
            name: title + (suffix ? ' — ' + suffix : ''),
            category: 'race',
            sourceIds: sources.map((b) => b.id),
            version: sources.map((b) => b.id).join('+') + '-2014',
            edition: '2014',
            url: root + path,
            publisher: sources[0].publisher,
            description: '',
            license: 'reference',
            automation: 'partial',
            level: 0,
            classIds: [],
            metadata: {},
            mechanics,
            dependencies: [],
            supersedes: [],
          });
        };
        if (variants.length) {
          const shared = section.slice(0, variants[0]);
          for (let v = 0; v < variants.length; v++)
            makeRace($(section[variants[v]]).text().trim(), [
              ...shared,
              ...section.slice(variants[v] + 1, variants[v + 1] ?? section.length),
            ]);
        } else makeRace('', section);
      }
      return;
    }
  }

  const nodes = content.find('h1,h2,h3,h4,p,table,ul').toArray();
  const sourcePositions = nodes
    .map((el, i) => (/^Sou(?:r)?ces?:/i.test($(el).text().trim()) ? i : -1))
    .filter((i) => i >= 0);
  // Class pages sometimes omit an explicit source label. Their baseline identity
  // is verified independently; rules automation is maintained in domain/classes.ts.
  if (!sourcePositions.length && classNames.includes(path.slice(1))) {
    const id = path.slice(1),
      b = books.find((b) => b.id === (id === 'artificer' ? 'tce' : 'phb'));
    entries.push({
      id: 'class-' + id + '-' + b.id,
      name: title,
      category: 'class',
      sourceIds: [b.id],
      version: b.id + '-2014',
      edition: '2014',
      url: root + path,
      publisher: b.publisher,
      description: '',
      license: 'reference',
      automation: 'partial',
      level: 1,
      classIds: [id],
      metadata: {},
      mechanics: emptyMechanics(),
      dependencies: [],
      supersedes: [],
    });
    return;
  }
  if (!sourcePositions.length) {
    excluded.push({
      path,
      name: title,
      reason: 'No sourcebook statement; requires provenance review',
    });
    return;
  }
  for (let s = 0; s < sourcePositions.length; s++) {
    const sourceIndex = sourcePositions[s],
      end = sourcePositions[s + 1] ?? nodes.length;
    const sourceText = $(nodes[sourceIndex]).text().trim().split('\n')[0];
    if (/Unearthed Arcana|Plane Shift|Homebrew|UA:/i.test(sourceText)) {
      excluded.push({
        path,
        name: title,
        source: sourceText,
        reason: 'Playtest, web-only, or unpublished source',
      });
      continue;
    }
    const sources = matchedBooks(sourceText);
    if (!sources.length) {
      excluded.push({
        path,
        name: title,
        source: sourceText,
        reason: 'Source not in verified book allowlist',
      });
      continue;
    }
    const isInvocation = path === '/warlock:eldritch-invocations';
    const category = isInvocation
      ? 'feature'
      : path.startsWith('/spell:')
        ? 'spell'
        : path.startsWith('/feat:')
          ? 'feat'
          : path.startsWith('/background:')
            ? 'background'
            : /^\/(lineage|race):/.test(path)
              ? 'race'
              : classNames.includes(path.slice(1))
                ? 'class'
                : path.split(':').length === 2
                  ? 'subclass'
                  : 'feature';
    const classId = path.slice(1).split(':')[0];
    const text = nodes
      .slice(sourceIndex, end)
      .map((el) => $(el).text())
      .join('\n');
    const before = sourceIndex > 0 ? $(nodes[sourceIndex - 1]).text() : '';
    const metadata = { publicationYear: String(Math.max(...sources.map((b) => b.year || 2014))) };
    if (category === 'spell') {
      for (const label of ['Casting Time', 'Range', 'Components', 'Duration']) {
        const match = text.match(new RegExp(label + ':\\s*([^\\n]+)', 'i'));
        if (match) metadata[label] = match[1].trim();
      }
      const spellLine = before + ' ' + text.slice(0, 400);
      const lm = spellLine.match(/([1-9])(?:st|nd|rd|th)[- ]level/i);
      metadata.level = lm ? lm[1] : '0';
      metadata.school = (spellLine.match(
        /abjuration|conjuration|divination|enchantment|evocation|illusion|necromancy|transmutation/i,
      ) || [''])[0];
      metadata.ritual = /\(ritual\)/i.test(spellLine) ? 'true' : 'false';
      metadata.concentration = /Concentration/i.test(metadata.Duration || '') ? 'true' : 'false';
    }
    const prereq = text.match(/Prerequisite(?:s)?:\s*([^\n]+)/i);
    const nearestHeading = isInvocation
      ? nodes
          .slice(0, sourceIndex)
          .filter((el) => /^h[1234]$/.test(el.tagName))
          .at(-1)
      : null;
    const entryTitle = nearestHeading ? $(nearestHeading).text().trim() : title;
    if (isInvocation) {
      metadata.selectionGroup = 'invocations';
      metadata.choiceParent = 'invocations';
    }
    const entry = {
      id: slug(
        category +
          '-' +
          path.slice(1) +
          '-' +
          (isInvocation ? entryTitle + '-' : '') +
          sources.map((b) => b.id).join('-') +
          (s ? '-' + s : ''),
      ),
      name: entryTitle,
      category,
      sourceIds: sources.map((b) => b.id),
      version: sources.map((b) => b.id).join('+') + '-2014' + (s ? '-' + s : ''),
      edition: '2014',
      url: root + path,
      publisher: sources
        .map((b) => b.publisher)
        .filter((v, i, a) => a.indexOf(v) === i)
        .join(' / '),
      description: '',
      license: 'reference',
      automation: 'reference',
      level:
        category === 'spell'
          ? Number(metadata.level)
          : isInvocation
            ? Number((prereq?.[1]?.match(/(\d+)(?:st|nd|rd|th)[- ]level/i) || [])[1] || 2)
            : 0,
      classIds: classNames.includes(classId) ? [classId] : [],
      metadata,
      mechanics: { ...emptyMechanics(), prerequisites: prereq ? prereq[1].slice(0, 180) : '' },
      dependencies: [],
      supersedes: [],
    };
    if (category === 'spell') {
      const lists = text.match(/Spell Lists?\.\s*([^\n]+)/i);
      if (lists) entry.classIds = classNames.filter((c) => lists[1].toLowerCase().includes(c));
    }
    if (category === 'race') {
      const speed = text.match(/(?:walking )?speed (?:is|of)\s*(\d+)\s*feet/i);
      if (speed) entry.mechanics.speed = Number(speed[1]);
      const bonuses = [
        ...text.matchAll(
          /(?:Your )?(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) score increases by (\d)/gi,
        ),
      ];
      const abilityIds = {
        strength: 'str',
        dexterity: 'dex',
        constitution: 'con',
        intelligence: 'int',
        wisdom: 'wis',
        charisma: 'cha',
      };
      for (const match of bonuses)
        entry.mechanics.abilityBonuses[abilityIds[match[1].toLowerCase()]] = Number(match[2]);
      if (/increase one ability score|ability scores? of your choice/i.test(text))
        entry.mechanics.choice =
          'Choose flexible ability increases from your sourcebook in the effect editor.';
    }
    if (category === 'background') {
      const skillLine = text.match(/Skill Proficiencies:\s*([^\n]+)/i);
      if (skillLine)
        entry.mechanics.skills = skillLine[1]
          .split(/,| and /)
          .map((s) => s.trim())
          .filter(Boolean);
    }
    if (
      Object.keys(entry.mechanics.abilityBonuses).length ||
      entry.mechanics.speed ||
      entry.mechanics.skills.length
    )
      entry.automation = 'partial';
    entries.push(entry);
    if (category === 'class' || category === 'subclass') {
      const features = nodes.slice(sourceIndex, end).filter((el) => /^h[234]$/.test(el.tagName));
      for (const el of features) {
        const name = $(el).text().trim();
        if (
          !name ||
          name.length > 120 ||
          /spell|proficiencies|equipment|hit points|quick build/i.test(name)
        )
          continue;
        const following = $(el).nextAll('p').first().text();
        const lm = following.match(
          /(?:at|reach|starting at|beginning at)\s+(\d+)(?:st|nd|rd|th)\s+level/i,
        );
        entries.push({
          ...structuredClone(entry),
          id: slug(entry.id + '-' + name),
          name,
          category: 'feature',
          level: lm ? Number(lm[1]) : 0,
          metadata: { parent: entry.id },
          dependencies: [entry.id],
        });
      }
    }
  }
}
while (queue.some((p) => !seen.has(p))) {
  const batch = queue.filter((p) => !seen.has(p)).slice(0, 3);
  batch.forEach((p) => seen.add(p));
  await Promise.all(
    batch.map(async (path) => {
      try {
        parse(path, await page(path));
      } catch (e) {
        failed.push({ path, error: e.message });
      }
    }),
  );
  if (seen.size % 30 < 3)
    console.log(
      'Audited',
      seen.size,
      'pages;',
      entries.length,
      'entries;',
      queue.length - seen.size,
      'remaining',
    );
}
for (const e of entries) {
  e.revision = 'audit-2026-09-17';
  e.provenance = e.sourceIds.map((id) => {
    const b = books.find((b) => b.id === id);
    return { bookId: id, publisherUrl: b.verificationUrl, page: null, verifiedOn: b.verifiedOn };
  });
  e.metadata.publicationYear = String(
    Math.max(...e.sourceIds.map((id) => books.find((b) => b.id === id)?.year || 2014)),
  );
}
const unique = Array.from(new Map(entries.map((e) => [e.id, e])).values()).sort(
  (a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version),
);
await writeFile('src/data/catalog.generated.json', JSON.stringify(unique, null, 2));
const audit = {
  auditDate,
  pages: seen.size,
  requests,
  included: unique.length,
  counts: Object.fromEntries(
    ['class', 'subclass', 'feature', 'spell', 'race', 'feat', 'background'].map((c) => [
      c,
      unique.filter((e) => e.category === c).length,
    ]),
  ),
  excluded,
  failed,
};
await writeFile('src/data/catalog-audit.json', JSON.stringify(audit, null, 2));
console.log(
  JSON.stringify(
    {
      pages: audit.pages,
      included: audit.included,
      counts: audit.counts,
      excluded: excluded.length,
      failed,
    },
    null,
    2,
  ),
);

if (process.argv.includes('--references-only')) process.exit(0);
// SRD 5.1 data are CC-BY-4.0; the database's software/data formatting is MIT.
const base = 'https://raw.githubusercontent.com/5e-bits/5e-database/main/src/2014/en/5e-SRD-';
for (const name of [
  'Spells',
  'Races',
  'Subraces',
  'Backgrounds',
  'Features',
  'Levels',
  'Equipment',
  'Traits',
]) {
  const response = await fetch(base + name + '.json');
  if (!response.ok) throw new Error('SRD download failed: ' + name);
  const data = await response.json();
  await writeFile('src/data/srd-' + name.toLowerCase() + '.json', JSON.stringify(data));
}
const mit = await fetch(
  'https://raw.githubusercontent.com/5e-bits/5e-database/main/LICENSE.md',
).then((r) => r.text());
await writeFile('docs/5e-database-LICENSE.txt', mit);
