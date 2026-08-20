# Design — Event log scroll stays put while reading history

**Date**: 2026-08-21
**Stack**: React 19 + TypeScript + Tailwind v4 (client); shared reducer snapshots

## Problem

While a game is in progress, `src/components/EventLog.tsx` force-scrolls the log to the
bottom on **every** `log` change:

```tsx
useEffect(() => {
  if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
}, [log, expanded])
```

The `log` prop is a fresh array reference on every game-state snapshot (both local reducer
dispatch and network `ServerMessage.State`), so each new event snaps the viewport back to the
bottom — making it impossible to read older entries while the game is active.

## Decisions

| # | Change | Decision |
|---|--------|----------|
| 1 | Auto-scroll policy | Track whether the user is at (or within `SCROLL_BOTTOM_EPSILON = 16px` of) the bottom via an `onScroll` handler. Only auto-scroll on `log` change when the user is already at the bottom. When scrolled up, new events append below without moving the viewport. |
| 2 | Expand/collapse | Keep the existing behavior: toggling `expanded` always scrolls to the bottom and re-arms stick-to-bottom (collapsed mode has no scrollbar). |
| 3 | Recovery affordance | When expanded and scrolled away from the bottom, show a small "Latest" chip button (absolute, bottom-right of the scroll container) that jumps to the bottom and re-arms stick-to-bottom. Hidden while at the bottom. |
| 4 | i18n | New key `eventlog.jumpToLatest` added to `en` and `id` translation.json (flat keys). No hardcoded UI strings. |

## Change details

### `src/components/EventLog.tsx`

- New constant `const SCROLL_BOTTOM_EPSILON = 16`.
- New ref `stickToBottomRef = useRef(true)` and state `const [atBottom, setAtBottom] = useState(true)`.
  State drives only the "Latest" button visibility; the ref avoids re-renders per scroll tick
  (React bails out on identical `setState` value anyway).
- `handleScroll()` reads `scrollHeight - scrollTop - clientHeight < SCROLL_BOTTOM_EPSILON`,
  stores it in `stickToBottomRef`, and calls `setAtBottom(...)`.
- `log` effect becomes: scroll to bottom **only if** `stickToBottomRef.current` is true.
- New `expanded` effect: always scroll to bottom and set `stickToBottomRef.current = true`,
  `setAtBottom(true)` (preserves current toggle behavior).
- `jumpToLatest()`: scrolls to bottom, re-arms stick/atBottom, plays `SoundId.Click` (matches the
  existing toggle button).
- Scroll container gets `relative` when expanded; the "Latest" chip renders as
  `absolute bottom-1 right-2` inside it when `expanded && !atBottom`.

### i18n (`src/i18n/locales/en/translation.json`, `src/i18n/locales/id/translation.json`)

- Add `"eventlog.jumpToLatest"` next to the existing `eventlog.*` keys.
  - en: `"Latest"` (plain word, no arrow, so the chip stays compact).
  - id: `"Terbaru"`.

## Testing

- **Unit** (`src/components/__tests__/EventLog.test.tsx`, jsdom): mock `scrollHeight` /
  `clientHeight` on the `event-log` container via `Object.defineProperty` (configurable).
  1. Renders at the bottom initially: `scrollTop === scrollHeight` after expand.
  2. At bottom + new `log` entries → stays scrolled to bottom.
  3. Scrolled up (`fireEvent.scroll`) + new `log` entries → `scrollTop` unchanged (does not yank).
  4. "Latest" button: visible when scrolled up, hidden at bottom; clicking it scrolls to bottom
     and hides the button.
  5. Existing 3 tests keep passing.
- **Verification**: `npm run typecheck`, `npm run lint`, `npm run test:unit`.
- No e2e (no existing `event-log` spec; component behavior covered by unit tests).

## Out of scope

- An "N new events" counter / unread badge.
- Changing collapse behavior or the log entry rendering.
- Server/reducer changes.
