# Enum-like String Constants Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every raw enum-like string literal in production code with the codebase's `const`-object + derived-union "enum" pattern, and codify the convention in AGENTS.md.

**Architecture:** Add three missing const objects to `src/types/net.ts` (`ClientMessageType`, `ServerMessageType`, `ConnectionStatus`) and derive their union types from them. Then mechanically replace raw string literals in the six production files with references to the existing (`GameActionType`, `PendingActionType`) and new consts. Values stay byte-identical — pure refactor, no behavior change.

**Tech Stack:** TypeScript (`erasableSyntaxOnly`, `verbatimModuleSyntax`), React, Node/`ws` server, Vitest.

## Global Constraints

- **No TypeScript `enum`** — repo enforces `erasableSyntaxOnly: true`. Use `const` object + derived union type only (pattern in `src/types/game.ts`).
- **No value changes** — every string value (wire protocol + persisted `GameState`) stays byte-identical. This is a naming refactor only.
- **Do not modify** test files (`__tests__`, `e2e/`) or `docs/superpowers/*` — raw literals there still typecheck because the literal is assignable to the derived union.
- **Semicolons**: `src/logic/bot.ts` uses semicolons (match it); `server/*`, `src/types/net.ts`, `src/hooks/useNetworkGame.ts`, `src/components/Lobby.tsx` do not.
- **`verbatimModuleSyntax`**: value imports (consts) and type imports must be correct — do not put a value in an `import type`, and do not let an unused type import linger.
- **Verification commands** used throughout: `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run build`.

---

### Task 1: Add consts + derived types to `src/types/net.ts`

**Files:**
- Modify: `src/types/net.ts`

**Interfaces:**
- Consumes: nothing new (uses existing `GameState`/`GameAction` types already imported).
- Produces: `ClientMessageType`, `ServerMessageType`, `ConnectionStatus` const objects (PascalCase keys, lowercase string values) and same-named derived union types; `ClientMessage`/`ServerMessage` unions now reference the consts.

- [ ] **Step 1: Replace the `ConnectionStatus` type and add the two message-type consts**

At line 5, replace:

```ts
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'
```

with:

```ts
export const ConnectionStatus = {
  Connecting: 'connecting',
  Connected: 'connected',
  Disconnected: 'disconnected',
} as const
export type ConnectionStatus = (typeof ConnectionStatus)[keyof typeof ConnectionStatus]
```

Insert the two message-type consts before the `ClientMessage` type (after the imports, line 5 area):

```ts
export const ClientMessageType = {
  Create: 'create',
  Join: 'join',
  Start: 'start',
  Leave: 'leave',
  AddBot: 'addBot',
  RemoveBot: 'removeBot',
  Action: 'action',
} as const
export type ClientMessageType = (typeof ClientMessageType)[keyof typeof ClientMessageType]

export const ServerMessageType = {
  Welcome: 'welcome',
  Lobby: 'lobby',
  State: 'state',
  Left: 'left',
  Error: 'error',
} as const
export type ServerMessageType = (typeof ServerMessageType)[keyof typeof ServerMessageType]
```

- [ ] **Step 2: Rewrite the `ClientMessage` union discriminants**

Replace lines 7-14 with:

```ts
export type ClientMessage =
  | { type: typeof ClientMessageType.Create; name: string }
  | { type: typeof ClientMessageType.Join; code: string; name: string }
  | { type: typeof ClientMessageType.Start }
  | { type: typeof ClientMessageType.Leave }
  | { type: typeof ClientMessageType.AddBot }
  | { type: typeof ClientMessageType.RemoveBot; playerId: number }
  | { type: typeof ClientMessageType.Action; action: GameAction }
```

- [ ] **Step 3: Rewrite the `ServerMessage` union discriminants**

Replace lines 16-21 with:

```ts
export type ServerMessage =
  | { type: typeof ServerMessageType.Welcome; playerId: number; hostPlayerId: number; players: LobbyPlayer[]; state: GameState; code: string }
  | { type: typeof ServerMessageType.Lobby; players: LobbyPlayer[]; hostPlayerId: number }
  | { type: typeof ServerMessageType.State; state: GameState }
  | { type: typeof ServerMessageType.Left }
  | { type: typeof ServerMessageType.Error; message: string }
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS (existing raw-literal usages like `{ type: 'create', name }` still assign to the new derived unions).

- [ ] **Step 5: Run net-related unit tests**

Run: `npx vitest run src/net/__tests__/client.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/types/net.ts
git commit -m "refactor: add ClientMessageType/ServerMessageType/ConnectionStatus consts"
```

---

### Task 2: Convert `server/gameServer.ts`

**Files:**
- Modify: `server/gameServer.ts`

**Interfaces:**
- Consumes: `GameActionType`, `PendingActionType` (from `src/types/game`), `ServerMessageType` (from `src/types/net`).
- Produces: no new exports; internal dispatch/compare/send sites now reference the consts.

- [ ] **Step 1: Update imports**

Line 2, replace:

```ts
import { GamePhase, type GameState, type GameAction } from '../src/types/game'
```

with:

```ts
import { GameActionType, GamePhase, PendingActionType, type GameState, type GameAction } from '../src/types/game'
```

Line 3, replace:

```ts
import type { LobbyPlayer, ServerMessage } from '../src/types/net'
```

with:

```ts
import { ServerMessageType } from '../src/types/net'
import type { LobbyPlayer, ServerMessage } from '../src/types/net'
```

- [ ] **Step 2: Replace `ServerMessageType` literals (all `send`/`broadcast` sites)**

Replace `type: 'error'` → `type: ServerMessageType.Error` at every site: lines 63, 84, 89, 100, 119, 123, 128, 139, 143, 154, 161, 203, 207, 242, 252, 256.
Replace `type: 'welcome',` → `type: ServerMessageType.Welcome,` at lines 72 and 106.
Replace `{ type: 'left' }` → `{ type: ServerMessageType.Left }` at lines 176 and 196.

- [ ] **Step 3: Replace `GameActionType` literals in dispatch/compare sites**

- Line 166: `type: 'START_GAME',` → `type: GameActionType.StartGame,`
- Line 214: `{ type: 'ROLL_DICE' }` → `{ type: GameActionType.RollDice }`
- Line 221: `{ type: 'DICE_ANIMATED', dice: [d1, d2] }` → `{ type: GameActionType.DiceAnimated, dice: [d1, d2] }`
- Line 224: `{ type: 'RESOLVE_SPACE' }` → `{ type: GameActionType.ResolveSpace }`
- Line 232: `action.type === 'ROLL_DICE'` → `action.type === GameActionType.RollDice`
- Line 237: `action.type === 'PROPOSE_TRADE'` → `action.type === GameActionType.ProposeTrade`
- Line 245: `action.type === 'ACCEPT_TRADE' || action.type === 'REJECT_TRADE' || action.type === 'CANCEL_TRADE'` → `action.type === GameActionType.AcceptTrade || action.type === GameActionType.RejectTrade || action.type === GameActionType.CancelTrade`
- Line 247: `action.type === 'CANCEL_TRADE'` → `action.type === GameActionType.CancelTrade`
- Line 321: `{ type: 'END_TURN' }` → `{ type: GameActionType.EndTurn }`
- Line 333: `{ type: 'RESOLVE_SPACE' }` → `{ type: GameActionType.ResolveSpace }`
- Line 339: `{ type: 'DRAW_CARD' }` → `{ type: GameActionType.DrawCard }`
- Line 364: `actionNow.type === 'ROLL_DICE'` → `actionNow.type === GameActionType.RollDice`

- [ ] **Step 4: Replace `PendingActionType` + `GameActionType` literals in `skipLeftPlayers()` (lines 314-318)**

```ts
        if (pending.type === PendingActionType.BuyProperty) this.applyAction({ type: GameActionType.DeclineBuy })
        else if (pending.type === PendingActionType.PayRent) this.applyAction({ type: GameActionType.PayRent })
        else if (pending.type === PendingActionType.Bankruptcy) this.applyAction({ type: GameActionType.DeclareBankruptcy })
        else if (pending.type === PendingActionType.DrawCard) this.applyAction({ type: GameActionType.DrawCard })
        else if (pending.type === PendingActionType.CardEffect) this.applyAction({ type: GameActionType.ResolveCard })
```

- [ ] **Step 5: Replace `PendingActionType` literals in `scheduleAutoSteps()` (lines 336-338)**

```ts
    } else if (s.pendingAction?.type === PendingActionType.DrawCard) {
      setTimeout(() => {
        if (this.state.pendingAction?.type === PendingActionType.DrawCard) {
```

- [ ] **Step 6: Typecheck + run server unit tests**

Run: `npm run typecheck && npx vitest run server/__tests__/gameServer.test.ts`
Expected: PASS both.

- [ ] **Step 7: Commit**

```bash
git add server/gameServer.ts
git commit -m "refactor: use enum-like consts in gameServer"
```

---

### Task 3: Convert `server/http.ts` and `server/roomManager.ts`

**Files:**
- Modify: `server/http.ts`
- Modify: `server/roomManager.ts`

**Interfaces:**
- Consumes: `ClientMessageType` (http.ts), `ServerMessageType` (roomManager.ts).
- Produces: no new exports.

- [ ] **Step 1: `server/http.ts` import**

Line 6, replace:

```ts
import type { ClientMessage, ServerMessage } from '../src/types/net'
```

with:

```ts
import { ClientMessageType } from '../src/types/net'
import type { ClientMessage, ServerMessage } from '../src/types/net'
```

- [ ] **Step 2: `server/http.ts` `msg.type` chain (lines 69-89)**

Replace each discriminant:
- `msg.type === 'create'` → `msg.type === ClientMessageType.Create`
- `msg.type === 'join'` → `msg.type === ClientMessageType.Join`
- `msg.type === 'start'` → `msg.type === ClientMessageType.Start`
- `msg.type === 'leave'` → `msg.type === ClientMessageType.Leave`
- `msg.type === 'addBot'` → `msg.type === ClientMessageType.AddBot`
- `msg.type === 'removeBot'` → `msg.type === ClientMessageType.RemoveBot`
- `msg.type === 'action'` → `msg.type === ClientMessageType.Action`

- [ ] **Step 3: `server/roomManager.ts` import**

Line 2, replace:

```ts
import type { ServerMessage } from '../src/types/net'
```

with:

```ts
import { ServerMessageType } from '../src/types/net'
import type { ServerMessage } from '../src/types/net'
```

- [ ] **Step 4: `server/roomManager.ts` broadcast sites**

Line 28: `broadcastState: (state) => this.broadcastToRoom(code, { type: ServerMessageType.State, state }),`
Line 30: `broadcastLobby: (players, hostPlayerId) => this.broadcastToRoom(code, { type: ServerMessageType.Lobby, players, hostPlayerId }),`

- [ ] **Step 5: Typecheck + run server unit tests**

Run: `npm run typecheck && npx vitest run server/__tests__/http.test.ts`
Expected: PASS both.

- [ ] **Step 6: Commit**

```bash
git add server/http.ts server/roomManager.ts
git commit -m "refactor: use enum-like message consts in http server and room manager"
```

---

### Task 4: Convert `src/logic/bot.ts`

**Files:**
- Modify: `src/logic/bot.ts`

**Interfaces:**
- Consumes: `GameActionType` (from `src/types/game`).
- Produces: no new exports.

- [ ] **Step 1: Add `GameActionType` to the import**

Lines 1-3, replace:

```ts
import {
  GamePhase, PendingActionType, SpaceType, type GameAction, type GameState, type Space, type TradeOffer,
} from '../types/game';
```

with:

```ts
import {
  GameActionType, GamePhase, PendingActionType, SpaceType, type GameAction, type GameState, type Space, type TradeOffer,
} from '../types/game';
```

- [ ] **Step 2: Replace action literals (keep this file's semicolons)**

- Line 17: `? { type: 'BUY_PROPERTY' }` → `? { type: GameActionType.BuyProperty }`
- Line 18: `: { type: 'DECLINE_BUY' };` → `: { type: GameActionType.DeclineBuy };`
- Line 21: `return { type: 'PAY_RENT' };` → `return { type: GameActionType.PayRent };`
- Line 25: `return { type: 'DRAW_CARD' };` → `return { type: GameActionType.DrawCard };`
- Line 27: `return { type: 'RESOLVE_CARD' };` → `return { type: GameActionType.ResolveCard };`
- Line 29: `return { type: 'DECLARE_BANKRUPTCY' };` → `return { type: GameActionType.DeclareBankruptcy };`
- Line 37: `return { type: 'USE_GET_OUT_OF_JAIL_FREE' };` → `return { type: GameActionType.UseGetOutOfJailFree };`
- Line 38: `return { type: 'PAY_JAIL_FINE' };` → `return { type: GameActionType.PayJailFine };`
- Line 39: `return { type: 'ROLL_DICE' };` → `return { type: GameActionType.RollDice };`
- Line 42: `return buildAction(state) ?? { type: 'ROLL_DICE' };` → `return buildAction(state) ?? { type: GameActionType.RollDice };`
- Line 44: `return { type: 'END_TURN' };` → `return { type: GameActionType.EndTurn };`
- Line 66: `return best ? { type: 'BUILD_HOUSE', spaceId: best.id } : null;` → `return best ? { type: GameActionType.BuildHouse, spaceId: best.id } : null;`
- Line 73: `return { type: 'SELL_HOUSE', spaceId: id };` → `return { type: GameActionType.SellHouse, spaceId: id };`
- Line 77: `return { type: 'MORTGAGE', spaceId: id };` → `return { type: GameActionType.Mortgage, spaceId: id };`
- Line 79: `return { type: 'DECLARE_BANKRUPTCY' };` → `return { type: GameActionType.DeclareBankruptcy };`

- [ ] **Step 3: Typecheck + run bot unit tests**

Run: `npm run typecheck && npx vitest run src/logic/__tests__/bot.test.ts`
Expected: PASS both.

- [ ] **Step 4: Commit**

```bash
git add src/logic/bot.ts
git commit -m "refactor: use enum-like action consts in bot logic"
```

---

### Task 5: Convert `src/hooks/useNetworkGame.ts`

**Files:**
- Modify: `src/hooks/useNetworkGame.ts`

**Interfaces:**
- Consumes: `GameActionType` (from `src/types/game`); `ClientMessageType`, `ServerMessageType`, `ConnectionStatus` (from `src/types/net`).
- Produces: no new exports.

- [ ] **Step 1: Update imports**

Lines 4-5, replace:

```ts
import type { GameApi, GameAction, GameState, TradeOffer } from '../types/game'
import type { ConnectionStatus, LobbyPlayer } from '../types/net'
```

with:

```ts
import { GameActionType } from '../types/game'
import type { GameApi, GameAction, GameState, TradeOffer } from '../types/game'
import { ClientMessageType, ConnectionStatus, ServerMessageType } from '../types/net'
import type { LobbyPlayer } from '../types/net'
```

- [ ] **Step 2: Replace `ConnectionStatus` literals**

- Line 28: `useState<ConnectionStatus>('connecting')` → `useState<ConnectionStatus>(ConnectionStatus.Connecting)`
- Line 39: `setStatus('connected')` → `setStatus(ConnectionStatus.Connected)`
- Line 40: `setStatus('disconnected')` → `setStatus(ConnectionStatus.Disconnected)`
- Line 48: `setStatus('connected')` → `setStatus(ConnectionStatus.Connected)`

- [ ] **Step 3: Replace `ServerMessageType` literals in the `onMessage` handler (lines 42-59)**

- `message.type === 'welcome'` → `message.type === ServerMessageType.Welcome`
- `message.type === 'lobby'` → `message.type === ServerMessageType.Lobby`
- `message.type === 'state'` → `message.type === ServerMessageType.State`
- `message.type === 'left'` → `message.type === ServerMessageType.Left`
- `message.type === 'error'` → `message.type === ServerMessageType.Error`

- [ ] **Step 4: Replace `ClientMessageType` literals in the `send` callbacks (lines 72, 76-81)**

- Line 72: `send({ type: 'action', action })` → `send({ type: ClientMessageType.Action, action })`
- Line 76: `send({ type: 'create', name })` → `send({ type: ClientMessageType.Create, name })`
- Line 77: `send({ type: 'join', code, name })` → `send({ type: ClientMessageType.Join, code, name })`
- Line 78: `send({ type: 'leave' })` → `send({ type: ClientMessageType.Leave })`
- Line 79: `send({ type: 'start' })` → `send({ type: ClientMessageType.Start })`
- Line 80: `send({ type: 'addBot' })` → `send({ type: ClientMessageType.AddBot })`
- Line 81: `send({ type: 'removeBot', playerId })` → `send({ type: ClientMessageType.RemoveBot, playerId })`

- [ ] **Step 5: Replace `GameActionType` literals in `sendAction` calls (lines 83-102)**

- `{ type: 'ROLL_DICE' }` → `{ type: GameActionType.RollDice }`
- `{ type: 'BUY_PROPERTY' }` → `{ type: GameActionType.BuyProperty }`
- `{ type: 'DECLINE_BUY' }` → `{ type: GameActionType.DeclineBuy }`
- `{ type: 'PAY_RENT' }` → `{ type: GameActionType.PayRent }`
- `{ type: 'BUILD_HOUSE', spaceId }` → `{ type: GameActionType.BuildHouse, spaceId }`
- `{ type: 'SELL_HOUSE', spaceId }` → `{ type: GameActionType.SellHouse, spaceId }`
- `{ type: 'MORTGAGE', spaceId }` → `{ type: GameActionType.Mortgage, spaceId }`
- `{ type: 'UNMORTGAGE', spaceId }` → `{ type: GameActionType.Unmortgage, spaceId }`
- `{ type: 'SELL_PROPERTY', spaceId }` → `{ type: GameActionType.SellProperty, spaceId }`
- `{ type: 'PROPOSE_TRADE', offer }` → `{ type: GameActionType.ProposeTrade, offer }`
- `{ type: 'ACCEPT_TRADE', tradeId }` → `{ type: GameActionType.AcceptTrade, tradeId }`
- `{ type: 'REJECT_TRADE', tradeId }` → `{ type: GameActionType.RejectTrade, tradeId }`
- `{ type: 'CANCEL_TRADE', tradeId }` → `{ type: GameActionType.CancelTrade, tradeId }`
- `{ type: 'DRAW_CARD' }` → `{ type: GameActionType.DrawCard }`
- `{ type: 'RESOLVE_CARD' }` → `{ type: GameActionType.ResolveCard }`
- `{ type: 'END_TURN' }` → `{ type: GameActionType.EndTurn }`
- `{ type: 'DECLARE_BANKRUPTCY' }` → `{ type: GameActionType.DeclareBankruptcy }`
- `{ type: 'SKIP_ACTION' }` → `{ type: GameActionType.SkipAction }`
- `{ type: 'PAY_JAIL_FINE' }` → `{ type: GameActionType.PayJailFine }`
- `{ type: 'USE_GET_OUT_OF_JAIL_FREE' }` → `{ type: GameActionType.UseGetOutOfJailFree }`

- [ ] **Step 6: Typecheck + run client/component unit tests**

Run: `npm run typecheck && npx vitest run src/net/__tests__/client.test.ts src/components/__tests__/Lobby.test.tsx`
Expected: PASS all.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useNetworkGame.ts
git commit -m "refactor: use enum-like consts in useNetworkGame hook"
```

---

### Task 6: Convert `src/components/Lobby.tsx`

**Files:**
- Modify: `src/components/Lobby.tsx`

**Interfaces:**
- Consumes: `ConnectionStatus` (from `src/types/net`).
- Produces: no new exports.

- [ ] **Step 1: Update import**

Line 1, replace:

```ts
import type { LobbyPlayer } from '../types/net'
```

with:

```ts
import { ConnectionStatus } from '../types/net'
import type { LobbyPlayer } from '../types/net'
```

- [ ] **Step 2: Replace status literals**

- Line 29: `status === 'connecting'` → `status === ConnectionStatus.Connecting`
- Line 30: `status === 'disconnected'` → `status === ConnectionStatus.Disconnected`

- [ ] **Step 3: Typecheck + run Lobby unit tests**

Run: `npm run typecheck && npx vitest run src/components/__tests__/Lobby.test.tsx`
Expected: PASS both.

- [ ] **Step 4: Commit**

```bash
git add src/components/Lobby.tsx
git commit -m "refactor: use ConnectionStatus const in Lobby"
```

---

### Task 7: Codify convention in AGENTS.md + full verification

**Files:**
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: the const pattern from `src/types/game.ts` and `src/types/net.ts` (now the reference examples).
- Produces: a lasting repo convention for future contributors.

- [ ] **Step 1: Add the convention bullet**

In `AGENTS.md`, in the **Conventions** section, directly after the existing
"No TS enums" bullet, add:

```markdown
- **Enum-like string constants**: Any fixed set of string values (wire message
  types, phases, action types, statuses, etc.) must be declared as a `const`
  object with a derived union type (see `src/types/game.ts` and
  `src/types/net.ts`). Do not use raw string literals in production code where
  a constant exists; do not introduce TypeScript `enum` (repo enforces
  `erasableSyntaxOnly`). Wire values are part of the client/server contract and
  must never change when refactoring.
```

- [ ] **Step 2: Verify no raw literals remain in the converted files**

Run: `grep -rnE "type: '(create|join|start|leave|addBot|removeBot|action|welcome|lobby|state|left|error)'|'(ROLL_DICE|DICE_ANIMATED|RESOLVE_SPACE|DECLINE_BUY|PAY_RENT|DECLARE_BANKRUPTCY|DRAW_CARD|RESOLVE_CARD|END_TURN|SKIP_ACTION|BUY_PROPERTY|MOVE_TOKEN|PASS_GO|BUILD_HOUSE|SELL_HOUSE|MORTGAGE|UNMORTGAGE|SELL_PROPERTY|PROPOSE_TRADE|ACCEPT_TRADE|REJECT_TRADE|CANCEL_TRADE|START_GAME|COLLECT_FREE_PARKING|PAY_JAIL_FINE|USE_GET_OUT_OF_JAIL_FREE)'" server/gameServer.ts server/http.ts server/roomManager.ts src/hooks/useNetworkGame.ts src/logic/bot.ts src/components/Lobby.tsx`
Expected: no matches in `server/` and `src/` paths (docs/plans and tests may still match — that's expected).

- [ ] **Step 3: Full verification suite**

Run: `npm run typecheck && npm run lint && npm run test:unit && npm run build`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md
git commit -m "docs: codify enum-like string constant convention in AGENTS.md"
```

---

## Self-Review

- **Spec coverage**: Task 1 = net.ts consts/unions (spec §1); Tasks 2-6 = per-file literal replacements (spec §2); Task 7 = AGENTS.md convention (spec §3) + verification. No spec section is left without a task.
- **Placeholder scan**: every replacement site is enumerated with its target constant; no "TBD"/"similar to" references.
- **Type consistency**: const names (`ClientMessageType.Create`, `GameActionType.RollDice`, `PendingActionType.DrawCard`, `ServerMessageType.Error`, `ConnectionStatus.Connecting`) are used identically across all tasks and match the consts defined in Task 1 and `src/types/game.ts`. Import names match exports.
