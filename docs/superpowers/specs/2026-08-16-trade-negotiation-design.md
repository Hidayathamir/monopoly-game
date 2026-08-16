# Real Trade Negotiation Design

Date: 2026-08-16

## Problem

Trades are cosmetic. `PROPOSE_TRADE` only appends an `event.tradeProposed` log
entry and returns to `Waiting`; `ACCEPT_TRADE`/`REJECT_TRADE` merely clear a null
pending action. The offer itself is never stored, so nothing is ever exchanged —
no cash, no property — and the recipient has no way to answer. The trade popup
button (added in the popup-trade-button feature) opens a modal whose "request"
side is cash-only (`requestProperties` is a hardcoded empty state).

## Goals

- Real negotiation: an offer sits in a shared **inbox** (`pendingTrades`) until
  the recipient accepts or rejects it, or the proposer cancels it.
- The game keeps running in parallel — proposing a trade never blocks a turn.
- Bots respond instantly with a value-based accept/reject.
- Trades can swap **cash and properties in both directions**.
- Works identically in single-player and multiplayer (shared `gameReducer`).

## Non-Goals

- No auto-expiry: offers persist until accepted, rejected, or cancelled.
- No trading while the recipient is bankrupt (existing rule).
- No trades with mortgaged or house-owning properties (matches the existing
  TradeModal filter).
- No bot-initiated trades — bots only respond to offers.
- No changes to the dice/jail/buy game rules.

## Design

### 1. Game state (`src/types/game.ts`)

`GameState` gains:

```ts
pendingTrades: PendingTrade[]   // open offers; nobody's turn is blocked
nextTradeId: number             // id counter for offers
export type PendingTrade = TradeOffer & { id: number }
```

`TradeOffer` stays the "form" shape the modal builds. A `PendingTrade` is the
stored form with an `id` so Accept/Reject/Cancel can target a specific offer.
Bump `STATE_VERSION` 7 → 8 in `src/hooks/useGame.ts` (incompatible shape change).

### 2. Reducer rules (`src/logic/gameReducer.ts`)

- **PROPOSE_TRADE** — validate (target exists, target !== self, target not
  bankrupt, every `offerProperties` space owner === `fromId`). Then:
  - Target `isBot` → resolve instantly via `shouldAcceptTrade(state, offer)`:
    accept if value received ≥ value given, else reject. Log the outcome
    (`event.tradeAccepted` or `event.tradeRejected`). Never enters the inbox.
  - Human target → append `{ ...offer, id: state.nextTradeId }`,
    `nextTradeId += 1`, log `event.tradeProposed`.
- **ACCEPT_TRADE** via action `{ type: 'ACCEPT_TRADE', tradeId }` — acting role:
  recipient (`toId`). Find the pending trade; if missing, no-op. Validate assets
  still hold: every offered/requested property still owned by its current owner,
  not mortgaged, `houses === 0`; recipient can afford `requestCash`. On success:
  transfer offered properties and cash from `fromId` → `toId`, and requested
  properties and `requestCash` from `toId` → `fromId` (update `board[].owner`,
  both players' `properties[]` arrays, and `money`), remove the trade, log
  `event.tradeAccepted`. On stale/invalid: remove and log `event.tradeRejected`.
- **REJECT_TRADE** via `{ type: 'REJECT_TRADE', tradeId }` — acting role:
  recipient. Removes the trade, logs `event.tradeRejected`.
- **CANCEL_TRADE** via `{ type: 'CANCEL_TRADE', tradeId }` — acting role:
  proposer. Removes the trade, logs `event.tradeCancelled`.

A trade never advances the turn. The current player continues playing after
proposing; accept/reject/cancel run out of turn without touching
`currentPlayer`.

### 3. Bot decision (`src/logic/bot.ts`)

New pure function `shouldAcceptTrade(state: GameState, offer: TradeOffer): boolean`:

- received value = `offer.requestCash` + Σ(`requestProperties` space prices)
- given value = `offer.offerCash` + Σ(`offerProperties` space prices)
- returns `received >= given` (bot never takes a losing deal).

No import cycle: `bot.ts` does not import `gameReducer`, so the reducer importing
`shouldAcceptTrade` is acyclic.

### 4. Server gate (`server/gameServer.ts`)

`handleAction` currently rejects any action from a non-current player
(`!isTurn`). Trade responses come from the **recipient**, who is not the current
player. Add a special case before the `isTurn` guard:

- `ACCEPT_TRADE` / `REJECT_TRADE`: allowed only when the sender's slot index
  equals the pending trade's `toId`.
- `CANCEL_TRADE`: allowed only when the sender's slot index equals `fromId`.
- Otherwise the existing error path. The reducer re-validates roles, so this is
  defense-in-depth.

### 5. UI

- **Badge + offers window**: a small "Trades" button always shown in the sidebar
  (not turn-gated). Badge count = pending trades involving the local player; in
  local mode (`myPlayerId === null`) count = all pending trades. Clicking opens
  `TradeInboxModal` (new component) listing pending trades, each with
  Accept / Reject (recipient) and Cancel (proposer). Local mode shows every trade
  with all actions enabled (hotseat shared screen).
- **TradeModal** request side: add checkboxes over the recipient's unmortgaged,
  house-free properties (mirroring the existing offer-side filter) so the
  proposer can request property, not just cash.
- **GameApi** gains `acceptTrade(id)`, `rejectTrade(id)`, `cancelTrade(id)`,
  wired through `useGame`, `useNetworkGame`, and `GameView`.

### 6. i18n + logging

New keys in both `en` and `id` locales: `event.tradeAccepted`,
`event.tradeRejected` (if missing), `event.tradeCancelled`, plus inbox strings
under `trade.*` (e.g. `trade.inboxTitle`, `trade.accept`, `trade.reject`,
`trade.cancel`). All user-facing text routes through `src/i18n/log.ts` and the
component `useTranslation` calls.

### 7. Testing

- `src/logic/__tests__/gameReducer.test.ts`: propose adds to inbox (human
  target); bot target resolved instantly (accept on win / reject on loss);
  accept transfers cash and property in both directions; reject/cancel remove the
  correct offer; stale/invalid accept dropped and re-logged as rejected.
- `src/logic/__tests__/bot.test.ts`: `shouldAcceptTrade` value math (accept equal,
  reject loss, accept profit).
- `TradeInboxModal` component test; `TradeModal` test for requesting properties.
- `server/__tests__/gameServer.test.ts`: non-current-player accept/reject/cancel
  allowed for the right party, rejected for everyone else.

## Files

- Modify: `src/types/game.ts`
- Modify: `src/logic/gameReducer.ts`
- Modify: `src/logic/bot.ts`
- Modify: `server/gameServer.ts`
- Modify: `src/hooks/useGame.ts`
- Modify: `src/hooks/useNetworkGame.ts`
- Modify: `src/components/GameView.tsx`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/Modals/TradeModal.tsx`
- Create: `src/components/Modals/TradeInboxModal.tsx`
- Modify: `src/i18n/log.ts`, `src/i18n/locales/en/translation.json`,
  `src/i18n/locales/id/translation.json`
- Tests: `gameReducer.test.ts`, `bot.test.ts`, new `TradeInboxModal.test.tsx`,
  `TradeModal.test.tsx`, `server/__tests__/gameServer.test.ts`