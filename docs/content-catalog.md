# Published content catalog

The application bundles **2014-compatible** content. It does not query Wikidot while someone creates or plays a character. Catalog changes are deliberate repository changes, reviewed with tests and a new build.

## Eligibility and provenance

An entry qualifies when it can be tied to a published print or digital 5e sourcebook, supplement, setting, or adventure. [books.json](../src/data/books.json) is the explicit allowlist, recording publisher, publication year, compatible edition, publication-evidence URL, and audit date.

Wikidot is used for discovery and source references, not as the authority for publication. An “HB” label alone does not exclude a published third-party book. The catalog includes Tal'Dorei publications and the original 2014-compatible versions of Exploring Eberron and Dread Metrol. [Darrington Press confirms both Tal'Dorei books](https://darringtonpress.com/taldorei-campaign-setting-reborn/); [Keith Baker describes Exploring Eberron](https://keith-baker.com/faq-exe/) as a published sourcebook.

Unearthed Arcana, playtests, unpublished homebrew, unsupported 2024 revisions, Plane Shift web articles, and unverified sources are excluded. A generic “D&D Beyond”, “DMSGuild”, or “ThinkDM” source label does not establish a qualifying book. Character-specific custom classes, items, spells, and resources remain available in the editor and are never promoted into the published catalog.

Individual source sections matter. The audit separates racial printings, reads individual invocation source statements, and excludes UA-marked infusions inside an otherwise published collection. Infusions, maneuvers, disciplines, and invocations are features, not subclasses. Misspelled “Souce” labels and punctuation variants are normalized.

## Audit result and gaps

The checked-in discovery audit covers **1,254 pages**, **40 approved publications**, and **1,787 reference records**. Adding licensed SRD content and consolidating identical PHB spell reprints (retaining their source evidence and class lists) produces **2,227 selectable records**. There are **334 exclusion records** and no failed page downloads in this snapshot.

See:

- [Full inclusion and automation inventory](catalog-coverage.md).
- [Sourcebook inventory](../src/data/books.json).
- [Raw inclusion data](../src/data/catalog.generated.json).
- [Exclusions and discovery statistics](../src/data/catalog-audit.json).

Coverage describes the discovered snapshot, not every published D&D book or every future wiki revision. Unresolved background sources, heroic-chronicle web material, and generic website-only source labels are listed in the exclusion report. Some excluded pages contain useful material; they are held out until the publication/version is established.

Verified page numbers are recorded as null when unavailable. No page number is guessed. Publication verification proves the book exists; detailed contextual rules still require the user's sourcebook. The initial audit does not claim that every gameplay effect is fully automated.

## Redistribution boundary

SRD 5.1 text is bundled under CC-BY-4.0, with attribution in the application and [attribution.md](attribution.md). For other publications the bundle contains names, references, factual metadata, and independently written sheet mechanics. Full descriptions and sourcebook artwork are absent.

The audit cache contains raw reference HTML only in ignored `.cache/catalog`. Do not commit it. The generated exclusion report retains source names, not pasted rule paragraphs. Source text should not be added to the public bundle without a documented redistribution basis. [Wizards' fan-content policy](https://company.wizards.com/en/legal/fancontentpolicy) is not a blanket license to repost rules.

## Versions, dependencies, and upgrades

Stable content IDs identify an entry/printing. Book versions remain distinct where the wiki gives distinct source sections. Identical PHB/SRD spell entries are represented by the licensed SRD record; multi-source entries retain their source IDs. Mechanically uncertain reprints stay separate instead of being silently treated as identical.

New search results order equivalent names by publication year, newest 2014-compatible printing first. Earlier versions remain selectable. Selecting a different racial or class-specific subclass version deactivates the earlier selection rather than stacking both.

Each character stores a complete snapshot of selected content, including its source/version, mechanics, and revision. A change to bundled descriptions, mechanics, dependencies, or metadata changes the data revision. Existing selections remain pinned. **Character → Content updates** appears when a selected ID has a newer revision and shows old/new mechanics before applying. User-specific mechanics would be replaced by that explicit upgrade; choice notes remain, and a recovery checkpoint is retained.

Dependencies refer to stable catalog IDs and are validated in tests. Class features are attached at the relevant progression level, with licensed base features preferred over duplicate references. Optional feature selections remain choices.

## Automation coverage

| Area                                             | Implemented behavior                                                                                        | Player review / configuration                                                                 |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Core classes and Artificer                       | Total/class levels, HP progression, proficiency, multiclass prerequisites, key expendable resource pools    | Equipment choices and contextual feature adjudication                                         |
| Leveling                                         | Before/after preview, subclass choice, ASI or feat, spell/feature selection, pinned gains and level history | Known/prepared spell counts, some optional choices and replacements                           |
| Multiclass spellcasting                          | Full/half/Artificer/third-caster rounding; Pact Magic tracked independently                                 | Which spells each individual class may learn; custom progression overrides                    |
| Race/lineage and feats                           | Structured ability/HP/AC/skill effects; incompatible versions deactivated                                   | Flexible bonuses, prerequisite conditions not reducible to attributes, contextual traits      |
| Subclasses / invocations / infusions / maneuvers | Selectable pinned references, class-filtered choices, some resource recipes                                 | Most attack/adjudication effects; complex prerequisite chains and equipment-dependent effects |
| Spell grants                                     | Independent ability, free uses, recovery trigger, and optional named resource cost                          | Select qualifying additional spells and per-spell exceptions                                  |
| Optional feature replacement                     | Explicit replacement deactivates old bonuses, linked resources, and granted spells                          | Choose which option replaces which source feature                                             |
| Backgrounds                                      | Identity, listed skill proficiencies where structured, configurable spell/effect grants                     | Flexible training and narrative benefits                                                      |
| Inventory                                        | Quantities, charges, equipment/attunement, containers, weight, coin denominations                           | Attack formulas, unusual armor, encumbrance consequences                                      |
| Rests                                            | Editable atomic preview, Hit Dice spending, half-dice long-rest recovery, slots/resources/grants            | Rest eligibility, food/drink, conditional recharge, special class exceptions                  |
| Custom content                                   | Custom class tracks, text features, items, spells, and recharge resources                                   | The player's own mechanics and source accuracy                                                |

“Automated” in the UI means the represented sheet effects are implemented. “Partial” means some fields have recipes or licensed reference data. “Reference” means the option is selectable and preserved, with effects configured by the player. Complex 5e choices should be checked against the source rather than assumed from a badge.

## Deliberate refresh procedure

1. Export representative characters before changing the catalog.
2. Review publisher/book evidence before adding an allowlist entry. Retain source aliases, edition, year, and verification URL.
3. Run `pnpm catalog:refresh`. This deliberately downloads public reference pages and licensed SRD data. Existing ignored HTML is reused; remove only the specific cached page being refreshed, or use a fresh workspace for a full audit.
4. Review `catalog-audit.json`, failed downloads, included records, and individual mixed-source sections. A zero failed-download count is required by `catalog:check`.
5. Check source/version changes, dependencies, duplicate names, ability metadata, spell levels, and redistribution status. Do not infer mechanical equivalence merely from matching names.
6. Update reviewed mechanic recipes and progression handling. Do not silently change character snapshots.
7. Run `pnpm catalog:check`, `pnpm test`, browser journeys, and `node scripts/fixtures-report.mjs`.
8. Review the generated diff and coverage guide, then deploy through the normal workflow.
