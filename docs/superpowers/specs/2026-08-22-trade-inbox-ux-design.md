# Trade Inbox UX & Off-Turn Trading — Design

Date: 2026-08-22

## Problem

Three issues reported with the multiplayer trade feature:

1. **Ambiguous inbox text.** `TradeInboxModal` renders every trade from the
   *proposer's* frame using the labels `trade.youOffer` / `trade.youRequest`.
   From the recipient's point of view the word "You" is wrong: what the proposer
   "offers" is what the recipient *receives*, and what the proposer "requests"
   is what the recipient must *give*. Example: Alpha offers Rio + $0 and requests
   $1.2K. Bravo (the recipient) sees "You offer: Rio" / "You request: $1.2K",
   which reads as if Bravo is the one offering Rio.

2. **Two "Cancel" buttons.** The inbox modal has a per-offer `Cancel` button
   (cancels that trade offer) and a footer `Cancel` button (closes the modal).
   Two identically-labelled buttons is confusing — the footer one should read
   "Close".

3. **Trading should be allowed off-turn.** The user intended players to be able
   to propose/accept/reject trades even when it is not their turn. The server
   (`server/gameServer.ts` `handleAction`) already permits this: `ProposeTrade`
   only requires `offer.fromId === slotIndex`, and `Accept/Reject/CancelTrade`
   only require the acting slot to be the `toId`/`fromId`. The reducer
   (`gameReducer` `ProposeTrade`/`AcceptTrade`/etc.) also has no turn check. The
   only gate is client-side: `GameView` computes
   `canTrade = tradesEnabled && isMyTurn && phase === Waiting && !pendingAction`.
   Removing `isMyTurn` unlocks off-turn trading everywhere.

## Assumptions (no user input — working-while-away)

- The server already supports off-turn trades; we only lift the client gate.
- The footer button rename to "Close" is acceptable and we update the e2e
  selectors that currently press the footer "Cancel" to close the inbox.
- We keep `trade.youOffer` / `trade.youRequest` because the proposer-side
  `TradeModal` uses them correctly from the proposer's own perspective.
- For a spectator (`myPlayerId === null`) we show neutral, name-anchored labels
  instead of "You".

## Design

### 1. Perspective-aware inbox text (`TradeInboxModal.tsx`)

For each pending trade, derive the viewer's perspective from `myPlayerId`:

- viewer is the **recipient** (`myPlayerId === tr.toId`):
  - "You receive:" = `offerProperties` + `offerCash` (what the proposer gives you)
  - "You give:" = `requestProperties` + `requestCash` (what you give the proposer)
- viewer is the **proposer** (`myPlayerId === tr.fromId`):
  - "You give:" = `offerProperties` + `offerCash`
  - "You receive:" = `requestProperties` + `requestCash`
- otherwise (spectator / uninvolved):
  - "{{name}} gives:" = `offerProperties` + `offerCash`
  - "{{name}} wants:" = `requestProperties` + `requestCash`

The existing header `<from> → <to>` is retained as it clearly shows direction.

### 2. Rename footer button (`TradeInboxModal.tsx`)

Footer `Modal.Actions` button label changes from `trade.cancel` to a new
`trade.close` key ("Close" / "Tutup"). The per-offer `Cancel` button keeps
`trade.cancel` (cancels the trade offer).

### 3. Off-turn trading (`GameView.tsx`)

Change:
```ts
const canTrade = tradesEnabled && isMyTurn && state.phase === GamePhase.Waiting && !state.pendingAction
```
to drop `isMyTurn`:
```ts
const canTrade = tradesEnabled && state.phase === GamePhase.Waiting && !state.pendingAction
```
`canTrade` already flows into `PlayerPanel` → `PlayerCard` → `PlayerPopup`, so
the Trade button becomes available to any player at any time (subject to
`tradesEnabled`, `Waiting` phase, and no pending action). Bankrupt players stay
disabled via the existing `!player.bankrupt` in `PlayerPanel`.

### i18n keys (both `en` and `id`)

Add:
- `trade.youGive` — "You give:" / "Anda berikan:"
- `trade.youReceive` — "You receive:" / "Anda terima:"
- `trade.gives` — "{{name}} gives:" / "{{name}} berikan:"
- `trade.wants` — "{{name}} wants:" / "{{name}} minta:"
- `trade.close` — "Close" / "Tutup"

Keep `trade.youOffer` / `trade.youRequest` (used by `TradeModal`).

## Testing

- Update `e2e/trade-positive.spec.ts`:
  - Recipient assertions `You offer:.*Rio` / `You offer:.*Salvador` →
    `You receive:.*Rio` / `You receive:.*Salvador`.
  - Footer close presses (`name: 'Cancel'` used to close the inbox) →
    `name: 'Close'`.
- Add a unit assertion in `TradeInboxModal.test.tsx` verifying the recipient
  sees "You receive:" and "You give:" (perspective), not "You offer:".
- Run `npm run typecheck`, `npm run lint`, `npm run test:unit`.
