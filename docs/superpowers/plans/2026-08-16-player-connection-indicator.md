# Player Connection Indicator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a clear connected/disconnected indication for every player in the in-game sidebar player cards and the lobby list, using the connection state the server already broadcasts.

**Architecture:** The server already broadcasts `Lobby` messages (`LobbyPlayer[]`, each with `connected`) alongside every state snapshot, and `useNetworkGame` stores it in `lobby`. `MultiplayerGame` derives a `Set<number>` of connected player ids from `lobby` and threads it down `GameView → Sidebar → PlayerPanel → PlayerCard`. A player card dims (adds `opacity-50`) and shows an `OFFLINE` label when its id is not in the set; the lobby dims a disconnected row. Bots always read connected (server marks bot seats `connected: true`). No server, wire-contract, or `GameState` changes.

**Tech Stack:** React 19 + TypeScript + Vite + Tailwind v4, Vitest (jsdom), react-i18next.

## Global Constraints

- No changes to `src/types/net.ts`, `src/types/game.ts`, `server/*`, or `src/logic/*` — connection state is network metadata, threaded client-side only.
- No TS enums; `verbatimModuleSyntax` → type-only imports via `import type`.
- `noUnusedLocals`/`noUnusedParameters` are on — no unused imports in tests.
- Components/hooks omit semicolons; `src/types/*`, `src/data/*` use them. Match the file you edit.
- Every new component prop defaults to current behavior (omitted set ⇒ everyone connected; `connected` defaults `true`) so existing tests stay green.
- i18n: every UI string must exist in both `src/i18n/locales/en/translation.json` and `id/translation.json` (flat keys, `keySeparator: false`).
- Each task leaves `npm run typecheck` and `npm run test:unit` green.

---

## File Structure

- `src/components/PlayerCard.tsx` — new `connected?: boolean` prop; dims card + `OFFLINE` label.
- `src/components/PlayerPanel.tsx` — new `connectedPlayerIds?: Set<number>` prop; computes per-card `connected`.
- `src/components/Sidebar.tsx` — new `connectedPlayerIds?: Set<number>` prop; forwards to `PlayerPanel`.
- `src/components/GameView.tsx` — new `connectedPlayerIds?: Set<number>` prop; forwards to `Sidebar`.
- `src/components/MultiplayerGame.tsx` — derives the set from `game.lobby`; passes it to `GameView`.
- `src/components/Lobby.tsx` — dims a disconnected player row.
- `src/i18n/locales/en/translation.json` + `id/translation.json` — new key `card.disconnected`.
- Tests: `src/components/__tests__/PlayerCard.test.tsx`, `PlayerPanel.test.tsx`, `Sidebar.test.tsx`, `Lobby.test.tsx`.

---

### Task 1: PlayerCard connection prop, dim, and OFFLINE label

**Files:**
- Modify: `src/components/PlayerCard.tsx:30-42,74,87`
- Modify: `src/i18n/locales/en/translation.json` (near `card.bankrupt`)
- Modify: `src/i18n/locales/id/translation.json` (near `card.bankrupt`)
- Test: `src/components/__tests__/PlayerCard.test.tsx`

**Interfaces:**
- Consumes: nothing (Task 1 is the foundation).
- Produces:
  - `PlayerCard({ ..., connected?: boolean })` — default `true`.
  - i18n key `card.disconnected` → `"OFFLINE"` in both locales.

- [ ] **Step 1: Write the failing tests**

Edit `src/components/__tests__/PlayerCard.test.tsx` — add `within` to the testing-library import (line 2):

```tsx
import { screen, cleanup, fireEvent, within } from '@testing-library/react'
```

Append a new describe block at the end of the file:

```tsx
describe('PlayerCard connection indicator', () => {
  it('shows the OFFLINE label and dims the card when disconnected', () => {
    renderWithProviders(<PlayerCard player={player} isCurrent={false} color="#E74C3C" diff={null} board={board} connected={false} />)
    const card = screen.getByTestId('player-card')
    expect(within(card).getByText('OFFLINE')).toBeTruthy()
    expect(card.className).toContain('opacity-50')
  })

  it('does not show the OFFLINE label when connected (default)', () => {
    renderWithProviders(<PlayerCard player={player} isCurrent={false} color="#E74C3C" diff={null} board={board} />)
    expect(screen.queryByText('OFFLINE')).toBeNull()
    expect(screen.getByTestId('player-card').className).not.toContain('opacity-50')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/PlayerCard.test.tsx`
Expected: FAIL — `connected` is not a prop of `PlayerCard` (type error) and `OFFLINE` is not found.

- [ ] **Step 3: Add the i18n key**

In `src/i18n/locales/en/translation.json`, directly below the `card.bankrupt` line, add:

```json
  "card.disconnected": "OFFLINE",
```

In `src/i18n/locales/id/translation.json`, directly below the `card.bankrupt` line, add:

```json
  "card.disconnected": "OFFLINE",
```

- [ ] **Step 4: Implement the PlayerCard prop**

Edit `src/components/PlayerCard.tsx`:

1. `PlayerCardProps` (interface at lines 30-40) — add the prop after `board: Space[]`:

```tsx
  board: Space[]
  connected?: boolean
```

2. Component signature (line 42) — destructure with a default:

```tsx
export default function PlayerCard({ player, isCurrent, color, diff, board, connected = true, canTrade = true, currentPlayerId, onProposeTrade, tradesEnabled = true }: PlayerCardProps) {
```

3. Card className (line 74) — dim when disconnected or bankrupt:

```tsx
          player.bankrupt || !connected ? 'opacity-50' : '',
```

4. Name row (line 87, after the `{player.bankrupt && ...}` span) — add the label:

```tsx
          {!connected && <span className="text-xs font-bold text-muted">{t('card.disconnected')}</span>}
```

- [ ] **Step 5: Run tests + typecheck to verify they pass**

Run: `npm run typecheck && npx vitest run src/components/__tests__/PlayerCard.test.tsx`
Expected: PASS — both new tests pass; the five existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/PlayerCard.tsx src/components/__tests__/PlayerCard.test.tsx src/i18n/locales/en/translation.json src/i18n/locales/id/translation.json
git commit -m "feat: show OFFLINE label and dim PlayerCard when disconnected"
```

---

### Task 2: Thread connectedPlayerIds from lobby to PlayerPanel

**Files:**
- Modify: `src/components/PlayerPanel.tsx:6-14,38-55`
- Modify: `src/components/Sidebar.tsx:11-34,72`
- Modify: `src/components/GameView.tsx:7,18-42`
- Modify: `src/components/MultiplayerGame.tsx:19-27,41`
- Test: `src/components/__tests__/PlayerPanel.test.tsx`
- Test: `src/components/__tests__/Sidebar.test.tsx`

**Interfaces:**
- Consumes: `PlayerCard({ ..., connected?: boolean })` from Task 1.
- Produces:
  - `PlayerPanel({ ..., connectedPlayerIds?: Set<number> })` — default `undefined` ⇒ everyone connected.
  - `Sidebar({ ..., connectedPlayerIds?: Set<number> })`.
  - `GameView({ game, connectedPlayerIds?: Set<number>, onLeave?, exitKeys? })`.
  - `MultiplayerGame` passes `connectedPlayerIds={new Set(game.lobby.filter((p) => p.connected).map((p) => p.id))}` to `GameView`.

- [ ] **Step 1: Write the failing tests**

Append to `src/components/__tests__/PlayerPanel.test.tsx`:

```tsx
  it('marks a player as offline when excluded from connectedPlayerIds', () => {
    renderWithProviders(
      <PlayerPanel
        state={makeState(1000, 0)}
        playerColors={COLORS}
        onProposeTrade={() => {}}
        canTrade
        connectedPlayerIds={new Set([1])}
      />,
    )
    expect(screen.getByText('OFFLINE')).toBeTruthy()
  })

  it('treats everyone as connected when connectedPlayerIds is omitted', () => {
    renderWithProviders(
      <PlayerPanel state={makeState(1000, 0)} playerColors={COLORS} onProposeTrade={() => {}} canTrade />,
    )
    expect(screen.queryByText('OFFLINE')).toBeNull()
  })
```

Append to `src/components/__tests__/Sidebar.test.tsx`:

```tsx
  it('shows OFFLINE on a disconnected player card', () => {
    renderWithProviders(<Sidebar state={makeState()} isMyTurn onLeave={noop} {...makeProps()} connectedPlayerIds={new Set([1])} />)
    expect(screen.getByText('OFFLINE')).toBeTruthy()
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/__tests__/PlayerPanel.test.tsx src/components/__tests__/Sidebar.test.tsx`
Expected: FAIL — `connectedPlayerIds` is not a prop (type error) and `OFFLINE` is not rendered.

- [ ] **Step 3: Implement the threading**

1. `src/components/PlayerPanel.tsx` — Props (interface at lines 6-12) add:

```tsx
  canTrade: boolean
  connectedPlayerIds?: Set<number>
  tradesEnabled?: boolean
```

Signature (line 14) add to the destructure:

```tsx
export default function PlayerPanel({ state, playerColors, onProposeTrade, canTrade, connectedPlayerIds, tradesEnabled = true }: Props) {
```

In the `.map` (lines 38-55), before the `return` of each card add the computed value and pass it:

```tsx
        {(state.turnOrder.length > 0 ? state.turnOrder : players.map((p) => p.id)).map((id) => {
          const player = players[id]
          const isCurrent = player.id === currentPlayer
          const connected = connectedPlayerIds === undefined || connectedPlayerIds.has(player.id)
          return (
            <PlayerCard
              key={player.id}
              player={player}
              isCurrent={isCurrent}
              color={playerColors[player.id]}
              diff={diffs[player.id] ?? null}
              board={board}
              connected={connected}
              canTrade={canTrade && !player.bankrupt}
              tradesEnabled={tradesEnabled}
              currentPlayerId={currentPlayer}
              onProposeTrade={onProposeTrade}
            />
          )
        })}
```

2. `src/components/Sidebar.tsx` — Props (after `tradesEnabled?: boolean`) add:

```tsx
  connectedPlayerIds?: Set<number>
```

Signature (line 34) add to the destructure:

```tsx
export default function Sidebar({ state, isMyTurn, onLeave, exitKeys, onProposeTrade, canTrade = true, tradesEnabled = true, connectedPlayerIds, tradeCount, onOpenTrades, ...actions }: Props) {
```

PlayerPanel call (line 72) add:

```tsx
        <PlayerPanel state={state} playerColors={PLAYER_COLORS} onProposeTrade={onProposeTrade} canTrade={canTrade} connectedPlayerIds={connectedPlayerIds} tradesEnabled={tradesEnabled} />
```

3. `src/components/GameView.tsx` — signature (line 7) add the prop:

```tsx
export default function GameView({ game, connectedPlayerIds, onLeave, exitKeys }: { game: GameApi; connectedPlayerIds?: Set<number>; onLeave?: () => void; exitKeys?: { labelKey?: string; titleKey?: string; messageKey?: string; confirmKey?: string } }) {
```

Sidebar call (around line 18-42) add near `tradesEnabled={tradesEnabled}`:

```tsx
          connectedPlayerIds={connectedPlayerIds}
```

4. `src/components/MultiplayerGame.tsx` — inside the component body, after `const game = useNetworkGame(onLeft)` block, add:

```tsx
  const connectedPlayerIds = new Set(game.lobby.filter((p) => p.connected).map((p) => p.id))
```

and pass it to `GameView` (line 41):

```tsx
  return <GameView game={game} connectedPlayerIds={connectedPlayerIds} onLeave={game.leave} />
```

- [ ] **Step 4: Run tests + typecheck to verify they pass**

Run: `npm run typecheck && npm run test:unit`
Expected: PASS — new PlayerPanel/Sidebar tests pass; every existing component test still passes (default props keep current behavior).

- [ ] **Step 5: Commit**

```bash
git add src/components/PlayerPanel.tsx src/components/Sidebar.tsx src/components/GameView.tsx src/components/MultiplayerGame.tsx src/components/__tests__/PlayerPanel.test.tsx src/components/__tests__/Sidebar.test.tsx
git commit -m "feat: thread connected player ids from lobby to the sidebar player cards"
```

---

### Task 3: Dim disconnected rows in the lobby

**Files:**
- Modify: `src/components/Lobby.tsx:39`
- Test: `src/components/__tests__/Lobby.test.tsx`

**Interfaces:**
- Consumes: nothing new (uses the existing `LobbyPlayer.connected` field).
- Produces: a dimmed lobby row (`opacity-50`) for disconnected players.

- [ ] **Step 1: Write the failing test**

Append to `src/components/__tests__/Lobby.test.tsx`:

```tsx
  it('dims the row of a disconnected player', () => {
    renderWithProviders(<Lobby game={makeGame({
      lobby: [
        { id: 0, name: 'Host', connected: true, isBot: false },
        { id: 1, name: 'Gone', connected: false, isBot: false },
      ],
    })} />)
    const goneRow = screen.getByText(/Gone/).closest('div')!
    expect(goneRow.className).toContain('opacity-50')
    const hostRow = screen.getByText(/Host/).closest('div')!
    expect(hostRow.className).not.toContain('opacity-50')
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/Lobby.test.tsx`
Expected: FAIL — the disconnected row has no `opacity-50` class.

- [ ] **Step 3: Implement the dimming**

In `src/components/Lobby.tsx`, change the player row div (line 39) from:

```tsx
              <div key={i} className="flex items-center gap-2 text-base">
```

to:

```tsx
              <div key={i} className={`flex items-center gap-2 text-base ${p && !p.connected ? 'opacity-50' : ''}`}>
```

The existing `lobby.disconnectedSuffix` label (` (disconnected)`) stays, giving the lobby the same dim+label style as the sidebar cards.

- [ ] **Step 4: Run tests + typecheck to verify they pass**

Run: `npm run typecheck && npm run test:unit`
Expected: PASS — new lobby test passes; the three existing lobby tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/Lobby.tsx src/components/__tests__/Lobby.test.tsx
git commit -m "feat: dim disconnected player rows in the lobby"
```

---

## Self-Review

**Spec coverage:**
- `MultiplayerGame` derives the connected set from `game.lobby` → Task 2 ✓
- Props threaded `GameView → Sidebar → PlayerPanel` with `connectedPlayerIds?: Set<number>` defaulting to everyone-connected → Task 2 ✓
- `PlayerCard.connected` dims the card (`opacity-50`, stacks with bankrupt) and shows `card.disconnected` → Task 1 ✓
- Lobby rows dimmed for disconnected players, label kept → Task 3 ✓
- i18n key `card.disconnected` in en + id → Task 1 ✓
- Tests: PlayerCard (Task 1), PlayerPanel/Sidebar threading (Task 2), Lobby dim (Task 3) ✓
- No server/wire/GameState changes; bots always connected (server already broadcasts bot seats as `connected: true`) ✓

**Placeholder scan:** Every step has concrete code or an exact edit target; no TBDs. The `...` in Task 1 means "keep the rest of the existing body unchanged".

**Type consistency:** `connectedPlayerIds: Set<number>` appears identically in `MultiplayerGame` (producer) and `PlayerPanel`/`Sidebar`/`GameView` (consumers). `connected: boolean` on `PlayerCard` is produced by `PlayerPanel` (`connectedPlayerIds.has(player.id)`). The i18n key `card.disconnected` matches `t('card.disconnected')` in `PlayerCard`.
