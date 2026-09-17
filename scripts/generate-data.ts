import { mkdir, writeFile } from 'node:fs/promises';
import { catalog, books } from '../src/data/catalog';
import { exampleCharacters } from '../src/data/fixtures';
import { makeBackup } from '../src/storage/backup';
await mkdir('fixtures', { recursive: true });
const chars = exampleCharacters();
for (let i = 0; i < chars.length; i++) {
  const c = chars[i];
  c.id = '00000000-0000-4000-8000-' + String(i + 1).padStart(12, '0');
  c.updatedAt = 0;
  c.levelHistory.forEach((h) => (h.at = '2026-01-01T00:00:00.000Z'));
}
const backup = makeBackup(chars);
backup.exportedAt = '2026-01-01T00:00:00.000Z';
await writeFile('fixtures/example-campaign.json', JSON.stringify(backup, null, 2));
const categories = ['class', 'subclass', 'feature', 'race', 'feat', 'background', 'spell'];
let text =
  '# Catalog coverage\n\nGenerated from the bundled catalog. Sourcebook publication is checked against the allowlist; full descriptions are included only for SRD 5.1 records. Automated means implemented sheet effects, not combat adjudication. Partial and reference entries may require player configuration.\n\n| Category | Records | Automated | Partial | Reference |\n|---|---:|---:|---:|---:|\n';
for (const category of categories) {
  const list = catalog.filter((e) => e.category === category);
  text +=
    '| ' +
    [
      category,
      list.length,
      ...['automated', 'partial', 'reference'].map(
        (mode) => list.filter((e) => e.automation === mode).length,
      ),
    ].join(' | ') +
    ' |\n';
}
text +=
  '\n## Record inventory\n\n| Entry | Category | Book/version | Coverage |\n|---|---|---|---|\n';
for (const e of catalog)
  text +=
    '| [' +
    e.name.replaceAll('|', '/') +
    '](' +
    e.url +
    ') | ' +
    e.category +
    ' | ' +
    e.sourceIds.join(', ') +
    ' · ' +
    e.version +
    ' | ' +
    e.automation +
    ' |\n';
await writeFile('docs/catalog-coverage.md', text);
console.log(
  'Generated six synthetic fixture sheets and coverage for ' +
    catalog.length +
    ' records from ' +
    books.length +
    ' books.',
);
