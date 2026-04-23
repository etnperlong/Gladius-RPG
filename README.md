# ⚔ Gladius RPG

A browser-based text RPG with turn-based combat, randomized loot, quests, arena battles, and inventory progression. The current migrated runtime now runs through Parcel + React + TypeScript while legacy standalone files remain in the repo as behavior references.

## 🎮 Run The Game

Install dependencies:

```bash
npm install
```

Start the Parcel dev server:

```bash
npm run dev
```

Build a production bundle:

```bash
npm run build
```

Run type-checking:

```bash
npm run typecheck
```

Run tests:

```bash
npx vitest run
```

## ✨ Features

- Dynamic turn-based combat with weapon traits and battle logs
- Randomized loot, enhancement, training, and inventory management
- Expedition, dungeon, quest, arena, shop, auction, and mercenary flows
- Traditional Chinese UI

## 🛠️ Tech Stack

- React 19
- TypeScript
- Parcel
- Vitest

## ✅ Migration Verification

- Dev-mode runtime was exercised with `npm run dev`; Parcel served the migrated app successfully on a local port during Task 5 smoke testing.
- Fresh-state startup was verified because no existing save was present in the test browser context at the start of the run.
- Expedition flow was exercised with `狼群獵場`; battle log, rewards, gold/EXP updates, and item drop UI all rendered.
- Dungeon flow was exercised with `野狼森林【普通】`; multi-wave combat, level-up, and boss-loss result handling all rendered.
- Inventory interaction was exercised by equipping `皮靴`; visible defense and speed values updated in the character panel.
- Shop flow was exercised by buying one `銅戒指` and then selling it back through the sell view.
- Auction coverage was limited to the inspection path; listings, current bids, and disabled bid controls were confirmed, but no bid was placed because the smoke-test character did not have enough gold for the minimum bid.
- Training flow was exercised with one HP training action; gold and max HP changed and persisted after reload.
- Quest rendering was exercised by opening the quest tab and confirming progress values were shown.
- Arena flow was exercised by challenging one opponent; combat report, defeat handling, and cooldown messaging all rendered.
- Persistence was exercised by saving, reloading the page, and confirming player state plus equipped inventory restored from `localStorage`.

## Known Issues

- The training screen still shows `NaN` in several displayed stat rows (`攻擊力`, `防禦力`, `速度`) even though the HP training action itself executed correctly during smoke testing. This remains a follow-up item.

## 📁 Runtime Notes

- `index.html` is the Parcel entry used by the migrated app.
- Legacy standalone files such as `gladius.html`, `App.jsx`, and `gladiatus-clone.jsx` are still kept as references during the migration.
- Historical backup variants remain in the repository and should not be treated as the active runtime.

## 📁 Reference Files

| File | Description |
|------|-------------|
| `index.html` | Parcel entry for the current migrated runtime |
| `gladius.html` | Legacy standalone build kept for reference |
| `gladius-guide.txt` | Beginner's guide (Traditional Chinese) |
| `App.jsx` / `gladiatus-clone.jsx` | Legacy source snapshots used as migration references |

## Disclaimer

This is an educational, non-profit, fan-made project. All original game concepts belong to their respective copyright holders.
