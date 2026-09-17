# UX design and review

Desktop: persistent header (campaign, character, save status, menu), identity banner, statistics rail and main section cards. Mobile: the same controls, one content column, and five fixed bottom tabs: Play, Character, Spells, Inventory, Journal. Campaign cards show player, class/level, and save information. Save now is the first menu action. No interaction requires hover.

| Journey           | Friction                               | Revision before implementation                                        |
| ----------------- | -------------------------------------- | --------------------------------------------------------------------- |
| Existing level 10 | Replaying ten levels is slow           | Direct class/level entry and editable values                          |
| Level 1 to 4      | Gains disappear in a long sheet        | Preview named gains, HP, slots, and outstanding choices               |
| Multiclass        | Prerequisite errors block house rules  | Explain requirements, record overrides, distinguish total/class level |
| Inventory         | Consumables disappear after use        | Retain zero quantity, separate charges from quantity                  |
| Custom resource   | Reset rules are hidden                 | Explicit trigger, full/fixed/dice amount, preview                     |
| Rest              | Automatic reset loses exceptions       | Editable before/after confirmation and recovery history               |
| Published sources | Names obscure different versions       | Book/version badges, pinned selections, explicit upgrades             |
| Interrupted save  | Local and remote status look identical | Persistent distinct statuses and a durable conflict resolver          |

Modern, Subtle Fantasy, and Strong Fantasy each have light/dark palettes. Theme variables change colors and accents without changing geometry, field order, typography size, or interactions. Modern follows the device scheme initially. All controls need accessible labels, visible focus, and touch-friendly targets. Dialogs manage focus and Escape. Test every story at 390px and desktop widths without horizontal scrolling.

## Wireframes

Desktop keeps the campaign controls visible above a sheet with a supporting statistics column:

```text
┌ DnDev / campaign / character ───── save status · switch · theme · Actions ┐
│ Character identity                                      Level up · Rest │
├─────────────────┬───────────────────────────────────────────────────────┤
│ Ability scores  │ Play     Character     Spells     Inventory    Journal │
│ Saves & skills  ├───────────────────────────────────────────────────────┤
│ Passive checks  │ Hit points / damage / healing       AC / initiative    │
│ Proficiency     │ Conditions, death saves, rest resources                │
│                 │ Attacks, equipped items, dice                          │
└─────────────────┴───────────────────────────────────────────────────────┘
```

Mobile keeps one content column, persistent header controls, and bottom navigation. Supporting statistics appear below the play controls.

```text
┌ DnDev · save · switch · theme · Actions ┐
│ Character name · class / level         │
│ Level up               Take a rest     │
│                                       │
│ Hit points · damage / healing          │
│ AC · initiative · speed                │
│ Resources and conditions               │
│ Supporting statistics                 │
├───────────────────────────────────────┤
│ Play · Character · Spells · Inventory · Journal │
└───────────────────────────────────────┘
```

## Implemented views

![Desktop character sheet](screenshots/desktop.png)

![Mobile character sheet](screenshots/mobile.png)

## Changes from browser review

- Added a persistent character switch button and per-character roster save information. Switching characters or sections resets scroll position so the primary controls are visible.
- Buffered field input while IndexedDB acknowledges edits, so fast typing cannot be overwritten by an older acknowledgement.
- Used explicit input labels and returned keyboard focus to the opening control after closing a dialog.
- Restricted portrait dimensions, and kept all six theme layouts within the phone viewport.
- Removed duplicate subclass feature gains and inactive subclass effects when changing a selection.
- Preserved Artificer spell lists when consolidating identical reprints. Guided spell choices use each class's progression and include Pact Magic.
- Added previewed content revisions and independent casting controls for spells granted by different features.

The browser suite exercises creation, leveling, direct level entry, multiclass overrides, inventory, custom classes/resources, rests, published selections, images, backups, archive recovery, offline reopening, six themes, and keyboard/contrast checks at both screen sizes.
