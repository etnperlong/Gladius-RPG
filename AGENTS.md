# AGENTS.md

## Project Identity

- Project: `Gladius-RPG`
- Type: browser-based text RPG / turn-based combat game
- Current primary stack: Parcel + React 19 + TypeScript
- Current UI language: Traditional Chinese

## Current Runtime Source Of Truth

- Active app entry: `src/main.tsx`
- Root app shell: `src/App.tsx`
- Main game composition: `src/game/GameApp.tsx`
- Current gameplay state orchestration: `src/game/useGameState.ts`

Do not treat old standalone files as the active runtime architecture.

## Current Architecture Summary

The active application is now a modular `src/`-based app.

### Main directories

- `src/game/` - game state, domain systems, data tables, persistence, and app-facing types
- `src/features/` - feature-level UI such as dungeon, battle, inventory, shop, quests, arena, tavern, and mercenary flows
- `src/components/` - reusable presentation components
- `src/layout/` - shared layout pieces
- `src/styles/` - shared global styling and tokens

### Important files

- `src/game/appTypes.ts` - current broad app-facing runtime type bridge
- `src/game/game.css` - active game stylesheet moved out of the removed legacy surface
- `src/game/systems/*` - framework-independent gameplay logic
- `src/game/data/*` - structured gameplay content and constants

## Working Rules

- Prefer changing the modular app under `src/`
- Preserve gameplay behavior unless a plan explicitly changes it
- Keep domain/system logic out of React components when possible
- Treat persistence compatibility carefully when changing player or inventory shapes

## Verification Commands

- `npm run typecheck`
- `npm test`
- `npm run build`

## Legacy Surface Policy

There are still historical non-runtime files in the repository, including older standalone snapshots and other leftover artifacts from earlier phases.

- They are not the active architecture.
- They should be treated as pending cleanup input for a later dedicated plan.
- Do not reintroduce them as the source of truth while working on the current app.

## Near-Term Cleanup Note

The next cleanup phase may remove obsolete legacy files such as old standalone `html`, `jsx`, and other archival artifacts once their remaining value is reviewed.
