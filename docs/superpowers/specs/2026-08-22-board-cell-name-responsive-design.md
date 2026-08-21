# Responsive Board Cell Name Typography (Rotation)

Date: 2026-08-22

## Problem

The 40-space Monopoly board is rendered as an 11×11 CSS grid (`BoardGrid.tsx`) that stretches to fill the viewport inside `GameBoard.tsx` (`w-screen h-screen` wrapper with a `w-[calc(100vw-16px)] h-[calc(100vh-16px)]` inner box). Because the board always fills the viewport, cell dimensions vary wildly with screen size and orientation:

| Viewport | Board | Cell size | Cell shape |
|----------|-------|-----------|------------|
| Phone portrait 390×844 | 374×828 | 34×75 | narrow & tall |
| Small phone 320×568 | 304×552 | 28×50 | narrow & tall |
| Phone landscape 844×390 | 828×374 | 75×34 | wide & short |
| Desktop 1440×900 | 1424×884 | ~129×80 | wide & short |
| Big desktop 1920×1080 | 1904×1064 | ~173×97 | wide & short |

City names are rendered on a `<button class="cell-name">` that is a flex item inside a `flex flex-col items-center justify-center` cell. Two problems resulted from the original fixed `text-xs`:

1. **Clipping (the main bug)**: the name button is a flex item with `min-width: auto` (the default). Inside a `flex-col items-center` cell it refuses to shrink below its content width, so on phone portrait a name like "Manchester" (66px wide at 12px) overflowed the 34px cell and was cut off by the cell's `overflow-hidden`. Verified: `scrollWidth 66 > clientWidth 32` for space 32 at 390×844.
2. **Fixed typography**: a single 12px size was too small on big desktop cells and too large on phones. There was no responsive behavior.

The i18n strings themselves are fine; this is purely a rendering/layout problem in `BoardGrid.tsx` + `index.css` (plus regression tests).

## Goal

City names render well on every screen size and orientation, with phone portrait as the priority. Concretely:

- No cell-name text is ever clipped (horizontal or vertical) at any viewport.
- Phone portrait: names read **vertically** (top-to-bottom, like a real Monopoly board) so the narrow cell width stops being the binding constraint — the tall cell height is used instead. Never wrapped.
- Landscape/desktop: names stay horizontal on one line.
- Font size scales with the screen (fluid typography) instead of being a fixed 12px.
- Houses/hotel markers still render alongside the name in portrait.

## Chosen approach: rotate names in portrait, fluid font

Pure CSS + tiny TSX class change. No new dependencies, no JS measurement, no i18n changes, no board data changes. The board keeps its "fills the viewport" layout (that's already the phone-friendly, vertical-focused design).

### Portrait (`@media (orientation: portrait)`)

Cells are tall-and-narrow (e.g. 34×75 at 390×844). In portrait only:

- `.cell-name` gets `writing-mode: vertical-rl` + `white-space: nowrap` — the name flows top-to-bottom in a column roughly `font-size` wide, using the 75px cell height instead of the 34px width. Even "Water Company" (13 glyphs) fits.
- Fluid font: `clamp(6px, min(2.6vw, 1.05vh), 14px)`. The `1.05vh` term bounds the font by the cell height, which is the binding constraint in portrait (the name column's height = glyph count × font size). Verified against the e2e Chromium font metrics (see Testing).
- The cell switches to `flex-direction: row` so the houses/hotel button renders **beside** the rotated name instead of below it (the 34px width fits name column + house column; the stacked-column layout would overflow the 75px height).
- `.cell-houses` also goes `writing-mode: vertical-rl`, `font-size: 9px`.

### Landscape / desktop (default, no media query)

Cells are wide-and-short. Names stay horizontal, one line:

- `.cell-name` keeps `w-full min-w-0 whitespace-nowrap` with fluid `text-[clamp(7px,min(2.6vw,2.2vh),14px)]` (in the TSX className).
- `.cell-houses` shrinks to `clamp(8px, min(2.2vw, 2vh), 12px)` so a 4-house row doesn't eat the short cell.

### Why viewport units, not container queries

The cell size is a deterministic fraction of the viewport (board = viewport − 16px, cells = board/11), so `min(2.6vw, 1.05vh)` tracks cell size across all screens and orientations without needing per-cell `container-type` or ResizeObserver JS. Orientation maps 1:1 to cell shape because the board fills the viewport.

Measured live (real e2e Chromium, no injected CSS) at phone sizes:

| Viewport | font-size | writing-mode | longest name height / cell height | clipped |
|----------|-----------|--------------|-----------------------------------|---------|
| 320×568 | 6px | vertical-rl | fits (50px cell) | none |
| 360×800 | 8.4px | vertical-rl | fits | none |
| 375×667 | 7.0px | vertical-rl | fits | none |
| 390×844 | 8.9px | vertical-rl | 72/73 (Power Company) | none |
| 844×390 | horizontal | horizontal-tb | fits (1 line) | none |
| 1440×900 | 14px | horizontal-tb | fits (1 line) | none |

## Testing

- **e2e spec** `e2e/board-responsive.spec.ts` (replaces the earlier wrap-based spec): seeds a waiting game via `seedWaitingGame`, then asserts at 390×844 (portrait) that **all 40** `.cell-name`s are `vertical-rl` AND never overflow their cell (`scrollWidth <= cell.clientWidth + 1` and `scrollHeight <= cell.clientHeight + 1`), and that font-size is fluid (< 12px at this viewport). A second test asserts at 844×390 (landscape) that all 40 are `horizontal-tb` and never clipped. This directly encodes "names are never clipped and orientation is handled"; it failed on the pre-fix code (30/40 names overflowed horizontally at 12px).
- The initial clamp (`1.15vh`) was tuned down to `1.05vh` after the real e2e Chromium measured "Power Company"/"Water Company" at 78px in a 73px cell (the earlier prototype browser rendered 72px) — the +1px tolerance in the assertion exposed it.
- Existing `e2e/board-naming.spec.ts` keeps passing (text content unchanged; `toContainText` unaffected by class changes).
- `BoardGrid.test.tsx` unit tests assert tooltip behavior, not classes — unaffected.
- Verify with `npm run build`, `npm run lint`, `npm run test:unit`, `npm run test:e2e`.

## Out of scope

- Changing board layout to a centered square (the current "fill the viewport" layout already suits phone portrait).
- Shortening/abbreviating city names or editing translation strings (tooltip and log keep full names).
- Rotating only side columns (all edges are equally narrow-tall in portrait, so rotating every cell is uniform).
- Non-board screens (sidebar, lobby, tooltips).

## Risks / mitigations

- `writing-mode: vertical-rl` on every cell name in portrait is a deliberate visual choice (names read top-to-bottom). Browsers all support it; the e2e locks the behavior.
- Font metric differences between browsers can shift a long name by a few px — the fluid clamp's `1.05vh` term leaves ~1-2px headroom for the two longest names (13 glyphs) at the tested viewports; the e2e runs in real Chromium.
- Extremely narrow cells (320px-wide phones) still fit: 6px floor + vertical mode; verified at 320×568.
- No changes to data contracts, i18n keys, or wire messages — client/server unaffected.
