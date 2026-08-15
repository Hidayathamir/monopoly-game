# Monopoly — Sidebar Layout & Settings Auto-Collapse

**Date**: 2026-08-16
**Stack**: React 19 + TypeScript + Vite 8; Tailwind v4; i18next; Vitest + Playwright

## Goal

Fix three UX issues in the in-game sidebar and the global settings bar:

1. **Settings auto-collapse** — the language/currency panel only closes when the 🌐 toggle is clicked again. It should close automatically after a selection, on outside click, and on `Escape`.
2. **Action buttons above player list** — in the sidebar, the action buttons (Roll Dice, End Turn, Trade, Buy, etc.) currently sit below the player list. All action buttons should move above the player list.
3. **Bad leave-control UX** — the sidebar footer hides "Leave Room" behind a cryptic collapsed ⚙ gear toggle (`div:nth-child(6) > button`). Replace it with a compact, always-visible leave icon button at the top of the sidebar that opens the confirmation modal directly.

## Decisions

| # | Change | Decision |
|---|--------|----------|
| 1 | Settings auto-collapse | Close on language/currency selection, on outside click, and on `Escape` |
| 2 | Sidebar order | Header row (turn header + leave icon) → DiceRoller → ActionSection → PlayerPanel → EventLog |
| 3 | Leave control | Replace collapsed ⚙ footer toggle with a compact icon button at the top-right of the turn-header row; click opens confirmation modal directly |

## Change details

### 1 — LanguageCurrencyBar auto-collapse (`src/components/LanguageCurrencyBar.tsx`)

- Wrap the fixed container in a `ref`.
- In each `<select>` `onChange`, call `setOpen(false)` after applying the change (language + currency).
- Add a `useEffect` that registers a document `pointerdown` listener: if the event target is outside the container ref, `setOpen(false)`.
- Add a document `keydown` listener for `Escape` that closes the panel.
- `aria-expanded` and toggle behavior stay unchanged.

**Test updates** (`src/components/__tests__/LanguageCurrencyBar.test.tsx`):
- Selecting a language or currency closes the panel.
- Clicking outside closes the panel.
- Pressing `Escape` closes the panel.

### 2 — Sidebar order (`src/components/Sidebar.tsx`)

Current order: TurnHeader → DiceRoller → PlayerPanel → ActionSection → EventLog → RoomExit (footer).

New order:
1. Header row — `relative` wrapper containing `<TurnHeader state={state} />` with `<RoomExit onLeave={onLeave} variant="icon" />` absolutely positioned top-right.
2. `<DiceRoller ... />`
3. `<ActionSection ... />` (only when `isMyTurn`, else the existing "waiting for" paragraph stays in this slot)
4. `<PlayerPanel ... />`
5. `<EventLog log={state.eventLog} />`

RoomExit is removed from the footer. No other logic changes.

### 3 — RoomExit compact icon (`src/components/RoomExit.tsx`, `src/components/Lobby.tsx`)

**Refactor** `RoomExit` props:
- Remove `collapsed?: boolean` and the `open` expand state.
- Add `variant?: 'icon' | 'button'` (default `'button'`).

Behavior:
- `variant="icon"` — compact icon-only button (🚪, consistent with the codebase's emoji-icon pattern such as 🌐/⚙), `aria-label={t('lobby.leaveRoom')}`, `title` with the same label. Click opens the confirmation modal directly.
- `variant="button"` — unchanged labeled danger button `lobby.leaveRoom`, click opens the confirmation modal directly.
- The confirmation `Modal` (title `confirm.leaveTitle`, body `confirm.leaveMessage`, buttons `confirm.cancel` / `confirm.leave`) is unchanged; `onLeave` only fires after confirming.

**Callers:**
- `Sidebar.tsx` → `<RoomExit onLeave={onLeave} variant="icon" />` in the header row.
- `Lobby.tsx` → `<RoomExit onLeave={leave} />` (default `button` variant; unchanged).

**i18n** (`src/i18n/locales/{en,id}/translation.json`):
- Remove `confirm.leaveExpand` (en: "Leave Room Options" / id: "Opsi Keluar Ruangan") — no longer used.
- `lobby.leaveRoom`, `confirm.*` keys are reused for the icon `aria-label`/`title` and the modal.

**Test updates:**
- `src/components/__tests__/RoomExit.test.tsx` — drop the collapse-toggle tests; add a test that `variant="icon"` renders a compact button labeled "Leave Room" and clicking it opens the confirmation modal.
- `e2e/multiplayer.spec.ts` — the leave flow (currently `click('button[aria-label="Leave Room Options"]')` then `click('button:has-text("Leave Room")')`) becomes: click the icon button (aria-label "Leave Room") → confirm modal → confirm.

## Files summary

| File | Change |
|------|--------|
| `src/components/LanguageCurrencyBar.tsx` | Auto-close on selection, outside click, Escape |
| `src/components/Sidebar.tsx` | Reorder (header row w/ RoomExit icon, DiceRoller, ActionSection, PlayerPanel, EventLog) |
| `src/components/RoomExit.tsx` | `variant` prop; remove collapse toggle |
| `src/components/Lobby.tsx` | Unchanged call site (defaults to `button`) |
| `src/i18n/locales/{en,id}/translation.json` | Remove `confirm.leaveExpand` |
| `src/components/__tests__/LanguageCurrencyBar.test.tsx` | Auto-close tests |
| `src/components/__tests__/RoomExit.test.tsx` | Icon-variant tests; drop collapse tests |
| `e2e/multiplayer.spec.ts` | Updated leave flow |

## Testing

- Unit: `LanguageCurrencyBar.test.tsx` (auto-close on selection / outside click / Escape); `RoomExit.test.tsx` (icon variant renders + opens modal, button variant confirmation flow).
- E2E: `multiplayer.spec.ts` leave flow — click leave icon → confirm → menu.
- Manual: verify ID + EN locales render the leave icon `aria-label`/`title`, and that the settings panel closes in all three ways.

## Out of scope

- Any change to sidebar content other than ordering and the leave control.
- Changing the confirmation modal copy or behavior.
- The language/currency select contents.
