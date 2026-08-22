# Trade List — Create Offer From Inbox — Implementation Plan

Date: 2026-08-22
Branch: `feat/trade-list-create-offer`
Spec: `docs/superpowers/specs/2026-08-22-trade-list-create-offer-design.md`

## Steps

### 1. i18n keys
Files: `src/i18n/locales/en/translation.json`, `src/i18n/locales/id/translation.json`
- Add `"trade.newOffer": "New Trade Offer"` (en) / `"Tawaran Baru"` (id) in the
  trade block (near `trade.inbox`).

### 2. `TradeModal` — optional target
File: `src/components/Modals/TradeModal.tsx`
- Change `targetPlayerId: number` → `targetPlayerId: number | null` in `Props`.
- Add `const [selectedTarget, setSelectedTarget] = useState<number | null>(targetPlayerId)`.
- `const effectiveTargetId = targetPlayerId !== null ? targetPlayerId : selectedTarget`.
- `const hasTarget = effectiveTargetId !== null && effectiveTargetId !== undefined`.
- Compute `targetPlayerMoney` / `targetProps` from `effectiveTargetId` only when
  `hasTarget` (else `0` / `[]`).
- "With:" slot: if `targetPlayerId !== null` show the name `<p>`; else render a
  `<select>` over `counterparties` (other, non-bankrupt players) with a disabled
  placeholder `<option value="">{t('trade.selectPlayer')}</option>`.
- Wrap the "You request:" section (and its Propose influence) so it only renders
  when `hasTarget`.
- `handlePropose` → `toId: effectiveTargetId`.
- Propose `disabled={isEmptyTrade || !hasTarget}`.

### 3. `TradeInboxModal` — new-offer CTA
File: `src/components/Modals/TradeInboxModal.tsx`
- Add props `onNewTrade: () => void` and `canCreateTrade: boolean`.
- In `Modal.Actions`, render a primary `Button` `{t('trade.newOffer')}` calling
  `onNewTrade`, `disabled={!canCreateTrade}`, before the Close button.

### 4. `GameView` — wire inbox → TradeModal
File: `src/components/GameView.tsx`
- Add `const [showTradeModal, setShowTradeModal] = useState(false)`.
- `onProposeTrade={(id) => { setTradeTargetId(id); setShowTradeModal(true) }}`.
- Inbox: pass `canCreateTrade={canTrade}` and
  `onNewTrade={() => { setShowTrades(false); setTradeTargetId(null); setShowTradeModal(true) }}`.
- Render `<TradeModal>` when `showTradeModal` (not `tradeTargetId !== null`),
  passing `targetPlayerId={tradeTargetId}` and
  `onClose={() => setShowTradeModal(false)}`.
- `onPropose` callback: `game.proposeTrade(offer); setShowTradeModal(false)`.

### 5. Tests
- `src/components/__tests__/TradeModal.test.tsx`: add a case for
  `targetPlayerId={null}` — select present, Propose disabled until target chosen
  and an item selected; request section hidden before target chosen. Keep the
  existing `targetPlayerId={0}` test green.
- `src/components/__tests__/TradeInboxModal.test.tsx`: add a case asserting a
  "New Trade Offer" button calls `onNewTrade`, and that it is disabled when
  `canCreateTrade` is false.

## Verification
- `npm run typecheck`
- `npm run lint`
- `npm run test:unit`
