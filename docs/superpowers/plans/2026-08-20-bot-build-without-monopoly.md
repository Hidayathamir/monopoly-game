# Bot Build Without Monopoly Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let bot players build a house on a property they own and are standing on without requiring a full color set, matching the existing house rule already used by the reducer and human UI.

**Architecture:** The house rule ("build without a full color set") is already the behavior in the authoritative reducer (`gameReducer.ts` `BuildHouse` case — no `isMonopoly` guard) and in the human UI (`ActionSection.tsx` — no monopoly gating). The only place still enforcing the old standard-Monopoly rule is the bot's `buildAction` in `src/logic/bot.ts`, which returns `null` unless `isMonopoly(...)` passes. This plan removes that single guard (and the now-unused import) and updates the bot test that asserted the old behavior.

**Tech Stack:** TypeScript, Vitest, existing Monopoly game logic.

## Global Constraints

- No TS enums — `erasableSyntaxOnly: true`; `verbatimModuleSyntax: true` (type-only imports must use `import type`); `noUnusedLocals`/`noUnusedParameters` are on — removing the `isMonopoly` call in `bot.ts` requires removing its import or typecheck fails.
- Semicolons: `src/logic/*` uses semicolons. Match the file.
- Wire values (action types, etc.) must never change — we are not touching them.
- Do not alter the monopoly rule for **rent doubling** (`gameReducer.ts:315`, `isMonopoly` in `src/logic/rent.ts`) — that rule is intentionally unchanged.
- Verification required before completion: `npm run typecheck`, `npm run lint`, `npm run test:unit` (all pass cleanly).

---

### Task 1: Remove the monopoly requirement from the bot's build action

**Files:**
- Modify: `src/logic/bot.ts:5` (remove unused `isMonopoly` import)
- Modify: `src/logic/bot.ts:58` (remove the monopoly guard)
- Modify: `src/logic/__tests__/bot.test.ts:196-206` (update the obsolete test)
- Verify only: `src/logic/gameReducer.ts:414-445` (BuildHouse case — confirmed to have NO monopoly guard; no change needed)

**Interfaces:**
- Consumes: `decideBotAction(state: GameState): GameAction | null` — signature unchanged.
- Produces: `buildAction(state: GameState): GameAction | null` now returns `{ type: GameActionType.BuildHouse, spaceId }` whenever the bot owns and stands on a buildable property it can afford, even without a full color set.

- [x] **Step 1: Update the failing test to assert the new house rule**

In `src/logic/__tests__/bot.test.ts`, replace the test at lines 196-206 (`does not build on an incomplete color set`) with a test asserting the bot DOES build on an incomplete color set, mirroring the existing `builds a house when standing on an owned, completed, affordable property` test but with only ONE property of the color group owned:

```typescript
  it('builds a house on a single owned property without a full color set', () => {
    const board = createInitialBoard();
    const group = colorGroup(board);
    if (group.length === 0) throw new Error('no color group');
    const target = group[0];
    board[target.id] = { ...target, owner: 0 };
    const state = makeState(
      { board, dice: [3, 4] },
      makePlayer({ properties: [target.id], money: 100000, position: target.id }),
    );
    expect(decideBotAction(state)).toEqual({ type: 'BUILD_HOUSE', spaceId: target.id });
  });
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/logic/__tests__/bot.test.ts`
Expected: FAIL — `decideBotAction` returns `{ type: 'END_TURN' }` because `buildAction` hits the `isMonopoly` guard and returns `null`, so the bot ends its turn.

- [x] **Step 3: Remove the monopoly guard in the bot**

In `src/logic/bot.ts`:

1. Remove the entire line `if (!isMonopoly(player.id, state.board, space)) return null;` (line 58) from `buildAction`. The function should then be:

```typescript
function buildAction(state: GameState): GameAction | null {
  const player = state.players[state.currentPlayer];
  const space = state.board[player.position];
  if (!space || space.type !== SpaceType.Property) return null;
  if (space.owner !== state.currentPlayer) return null;
  if (space.houses >= 5 || space.mortgaged) return null;
  if (space.id === state.justBoughtSpaceId) return null;
  if (state.builtThisStop) return null;
  const cost = getHouseCost(space, space.houses);
  if (cost === 0 || player.money < cost) return null;
  return { type: GameActionType.BuildHouse, spaceId: space.id };
}
```

2. Remove `isMonopoly` from the import statement on line 5:

```typescript
import { getHouseCost, JAIL_FINE } from '../data/board';
```

(Delete the `import { isMonopoly } from './rent';` line entirely — `isMonopoly` is no longer referenced in this file.)

- [x] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/logic/__tests__/bot.test.ts`
Expected: PASS — all bot tests green, including the updated incomplete-color-set test.

- [x] **Step 5: Run the full verification suite**

Run:
- `npm run typecheck` — expected PASS (no unused `isMonopoly` import left behind)
- `npm run lint` — expected PASS
- `npm run test:unit` — expected PASS

- [x] **Step 6: Commit**

```bash
git add src/logic/bot.ts src/logic/__tests__/bot.test.ts docs/superpowers/plans/2026-08-20-bot-build-without-monopoly.md
git commit -m "feat: let bots build houses without a full color set"
```
