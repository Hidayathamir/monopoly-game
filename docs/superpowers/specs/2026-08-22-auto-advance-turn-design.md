# Auto-Advance Turn (Remove "End Turn" Button) — Design

Date: 2026-08-22

## Problem

When it's a human player's turn and they have rolled, the only thing left to do
is press "Roll Again" (after doubles) or "End Turn". This is pure ceremony: it
pauses the game and asks for a click the player has no reason to make.

There is precedent in the codebase: the "Draw" button for Chance/Community
chest cards is auto-clicked server-side after a short delay
(`server/gameServer.ts` `scheduleAutoSteps`, the `PendingActionType.DrawCard`
branch), instead of requiring the human to click it.

Goal: extend that same idea to the end-of-turn button. When "Roll Again" /
"End Turn" is the *only* action available, auto-advance the turn after a short
delay and **do not render the button at all**. The turn should only ever be
advanced when the player has no other choice to make.

## Design

### 1. Shared `canBuild` helper (`src/logic/build.ts`, new)

The `ActionSection` currently inlines a `canBuild` check at
`src/components/ActionSection.tsx:97-103`:

```ts
const canBuild =
  state.dice !== null &&
  space?.type === SpaceType.Property &&
  space.owner === state.currentPlayer &&
  space.houses < MAX_HOUSES &&
  !space.mortgaged &&
  space.id !== state.justBoughtSpaceId
```

Extract this into a pure, unit-testable helper:

```ts
// src/logic/build.ts
export function canBuildOnCurrentSpace(state: GameState): boolean
```

The helper reuses the exact same conditions as the current inline check —
notably it does **not** require a monopoly (matching current behavior, where a
monopoly is not required to build). `ActionSection` calls it; the server calls
it too (see below).

### 2. Server auto-advance (`server/gameServer.ts`)

In `scheduleAutoSteps()`, next to the existing `Resolving` and `DrawCard`
branches, add a third branch:

When all of the following hold for the current player:

- `state.phase === GamePhase.Waiting`
- `state.pendingAction == null`
- `state.dice !== null` (already rolled)
- `!player.inJail`
- `player.money >= 0`
- `!canBuildOnCurrentSpace(state)`

then after **300ms** (same constant/pattern as the `DrawCard` branch), and only
if the same conditions still hold **and** the current player is still a
connected human not under bot control (`!slot.isBot && slot.connected &&
player.botControlled !== true`), dispatch `{ type: GameActionType.EndTurn }`.

Notes:

- The human check must be re-verified inside the `setTimeout` callback, exactly
  like the existing branches re-check state, so a player who went AFK (and got
  taken over by a bot via `SetBotControl`) is never double-driven.
- The existing `EndTurn` reducer logic already branches on doubles ("Roll
  Again" vs "End Turn"), so no reducer change is needed.
- Bots and bot-controlled players are driven by `decideBotAction` /
  `driveBots` and must be excluded here.

### 3. Remove the "Roll Again" / "End Turn" button (`src/components/ActionSection.tsx`)

In `ActionSection`, the end-of-turn button at `ActionSection.tsx:136-148`
(currently rendered when `!player.inJail && hasRolled && player.money >= 0`)
is removed entirely.

Concretely, the `hasRolled` block (lines 136-148) goes away:

- The `<Button>` that rendered `action.rollAgain` / `action.endTurn` is
  deleted.
- The `onEndTurn` prop can be removed from `ActionSection`'s props and from
  `Sidebar`'s prop-passing (it was only forwarded to `ActionSection`), and the
  `endTurn` wiring in `GameView.tsx`/`Sidebar.tsx` can be cleaned up.
- The "negative balance" `<p>` (lines 149-153) — shown when
  `(hasRolled && !player.inJail) || player.money < 0` — is unrelated to the
  button and is kept as-is.

This component change is purely presentational; the authoritative auto-advance
is the server's, in step 2.

## i18n

No new keys required. The `action.rollAgain` and `action.endTurn` keys become
unused by the UI and can be left in the locale files (they are harmless and may
be reused), or removed if a lint pass flags them as dead keys. Prefer leaving
them in place to keep this change focused.

## Testing

- **Unit (`src/logic/__tests__/build.test.ts`, new):** `canBuildOnCurrentSpace`
  returns `true`/`false` for the same cases the old inline check covered —
  standing on own buildable property, on another player's property, on an
  unmortgaged vs mortgaged property, at `MAX_HOUSES`, on the just-bought space,
  and when `dice === null`.
- **Server (`server/__tests__/gameServer.test.ts`):**
  - After a human rolls and lands on a normal space, the turn auto-advances to
    the next player after the delay (no `END_TURN` action sent by the test).
  - After a human rolls doubles, the same player is auto-advanced to "Roll
    Again" state (the reducer's doubles branch), not skipped to the next
    player.
  - When `canBuildOnCurrentSpace` is true (human standing on a buildable
    property), the turn does **not** auto-advance; it waits for the player.
  - The existing test at `gameServer.test.ts:208` ("does not auto-advance after
    doubles until an explicit END_TURN") may need revisiting if it asserted the
    old behavior.
- **Component (`src/components/__tests__/ActionSection.test.tsx`):** update the
  test that asserted the "Roll Again" button label (`ActionSection.test.tsx:77`)
  to instead assert the button is absent. Remove now-unused `onEndTurn` props.
- Run `npm run typecheck`, `npm run lint`, `npm run test:unit`.

## Out of scope

- Mortgaging / selling / trading mid-turn as a way to pause your own turn.
  Auto-advance removes this pause window; this is an accepted tradeoff since
  the player can act on their next turn, and building (the main reason to
  pause) is already covered by `canBuildOnCurrentSpace`.
- Any change to the "Draw" auto-click or other `scheduleAutoSteps` branches.
