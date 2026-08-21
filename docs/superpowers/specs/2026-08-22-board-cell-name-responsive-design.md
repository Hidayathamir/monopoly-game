# Responsive Board Cell Name Typography

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

City names are rendered with a fixed `text-xs` (12px) on a `<button class="cell-name">` that is a flex item inside a `flex flex-col items-center justify-center` cell. Two problems result:

1. **Clipping (the main bug)**: the name button is a flex item with `min-width: auto` (the default). Inside a `flex-col items-center` cell it refuses to shrink below its content width, so on phone portrait a name like "Manchester" (66px wide at 12px) overflows the 34px cell and is cut off by the cell's `overflow-hidden`. Verified live at 390×844: `scrollWidth 66 > clientWidth 32` for space 32.
2. **Fixed typography**: a single 12px size is too small on big desktop cells (~173px wide, lots of empty space) and too large on phones. There is no responsive behavior.

The i18n strings themselves are fine; this is purely a rendering/layout problem in `BoardGrid.tsx` (plus a regression test).

## Goal

City names render well on every screen size and orientation, with phone portrait as the priority. Concretely:

- No cell-name text is ever clipped (horizontal or vertical) at any viewport.
- Names wrap gracefully to a small number of lines (≤3) when the cell is narrow.
- Font size scales with the screen (fluid typography) instead of being a fixed 12px.
- Existing behavior on desktop is preserved or improved (names readable, not tiny).

## Chosen approach: CSS-only fluid typography + wrap fix

Pure CSS change in `BoardGrid.tsx`; no new dependencies, no JS measurement, no i18n changes, no board data changes. The board keeps its "fills the viewport" layout (that's already the phone-friendly, vertical-focused design).

### Change: the `.cell-name` button classes

In `BoardGrid.tsx` (the button at line ~184-191), replace the fixed `text-xs` with:

- `w-full` + `min-w-0` — the button takes the cell width and, as a flex item, is allowed to shrink, so text wraps inside the cell instead of overflowing.
- `break-words` (`overflow-wrap: break-word`) — breaks long single tokens ("Water Company" on the narrowest cells).
- `text-balance` (`text-wrap: balance`) — evenly distributes wrapped lines (modern browsers; harmless fallback otherwise).
- `text-[clamp(9px,min(2.6vw,2.4vh),14px)]` — fluid font size driven by the smaller viewport dimension, clamped to a 9–14px range. This keeps names legible on desktop (14px) while small enough on phones (≈10px at 390px width, 9px at 320px) to wrap in ≤3 lines.

Keep everything else: `m-0 p-0 border-0 bg-transparent appearance-none cursor-default select-none text-center font-semibold leading-tight text-text-dim`, plus the existing Chance/Community color overrides (they target `.cell-name` via `[&_.cell-name]`, which still works).

### Why viewport units, not container queries

The cell size is a deterministic fraction of the viewport (board = viewport − 16px, cells = board/11), so `min(2.6vw, 2.4vh)` tracks cell size across all screens and orientations without needing per-cell `container-type` (which can have surprising sizing interactions with grid items) or ResizeObserver JS. Measured live across four viewports:

| Viewport | font-size | max lines | clipping |
|----------|-----------|-----------|----------|
| 320×568 | 9px | 3 | none |
| 390×844 | 10.1px | 2 | none |
| 844×390 | 9.4px | 1 | none |
| 1440×900 | 14px | 1 | none |

## Testing

- **New e2e spec** `e2e/board-responsive.spec.ts` (following the pattern of `e2e/board-naming.spec.ts`): seed a waiting game via `seedWaitingGame`, then assert, at a phone viewport (390×844), that **every** board cell's `.cell-name` fits inside its cell — `name.scrollWidth <= name.clientWidth + 1` and `name.scrollHeight <= name.clientHeight + 1` (allow 1px rounding). Also assert a long-name cell (space 32 "Manchester") is fully visible. This directly encodes "names are never clipped" and fails on the pre-fix code.
- Existing `e2e/board-naming.spec.ts` keeps passing (text content unchanged; `toContainText` unaffected by class changes).
- `BoardGrid.test.tsx` unit tests assert tooltip behavior, not classes — unaffected.
- Verify with `npm run build`, `npm run lint`, `npm run test:unit`, `npm run test:e2e`.

## Out of scope

- Changing board layout to a centered square (the current "fill the viewport" layout already suits phone portrait).
- Rotating side-column text, hiding/reordering the house rows, or editing translation strings.
- Non-board screens (sidebar, lobby, tooltips).

## Risks / mitigations

- `text-wrap: balance` is newer CSS; on older browsers it simply wraps normally — no breakage. Font-size clamp and `min-w-0` are the actual guarantees.
- Extremely narrow cells (320px-wide phones, ID locale like "St. Ps. Senen") still fit: 9px floor + `break-words` keeps them ≤3 lines; verified at 320×568.
- No changes to data contracts, i18n keys, or wire messages — client/server unaffected.
