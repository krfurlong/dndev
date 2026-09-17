# Synthetic example campaign

Import [example-campaign.json](example-campaign.json) from the campaign screen. The preview creates new characters, so it is safe to reuse for manual checks.

The six sheets cover a starter, level 4 ranger, copied level 10 wizard, multiclass spellcaster, published expanded-source character, and custom resource character. They contain invented identities and no real invitation or access credentials.

The generator source is `src/data/fixtures.ts`. Run `node scripts/fixtures-report.mjs` to regenerate this JSON and the catalog coverage report. Nested IDs are stable within each exported fixture; imports allocate new character/image IDs while retaining internal collection identities.
