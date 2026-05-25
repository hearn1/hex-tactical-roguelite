# Feature 01 — Hex Grid (M1.1)

## Goal
Implement hex-grid math in `src/core/hex.ts` and render an interactive hex grid on a canvas inside a new `CombatScreen` placeholder. No units, no turns, no actions yet.

## Source Docs
- `ARCHITECTURE.md` ← coordinate system, hex size, helper module location
- `COMBAT_DESIGN.md` § Coordinates, § Prototype Grid
- `ROADMAP.md` (M1.1)

## Includes

### `src/core/hex.ts`
Implement and export:

```ts
export interface Hex { q: number; r: number; }

export const HEX_SIZE = 36;

export const AXIAL_DIRS: Hex[] = [
  { q: +1, r:  0 }, { q: +1, r: -1 }, { q:  0, r: -1 },
  { q: -1, r:  0 }, { q: -1, r: +1 }, { q:  0, r: +1 },
];

export function hexEquals(a: Hex, b: Hex): boolean;
export function hexKey(h: Hex): string;                       // "q,r"
export function neighbors(h: Hex): Hex[];                     // 6 neighbors
export function distance(a: Hex, b: Hex): number;             // axial distance
export function hexesWithinRange(center: Hex, radius: number): Hex[]; // includes center
export function hexToPixel(h: Hex): { x: number; y: number };         // pointy-top
export function pixelToHex(px: number, py: number): Hex;              // for click hit-test
```

Pointy-top conversion (per `ARCHITECTURE.md`):
```ts
x = HEX_SIZE * (sqrt(3) * q + sqrt(3)/2 * r)
y = HEX_SIZE * (3/2 * r)
```

Inverse via cube-rounding (look up "pixel to hex pointy-top axial" — Red Blob Games is the canonical reference).

### Rendering
- Create `src/ui/HexRenderer.ts` exporting `renderGrid(ctx, hexes, options)` and `renderHexOutline(ctx, hex, color)`.
- Build a grid of `hexesWithinRange({q:0,r:0}, 3)` (37 cells, hex radius 3 per `COMBAT_DESIGN.md`).
- Add `src/ui/screens/CombatScreen.ts` that creates a `<canvas width=640 height=480>` and renders the grid centered around `GRID_ORIGIN = { x: 320, y: 240 }`.
- Wire the main-menu button from Feature 00 to set `gameState.screen = "combat"` and re-render. Add `"combat"` to the App router.

### Interaction
- Track `hoveredHex: Hex | null` and `selectedHex: Hex | null` on a local screen state (does **not** need to live in `GameState` yet).
- Mousemove on canvas → update `hoveredHex` via `pixelToHex` (clamped to grid); request re-render.
- Click on canvas → update `selectedHex`.
- Hover highlight: light fill; selected: thicker stroke. Pick any readable colors.
- Optional debug overlay: render `"q,r"` text on each hex; toggle with a button or always-on for now.

### Tests (`src/core/hex.test.ts`)
- `distance({q:0,r:0}, {q:0,r:0}) === 0`
- `distance` is symmetric for a few sample pairs.
- `neighbors({q:0,r:0}).length === 6` and all are distance 1.
- `hexesWithinRange(center, 0).length === 1`, `radius 1 → 7`, `radius 2 → 19`, `radius 3 → 37`.
- `pixelToHex(hexToPixel({q:2,r:-1}))` round-trips to `{q:2,r:-1}`.

## Out of Scope
- Units, turn order (Feature 02).
- Line-of-sight, terrain.

## Acceptance Criteria
- Clicking the main-menu button opens the combat screen.
- A 37-cell hex grid is visible and centered.
- Hovering highlights a hex; clicking selects it.
- `npm test` passes the new hex tests.

## Suggested Session Prompt
> Implement https://github.com/hearn1/hex-tactical-roguelite/issues/3 (Feature 01 — Hex Grid).
>
> Read `ARCHITECTURE.md`, `COMBAT_DESIGN.md` (Coordinates + Prototype Grid), and `ROADMAP.md` (M1.1). Implement `src/core/hex.ts` with axial math + pointy-top pixel conversion, `HexRenderer.ts` and a `CombatScreen` rendering a 37-cell grid with hover/click selection, and pass the listed unit tests.
