# Monopoly — UX/POV Fixes & Defaults

**Date**: 2026-08-15
**Stack**: React 19 + TypeScript + Vite 8; authoritative Node.js `ws` server (shared reducer/cards logic)

## Goal

Fix eight play-tested UI/UX issues and set the product defaults to Indonesian: the language/currency widget placement, turn-specific controls visible to non-current players, negative-money coloring, the doubles roll-again window that blocks house building, income tax basis, the game title, and setup-screen toggle clarity. Defaults become **ID** (language) and **IDR** (currency).

## Decisions

| # | Change | Decision |
|---|--------|----------|
| 1 | Language/currency widget | Keep top-right, always collapsed to a small icon-only 🌐 button; panel opens on click |
| 2 | Roll button POV | Hide the roll button entirely for non-current players (currently only disabled) |
| 3 | Modal/tooltip POV | Gate all turn-specific action buttons by `isMyTurn`; non-current players see non-interactive "Waiting for \<name\>…" |
| 4 | Negative money | Show red when `money < 0`, green otherwise, in `PlayerCard` + `PlayerPopup` |
| 5 | Doubles build window | Remove the 500ms auto `END_TURN` after doubles (client + server); player advances explicitly; label becomes "Roll Again" when a doubles roll is pending |
| 6 | Income tax | 10% of **current money** (`Math.floor(player.money * INCOME_TAX_RATE)`), not net worth |
| 7 | Title | `setup.title` → "Monopoly" / "Monopoli" in both locales |
| 8 | Setup toggles | Clear selected indicator (gold ring + full opacity on active, dimmed inactive) |
| 9 | Defaults | `DEFAULT_LANGUAGE = 'id'`, `DEFAULT_CURRENCY = 'IDR'` |

## Change details

### 1 — Language/currency widget collapsed

**Root cause:** `LanguageCurrencyBar.tsx:12` is `fixed top-2 right-2 z-[200]` and its toggle button always renders the full `🌐 EN · USD` label, overlapping the board on small screens.

**Fix:** make the toggle a compact icon-only 🌐 button (drop the language·currency text, tighten padding) at the same top-right position, collapsed by default (`open = false` unchanged). Panel content and behavior unchanged.

### 2 — Roll button hidden for non-current players

**Root cause:** `DiceRoller.tsx:33-37` renders the roll button whenever `canRoll || canRollJail`, only `disabled` when `!isMyTurn` — so in multiplayer every player sees it during another player's turn.

**Fix:** render the roll button only when `isMyTurn`. Dice always render. Non-current players get the "Waiting for \<name\>…" line (see #3).

### 3 — Turn-specific UI gated by `isMyTurn`

**Root cause:** `CardModal`, `BankruptcyModal`, `GameOverModal`, `PropertyTooltip` render clickable action buttons for every client because `GameState` is shared. The server rejects actions from non-current players (`gameServer.ts:182`), but the UI still presents the buttons.

**Fix (client-side only; server is already authoritative):**
- Thread `myPlayerId` (already on `GameApi`) into `GameView`'s modal renders; compute `isMyTurn` once in `GameView` and pass it down.
- `CardModal` / `BankruptcyModal`: when `!isMyTurn`, render the modal body without action buttons, replacing them with a "Waiting for \<current player name\>…" note.
- `PropertyTooltip`: only render the owner-action block (sell house / mortgage / sell to bank / redeem) when `isMyTurn`.
- `DiceRoller`/`ActionSection`: `ActionSection` already returns null when `!isMyTurn`; keep. Sidebar shows a "Waiting for \<name\>…" line for non-current players in place of the control sections.

Notes: `TradeModal` is opened by the current player themselves (local state) and needs no gating. `GameOverModal` is a terminal screen whose reset is a client-local page reload (`useNetworkGame.resetGame`) — it is **not** turn-gated and stays as-is.

### 4 — Negative money in red

**Root cause:** `PlayerCard.tsx:76` hardcodes `text-green-money`.

**Fix:** `player.money < 0 ? 'text-red-danger' : 'text-green-money'` on the money div. Apply the same to the money line in `PlayerPopup` (`PlayerCard.tsx:122`) for consistency.

### 5 — Doubles no longer auto-advances

**Root cause:** `useGame.ts:84-91` and `gameServer.ts:263-282` (`scheduleAutoSteps`) fire `END_TURN` 500ms after a doubles roll lands. `END_TURN` with doubles keeps the same player but clears `dice`, so the roll button reappears before the player can build on their own property (`ActionSection` requires `dice !== null` to build).

**Fix:**
- Remove the auto `END_TURN` effect from `useGame.ts` and the corresponding branch in `gameServer.scheduleAutoSteps`. Doubles now leaves the player on their turn until they explicitly advance.
- `ActionSection`: after a roll (`hasRolled`) with `doublesCount > 0`, label the advance button "Roll Again" instead of "End Turn". (The reducer already keeps the same player on doubles.)
- `DiceRoller`: when `doublesCount > 0` and the player can roll, label the roll button "Roll Again". Both use a shared new i18n key `action.rollAgain`.
- Keep the existing jail auto-advance effect (`useGame.ts:93-103`) untouched.

Flow after fix — roll doubles → land on own property → build button + "Roll Again" button stay up → build as desired → click "Roll Again" → roll. Land on unowned property → buy/decline prompt → then "Roll Again".

### 6 — Income tax on current money

**Root cause:** `gameReducer.ts:263-265` computes income tax as `floor(netWorth * 0.1)` where `netWorth = getPlayerNetWorth(...)` (money + property prices + house investment).

**Fix:**
- `taxAmount = Math.floor(player.money * INCOME_TAX_RATE)`.
- Update the `event.incomeTax` log entry params (`netWorth` → `money`); update `src/i18n/log.ts` `MONEY_PARAM_KEYS` accordingly.
- Update `tooltip.incomeTax` copy to state 10% of current money.

### 7 — Title

**Root cause:** `setup.title` = "Indonesia Monopoly" / "Monopoli Indonesia" (`src/i18n/locales/*/translation.json:113`).

**Fix:** set to "Monopoly" / "Monopoli".

### 8 — Setup toggle clarity

**Root cause:** `GameSetup.tsx` active toggle = `primary` (blue), inactive = `secondary` (orange); no strong selected indicator.

**Fix:** active toggle gets `ring-2 ring-gold/80` (plus existing primary bg); inactive gets `opacity-60`. Applies to both the Single-Device/Multiplayer pair and the Create/Join pair. Done by passing an extra className on the active `Button`.

### 9 — Defaults to ID / IDR

**Fix:**
- `src/i18n/index.ts`: `DEFAULT_LANGUAGE = 'id'`.
- `src/data/currency.ts`: `DEFAULT_CURRENCY: Currency = 'IDR'`.
- Stored user preferences (localStorage) still override the defaults; this only changes first-run/default behavior.

## Files summary

| File | Change |
|------|--------|
| `src/i18n/index.ts` | `DEFAULT_LANGUAGE = 'id'` |
| `src/data/currency.ts` | `DEFAULT_CURRENCY = 'IDR'` |
| `src/components/LanguageCurrencyBar.tsx` | Icon-only collapsed toggle |
| `src/components/DiceRoller.tsx` | Hide roll button when `!isMyTurn`; "Roll Again" label on doubles |
| `src/components/Sidebar.tsx` | "Waiting for \<name\>…" for non-current players |
| `src/components/GameView.tsx` | Compute/thread `isMyTurn` into modals |
| `src/components/Modals/CardModal.tsx` | Gate action by `isMyTurn` |
| `src/components/Modals/BankruptcyModal.tsx` | Gate actions by `isMyTurn` |
| `src/components/PropertyTooltip.tsx` | Owner-action block only when `isMyTurn` |
| `src/components/PlayerCard.tsx` | Negative-money red (card + popup) |
| `src/components/ActionSection.tsx` | "Roll Again" label; build window preserved |
| `src/hooks/useGame.ts` | Remove doubles auto `END_TURN` effect |
| `server/gameServer.ts` | Remove doubles auto `END_TURN` in `scheduleAutoSteps` |
| `src/logic/gameReducer.ts` | Income tax on current money; log params |
| `src/i18n/log.ts` | `netWorth` → `money` money-param key |
| `src/i18n/locales/{en,id}/translation.json` | `setup.title`; `tooltip.incomeTax`; `action.rollAgain` (new) |
| `src/components/GameSetup.tsx` | Active-toggle ring + inactive dim |

## Testing

- Unit: `currency.test.ts` (default IDR); `gameReducer.test.ts` (income tax on money; doubles flow unchanged in reducer); `useGame.test.ts` (remove/replace the doubles auto-advance test with a "does not auto-advance" assertion); `ActionSection` (Roll Again label); `PlayerCard` (negative money color).
- E2E: `i18n.spec.ts` (defaults to Indonesian/IDR); `monopoly.spec.ts` h1 title; keep existing smoke tests green; verify non-current players in `multiplayer.spec.ts` see no roll/action buttons.

## Out of scope

- Any change to rent, bankruptcy, or trade logic.
- Server-side turn enforcement changes (already authoritative).
- Responsive layout beyond the widget collapse.
