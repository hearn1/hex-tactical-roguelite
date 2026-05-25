# Feature 00 — Project Skeleton (M0.2)

## Goal
Create a runnable empty project that future implementation sessions can extend. Pick the tech stack and lay down the minimum scaffolding so a developer can launch the app and see a placeholder screen.

## Source Docs
- `SCOPE.md`
- `TECH_PLAN.md` (stack recommendations)
- `IMPLEMENTATION_PLAN.md` (Phase 0)
- `ROADMAP.md` (M0.2)
- `CLAUDE.md`

## Includes
- Pick the stack: Unity 2D, Godot 2D, or Web TypeScript/React/Canvas (see `TECH_PLAN.md`).
  - For an LLM-coding-agent friendly path, **Web TypeScript + Canvas (or React + Canvas)** is the recommended default unless the environment has Unity/Godot pre-configured.
- Initialize the project (package manager, build tool, run command).
- Add a main entry point and a placeholder "DnRogueLite — Prototype" screen with a button labeled "Start Combat Sandbox" (button can be a stub for now).
- Add a basic test harness (e.g., Vitest/Jest for web, NUnit for Unity, GUT for Godot) with one trivial passing test.
- Add `RUN.md` documenting: install, run, test commands.
- Stub the module skeleton from `TECH_PLAN.md`:
  - `DataRepository`, `RunManager`, `CombatManager`, `HexGrid`, `RewardManager`, `MetaProgressionManager`, `InventoryManager`, `UI`
  - Each can be an empty class/module with a TODO comment.

## Out of Scope
- Any gameplay logic.
- Asset pipeline beyond placeholder colors/text.
- CI configuration (later milestone if needed).

## Acceptance Criteria
- Repo clone + documented install command + run command launches the placeholder screen.
- `npm test` (or equivalent) runs at least one trivial passing test.
- `RUN.md` exists and is accurate.

## Suggested Session Prompt
> Implement Feature 00 — Project Skeleton. Read `SCOPE.md`, `TECH_PLAN.md`, `IMPLEMENTATION_PLAN.md`, `ROADMAP.md` (M0.2), and `CLAUDE.md` first. Pick a stack (Web TS + Canvas recommended), create a runnable skeleton with placeholder main menu, set up a test harness, stub the core module files, and produce `RUN.md`.
