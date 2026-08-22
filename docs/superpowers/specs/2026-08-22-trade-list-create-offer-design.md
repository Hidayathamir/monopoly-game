# Trade List — Create Offer From Inbox — Design

Date: 2026-08-22

## Problem

Today a player can only *start* a trade by clicking another player's profile
popup and choosing "Trade". The trade inbox (the "Trades" list,
`TradeInboxModal`) is read-only: it only shows pending offers with
accept/reject/cancel. There is no way to initiate a new offer from the trade
list itself.

Goal: let a player create a new trade offer directly from the trade list, not
only via the other player's profile popup.

## Assumptions (no user input — working-while-away)

- "Trade list" = the Trades inbox modal (`TradeInboxModal`), opened from the
  sidebar "Trades" button.
- The new-offer entry point lives inside the inbox modal (a "New Trade Offer"
  CTA), and is also fine to keep the existing profile-popup path working.
- The `trade.selectPlayer` i18n key ("Select player") already exists and is the
  natural placeholder for a target picker.
- Creating a new offer from the inbox has no pre-selected counterpart, so
  `TradeModal` must support an *unlocked* target (a `<select>` of other
  players) in addition to its current pre-locked target.
- Same gating as everywhere else: the inbox "New Trade Offer" button is enabled
  only when `canTrade` is true (trades enabled, `Waiting` phase, no pending
  action). This matches the existing off-turn-trading gate.
- Trading with bankrupt players is not allowed; they are excluded from the
  target picker (consistent with `PlayerPanel` excluding bankrupt players).

## Design

### 1. `TradeModal` supports an optional target (`TradeModal.tsx`)

Change the `targetPlayerId` prop from `number` to `number | null`.

- When `targetPlayerId` is a number, behavior is unchanged (target locked,
  shown as the "With:" name).
- When `targetPlayerId === null`, render a `<select>` in the "With:" slot
  listing every other, non-bankrupt player, with `trade.selectPlayer` as the
  disabled placeholder option (`value=""`).

Derived state:
```ts
const [selectedTarget, setSelectedTarget] = useState<number | null>(targetPlayerId)
const effectiveTargetId = targetPlayerId !== null ? targetPlayerId : selectedTarget
const hasTarget = effectiveTargetId !== null && effectiveTargetId !== undefined
```
- `targetPlayerMoney` and `targetProps` are computed only when `hasTarget`;
  otherwise `0` / `[]`.
- The "You request:" section (cash input + target property checkboxes) is only
  rendered when `hasTarget` (nothing to request from nobody).
- `handlePropose` uses `toId = effectiveTargetId`.
- The Propose button is disabled when `isEmptyTrade || !hasTarget`.

Other players list:
```ts
const counterparties = state.players.filter(
  (p) => p.id !== proposerId && !p.bankrupt
)
```

### 2. Inbox gets a "New Trade Offer" CTA (`TradeInboxModal.tsx`)

Add props:
- `onNewTrade: () => void`
- `canCreateTrade: boolean`

Render a primary "New Trade Offer" button (new i18n key `trade.newOffer`) in the
`Modal.Actions` row, before the existing "Close" button. Disabled when
`!canCreateTrade`. Functionally it calls `onNewTrade`.

### 3. Wire it in `GameView.tsx`

- Introduce a separate `showTradeModal` boolean so the `TradeModal` can be opened
  with no pre-selected target (`tradeTargetId === null`). Keep `tradeTargetId`
  as `number | null`.
- `onProposeTrade` (from player popup) → `setTradeTargetId(id)` +
  `setShowTradeModal(true)`.
- Inbox `onNewTrade` → `setShowTrades(false)` +
  `setTradeTargetId(null)` + `setShowTradeModal(true)`.
- Render `<TradeModal>` when `showTradeModal` (instead of when
  `tradeTargetId !== null`), passing `targetPlayerId={tradeTargetId}`.
- Pass `canTrade` as `canCreateTrade` to the inbox.

### i18n keys (both `en` and `id`)

Add:
- `trade.newOffer` — "New Trade Offer" / "Tawaran Baru"

Reuse existing:
- `trade.selectPlayer` — "Select player" / "Pilih pemain" (target picker placeholder)
- `trade.with`, `trade.youOffer`, `trade.youRequest`, `trade.money`,
  `trade.max`, `trade.propose`, `trade.cancel`, `trade.close` (unchanged).

## Testing

- `TradeModal.test.tsx`:
  - With `targetPlayerId={null}`, the target `<select>` is present and the
    Propose button is disabled; selecting a player enables the request section
    and (with an item chosen) the Propose button.
  - With `targetPlayerId={0}`, behavior is unchanged (no select, target name
    shown) — keep existing test passing.
- `TradeInboxModal.test.tsx`:
  - A "New Trade Offer" button is rendered and, when clicked, calls `onNewTrade`.
  - When `canCreateTrade` is false the button is disabled.
- Run `npm run typecheck`, `npm run lint`, `npm run test:unit`.
- Optional e2e: a spec opening the Trades list and creating an offer via the new
  CTA (requires `npm run build` + trades-enabled server). Note in plan; keep
  scope minimal if build overhead is undesirable.
