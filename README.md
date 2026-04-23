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
