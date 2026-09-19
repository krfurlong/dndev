# DnDev

**Your character. Every chapter.** A mobile-friendly 2014 D&D 5e sheet for one trusted campaign, hosted on GitHub Pages. Local drafts save immediately; Firebase adds private campaign sharing and remote saves approximately every three seconds while edits are pending.

No player registration, server, subscription, administrator key, or payment card is required. Everyone with the private invitation can read and edit all campaign characters. The public GitHub repository contains the application and reviewed catalog, never the invitation or campaign data.

## Try it locally

Install Node.js 22.12+ and pnpm 11.19.0, then:

```sh
pnpm install
pnpm dev
```

Open the printed local address and choose **Explore an example campaign**. The six synthetic sheets cover a starter, level 4, level 10, multiclass spellcaster, expanded-source character, and custom resources. No Firebase setup is needed for the local example.

For cloud access, copy `.env.example` to ignored `.env.local` and supply the four public Firebase web values. See [deployment](docs/deployment.md).

## At the table

- **Play:** HP, damage/healing, temporary HP, combat statistics, favorite equipment/spell cards, conditions, death saves, and resources. Roll d20s at the table.
- **Spells:** favorites, preparation, ordinary slots, separate Pact Magic, concentration, free spell grants, configurable resource costs, and editable combat references.
- **Inventory:** favorite equipment, calculated or custom weapon damage, quantities, charges, containers, weight, attunement, and five coin denominations.
- **Actions → Advanced settings:** abilities, training, classes, leveling, published selections, overrides, portrait/faction artwork, and collapsed biography, journal, and legacy action notes.

Use the persistent **Actions** menu for **Save now**, rests, leveling, recovery history, exports, and archive/restore. Star items and spells to show them on Play, where you can cast or use them directly. Stars do not change equipment or preparation. Existing custom damage text is preserved; see [combat references and adoption](docs/ux.md#rules-and-editing-boundaries). Six appearances share the same layout. An installed/cached app can reopen offline after its first complete online load.

Published content has source and automation labels. Core progression, multiclass slot arithmetic, key resource pools, configured bonuses, and rest recovery are calculated. Flexible choices and contextual feature effects remain player-controlled. This is a character sheet, not an automatic combat referee or a replacement for sourcebooks. See the detailed [coverage inventory](docs/catalog-coverage.md).

## TODOs (remaining)
8. Verify the private invitation and saving on two devices before sharing it with the group.
9. Export campaign JSON periodically and keep a copy outside the browser.

The [deployment guide](docs/deployment.md) gives exact steps, field names, troubleshooting, and invitation replacement. No Firebase service-account JSON or GitHub personal access token belongs in this application or workflow.

## Development and verification

```sh
pnpm typecheck
pnpm test
pnpm catalog:check
pnpm test:security
pnpm exec playwright install chromium
```

Security tests need Java 21+ and download local Firebase emulators. They use `demo-dndev`, not a production project.

Browser tests deliberately use the `/DnDev/` Pages subpath. On macOS/Linux:

```sh
BASE_PATH=/DnDev/ pnpm build
BASE_PATH=/DnDev/ pnpm test:e2e
```

On PowerShell:

```powershell
$env:BASE_PATH = '/DnDev/'
pnpm build
pnpm test:e2e
```

[Testing notes](docs/testing.md) describe the suites and the Windows Java socket workaround. [fixtures/example-campaign.json](fixtures/example-campaign.json) can be imported from the campaign screen. To regenerate fixtures and the coverage inventory, run `node scripts/fixtures-report.mjs`.

## Design documents

| Guide                                      | Contents                                                                                |
| ------------------------------------------ | --------------------------------------------------------------------------------------- |
| [Architecture](docs/architecture.md)       | Storage, access boundary, save protocol, conflict handling, durability, and tradeoffs   |
| [UX](docs/ux.md)                           | Desktop/mobile wireframes and revisions against the player journeys                     |
| [Content catalog](docs/content-catalog.md) | Publication eligibility, audit, source versions, gaps, and refresh procedure            |
| [Deployment](docs/deployment.md)           | Free account setup, Pages workflow, invitation management, backups, and troubleshooting |
| [Attribution](docs/attribution.md)         | SRD 5.1 CC-BY attribution and third-party reference policy                              |

Application code is MIT licensed. Game content has separate attribution and redistribution terms.
