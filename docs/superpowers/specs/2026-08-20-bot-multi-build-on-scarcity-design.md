# Monopoly — Bot Multi-Build When Land Is Scarce

**Date**: 2026-08-20
**Stack**: React 19 + TypeScript + Vite 8; authoritative Node.js `ws` server (shared `gameReducer` is the single source of truth)

## Goal

When few buyable spaces remain unowned ("land is scarce"), a bot that lands on one of its own buildable properties should keep building houses on it — up to `MAX_HOUSES` or a cash-reserve floor — instead of the current one-build-per-landing cap. In normal (non-scarce) land conditions the bot keeps today's behavior exactly.

This is a pure extension of the existing bot decision logic; it does **not** change the shared engine rules.

## Context

- The engine already permits repeated builds: the reducer's `BuildHouse` case (`src/logic/gameReducer.ts:414-445`) never reads `builtThisStop`; it only sets it to `true`. The "once per landing" behavior comes entirely from the bot's own `buildAction` guard (`if (state.builtThisStop) return null`, `src/logic/bot.ts:56`) and the human UI.
- The server's `driveBots` loop (`server/gameServer.ts:390`) re-calls `decideBotAction` after every dispatched action until it returns `null` or the bot ends its turn. Issuing multiple `BuildHouse` actions in one turn therefore works with **zero** server changes — each loop pass re-checks money/house cost, so cost escalation and the reserve floor are enforced naturally.
- The bot already builds without a full color set and without a cash buffer (plan `2026-08-20-bot-build-without-monopoly`); the standing/ownership/mortgage/`< MAX_HOUSES`/just-bought guards are all in place.

## Decisions

| # | Change | Decision |
|---|--------|----------|
| 1 | Scarcity trigger | "Land is scarce" when **fewer than 25% of buyable spaces are unowned** — buyable = `Property` (22) + `Railroad` (4) + `Utility` (2) = 28, so aggressive mode when unowned ≤ 6 (strict `< 7`). Pure function of `state.board`, no config. |
| 2 | One-per-landing guard | Bypass `state.builtThisStop` only when land is scarce. Normal mode is unchanged. |
| 3 | Cash reserve | In scarce mode, stop building before money would drop below 10% of `STARTING_MONEY` (`Math.floor(1500 * 0.10)` = $150). Not applied in normal mode, so existing normal-mode behavior (build once, no buffer) is preserved. |
| 4 | Engine/server | No changes. `gameReducer`, `GameState`, wire types, and `server/gameServer.ts` stay untouched. |

## Changes

**`src/logic/bot.ts`**

Add a pure helper:

```typescript
const BUYABLE_TYPES = [SpaceType.Property, SpaceType.Railroad, SpaceType.Utility];

function isLandScarce(state: GameState): boolean {
  const buyable = state.board.filter((s) => BUYABLE_TYPES.includes(s.type));
  const unowned = buyable.filter((s) => s.owner === null).length;
  return unowned * 4 < buyable.length; // fewer than 25% unowned
}
```

Derived constant for the reserve (reuses existing rules constants, no new config):

```typescript
const BUILD_CASH_RESERVE = Math.floor(STARTING_MONEY * 0.1);
```

Update `buildAction` (`src/logic/bot.ts:49`) guards:

```typescript
const scarce = isLandScarce(state);
if (state.builtThisStop && !scarce) return null;
const cost = getHouseCost(space, space.houses);
if (cost === 0 || player.money < cost) return null;
if (scarce && player.money - cost < BUILD_CASH_RESERVE) return null;
```

All other existing guards (own property, standing on it, not mortgaged, `houses < MAX_HOUSES`, not just-bought, `dice !== null` via `decideBotAction`) are unchanged.

**Imports**: `STARTING_MONEY` and `MAX_HOUSES` (already imported) from `../data/board`; `SpaceType` already imported from `../types/game`.

## Behavior summary

- **Normal land** (≥ 7 unowned): identical to today — at most one build per landing, no reserve floor.
- **Scarce land** (≤ 6 unowned): the bot builds repeatedly on the property it stands on, once per `driveBots` loop pass, stopping when it reaches `MAX_HOUSES`, cannot afford the next house, or the next build would breach the $150 reserve. The scarcity check is re-evaluated each build but stays constant within a turn (building does not change the unowned count).

## Testing

**`src/logic/__tests__/bot.test.ts`**

- **Scarcity boundary**: 7 unowned → normal (first build then `END_TURN` when `builtThisStop`); 6 unowned → scarce (second `BUILD_HOUSE` still returned despite `builtThisStop: true`).
- **Multi-build loop**: feed each reduced state back into `decideBotAction`; assert a well-funded bot in scarce mode issues `BUILD_HOUSE` until `MAX_HOUSES` reached, then stops (returns `null`/`END_TURN`).
- **Reserve floor**: scarce mode, bot with just-enough money — the last build that would leave `< $150` is not issued.
- **Normal mode regression**: existing `builtThisStop` → `END_TURN` behavior still holds; a scarce-mode state must be required for multi-build (no global behavior change).

## Out of scope

- No engine, reducer, `GameState`, wire-type, or server changes.
- No change to rent/monopoly doubling, mortgage, sell, trade, or the human build UI.
- No new env vars or config.

## Verification

- `npm run typecheck` — PASS (no unused imports; `erasableSyntaxOnly`/`verbatimModuleSyntax` honored; match `src/logic/*` semicolon style).
- `npm run lint` — PASS.
- `npm run test:unit` — PASS (new bot tests + all existing).
