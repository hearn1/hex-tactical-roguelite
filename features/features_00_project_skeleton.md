# Feature 00 — Project Skeleton (M0.2)

## Goal
Create a runnable empty project that future implementation sessions can extend. Lay down the locked stack and folder layout from `ARCHITECTURE.md` so subsequent features land cleanly.

## Source Docs
- `ARCHITECTURE.md` ← **read this first; it locks the stack and folder layout**
- `SCOPE.md`
- `TECH_PLAN.md`
- `IMPLEMENTATION_PLAN.md` (Phase 0)
- `ROADMAP.md` (M0.2)
- `CLAUDE.md`

## Includes

### Stack (locked — do not deviate)
- Vite + TypeScript (strict mode).
- Vanilla DOM + Canvas. **No React, no other framework.**
- Vitest for tests.
- npm for package management.

### Project initialization
- `npm create vite@latest . -- --template vanilla-ts` (or equivalent manual setup).
- Add Vitest to `devDependencies`. Wire `"test": "vitest run"` and `"test:watch": "vitest"` scripts.
- Configure `tsconfig.json` with `"strict": true`, `"target": "ES2022"`, `"moduleResolution": "Bundler"`.
- `.gitignore` covers `node_modules/`, `dist/`.

### Folder structure
Create the folder skeleton from `ARCHITECTURE.md` § Folder Layout. Each module file may be a near-empty stub with a TODO. At minimum create these files now:

- `src/main.ts` — mounts the app, calls `App.render()`.
- `src/ui/App.ts` — top-level screen router. For this feature, it renders the main menu screen.
- `src/ui/screens/MainMenu.ts` — displays title "DnRogueLite — Prototype" and a single button "Start Combat Sandbox" that for now just logs `console.log("TODO: start combat")`.
- `src/state/GameState.ts` — exports a singleton `gameState` with `screen: "main_menu"` and a stub `rng` from `createRng(Date.now())`.
- `src/state/types.ts` — exports `ScreenId` union type per `ARCHITECTURE.md` § Screen Routing.
- `src/core/hex.ts` — empty module, with `export const HEX_SIZE = 36;` and the `AXIAL_DIRS` constant from `ARCHITECTURE.md`. The math functions land in Feature 01.
- `src/core/rng.ts` — implements `createRng(seed)` exactly per `ARCHITECTURE.md` § RNG.
- `src/core/rng.test.ts` — one test: `createRng(42)()` produces a deterministic value; same seed gives same sequence.

### Documentation
- `RUN.md` with three sections: **Install** (`npm install`), **Run** (`npm run dev`), **Test** (`npm test`).

## Out of Scope
- Hex math (Feature 01).
- Any unit/combat/UI logic beyond the placeholder menu button.
- CI configuration.
- Linting setup (optional).

## Acceptance Criteria
- `npm install && npm run dev` opens the placeholder main menu in a browser at the URL Vite prints.
- Clicking "Start Combat Sandbox" logs to the dev console (no crash).
- `npm test` passes at least one test (the RNG determinism test).
- The folder skeleton matches `ARCHITECTURE.md` (extra empty files for later modules are fine and encouraged).
- `RUN.md` is accurate.

## Suggested Session Prompt
> Implement https://github.com/hearn1/hex-tactical-roguelite/issues/2 (Feature 00 — Project Skeleton).
>
> Read `ARCHITECTURE.md`, `SCOPE.md`, `TECH_PLAN.md`, `ROADMAP.md` (M0.2), and `CLAUDE.md`. Lock the stack to Vite + TypeScript + vanilla DOM/Canvas + Vitest. Create the folder skeleton from `ARCHITECTURE.md`, a placeholder main menu, the `createRng` helper with a deterministic-seed test, and `RUN.md`. Do not implement any gameplay.
