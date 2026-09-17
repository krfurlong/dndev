import { readFile } from 'node:fs/promises';
const data = JSON.parse(await readFile('src/data/catalog.generated.json', 'utf8')),
  books = JSON.parse(await readFile('src/data/books.json', 'utf8')),
  audit = JSON.parse(await readFile('src/data/catalog-audit.json', 'utf8'));
const ids = new Set(),
  errors = [];
for (const e of data) {
  if (ids.has(e.id)) errors.push('Duplicate ID: ' + e.id);
  ids.add(e.id);
  if (e.edition !== '2014' || /\bUA\b|Unearthed Arcana|playtest/i.test(e.name))
    errors.push('Excluded content included: ' + e.id);
  if (e.license !== 'reference' || e.description) errors.push('Unlicensed prose: ' + e.id);
  if (!e.provenance?.length || !e.sourceIds.every((id) => books.some((b) => b.id === id)))
    errors.push('Missing provenance: ' + e.id);
  if (e.category === 'subclass' && /invocations|infusions|maneuvers/i.test(e.name))
    errors.push('Collection miscategorized: ' + e.id);
  for (const source of e.provenance || [])
    if (!/^https:\/\//.test(source.publisherUrl))
      errors.push('Missing publisher reference: ' + e.id);
}
for (const e of data)
  for (const dependency of e.dependencies)
    if (!ids.has(dependency)) errors.push('Missing dependency: ' + dependency);
if (audit.failed.length)
  errors.push('Unresolved downloads: ' + audit.failed.map((f) => f.path).join(', '));
if (!data.some((e) => e.name === 'Cruel' && e.sourceIds.includes('taldorei-reborn')))
  errors.push('Published third-party feat missing');
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(
  'Catalog valid: ' +
    data.length +
    ' reference entries, ' +
    books.length +
    ' approved books; ' +
    audit.pages +
    ' pages audited, ' +
    audit.excluded.length +
    ' exclusions recorded.',
);
