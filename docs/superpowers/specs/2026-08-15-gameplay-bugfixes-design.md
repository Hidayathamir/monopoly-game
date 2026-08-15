# Monopoly — Gameplay Bug Fixes

**Date**: 2026-08-15
**Stack**: React 19 + TypeScript + Vite 8; authoritative Node.js `ws` server (shared reducer/cards logic)

## Goal

Fix four play-tested bugs in the shared game logic and UI: a token that animates backward on forward card moves, a `passedGo` flag not set by cards, a build button available too early, and an incomplete jail flow. Plus a responsive fix so the center panel fits the board on phones (portrait and landscape).

## Decisions

| # | Change | Decision |
|---|--------|----------|
| 1a | Token animation direction | Add signed `lastMoveSteps` to `GameState`; animate in the recorded direction, drop the shortest-path heuristic |
| 1b | `passedGo` via card | `goToSpace()` sets `passedGo = true` when a card wraps past GO |
| 2 | Build timing | Add `justBoughtSpaceId` to `GameState`; hide "Bangun" while standing on the property just bought this turn |
| 4 | Jail flow | Show "Bayar" from the first turn in jail |
| 3 | Responsive | Center card fits the board inner area on phone portrait + landscape |

## Change details

### 1a — Token animation direction

**Root cause:** `PlayerTokens.getPath(from, to)` uses a heuristic `to < from && from - to <= 12` to animate backward. The "Majulah ke Stasiun Gambir" card moves the token from space 7 → 5 *forward* (wrapping past GO), but the heuristic animates it backward (7 → 6 → 5).

**Fix:**
- Add `lastMoveSteps: number | null` to `GameState` (signed: `+N` forward, `-N` backward, `null` = teleport/no move), initialized `null`.
- `gameReducer` `DiceAnimated`: all dice moves are forward → set `lastMoveSteps = total` (including jail-escape and forced-jail-exit); the three-doubles jail branch sets `lastMoveSteps = null`.
- `gameReducer` `ResolveSpace` GoToJail: set `lastMoveSteps = null` (teleport).
- `logic/cards.goToSpace`: set `lastMoveSteps = forward ? ((spaceId - pos + 40) % 40) : (spaceId - pos)` — negative for the "Mundurlah 3 langkah" card.
- `logic/cards.sendPlayerToJail`: set `lastMoveSteps = null`.
- `PlayerTokens`: replace `getPath(from, to)` with a direction-aware `getPath(from, to, backward)` that steps `backward ? -1 : +1` (mod 40) for `|steps|` steps; derive `backward` from `state.lastMoveSteps < 0`. The jail teleport stays handled by the existing `player.inJail && position === 10` fast-path.

### 1b — passedGo via card

**Root cause:** `goToSpace()` in `logic/cards.ts` grants `GO_SALARY` when `spaceId < player.position` but never sets `passedGo = true`, so the "harus mengelilingi papan 1x sebelum membeli properti" check still blocks buying after a card wraps you past GO.

**Fix:** in `goToSpace`, when wrapping (forward move with `spaceId < player.position`), also set `passedGo = true` on that player (in addition to adding `GO_SALARY`).

### 2 — Build only on a later visit

**Root cause:** the center "Bangun" button shows whenever the current player is on their own buildable property — including immediately after buying it this turn.

**Fix:**
- Add `justBoughtSpaceId: number | null` to `GameState` (init `null`).
- `BUY_PROPERTY`: set `justBoughtSpaceId = pending.spaceId`.
- `ROLL_DICE`: set `justBoughtSpaceId = null`.
- `ActionSection` `canBuild`: also require `space.id !== state.justBoughtSpaceId`.

Net effect: after buying, you're on the property and `justBoughtSpaceId` equals it, so "Bangun" is hidden; on a later roll you land on it with `justBoughtSpaceId` cleared, so building is allowed.

### 4 — Jail flow

**Root cause:** the "Bayar" option in `ActionSection` is gated behind `player.jailTurns > 0`, so on the first turn in jail (`jailTurns === 0`) the player can only roll for doubles, not pay.

**Fix:** in `ActionSection`, always render the "Bayar" button (and the "atau lempar dadu ganda (Nx lagi)" hint) when `player.inJail`, removing the `jailTurns > 0` vs `=== 0` split.

Verify the rest of the flow with tests (no code change expected): go-to-jail advances `currentPlayer`; `PayJailFine` clears `inJail`, advances `currentPlayer`, clears dice; `DiceRoller` shows "Lempar Dadu (Penjara)" for the jailed player.

### 3 — Responsive center panel

**Fix:** reproduce at phone portrait (≈375×667) and landscape (≈667×375). Ensure the center card is constrained to the board's inner 9×9 area on **both** axes at all sizes below `md`, and that the flex-column children cannot force the card taller than its `max-h` (add `min-h-0` to scrollable content if needed). Verify with a Playwright viewport test for both orientations (bounding box within the inner area, no overlap of the outer ring cells).

## Files summary

| File | Change |
|------|--------|
| `src/types/game.ts` | Add `lastMoveSteps: number \| null` and `justBoughtSpaceId: number \| null` to `GameState` |
| `src/logic/gameReducer.ts` | Set `lastMoveSteps` in `DiceAnimated`/`ResolveSpace`; set/clear `justBoughtSpaceId` in `BUY_PROPERTY`/`ROLL_DICE` |
| `src/logic/cards.ts` | `goToSpace`: set `passedGo` + `lastMoveSteps`; `sendPlayerToJail`: set `lastMoveSteps = null` |
| `src/components/PlayerTokens.tsx` | Direction-aware `getPath` |
| `src/components/ActionSection.tsx` | `canBuild` excludes `justBoughtSpaceId`; jail "Bayar" always visible |
| `src/components/Sidebar.tsx` (+ `src/index.css` if needed) | Responsive card constraint |
| tests | Reducer/cards/hook/component tests for all four; Playwright viewport (portrait + landscape) |

## Testing

- Unit: reducer tests for `lastMoveSteps`/`passedGo`/`justBoughtSpaceId`; `cards` tests for `goToSpace` wrap + backward; `PlayerTokens` path direction; `ActionSection` build gating + jail pay.
- E2E: existing smoke tests stay green; new/extended viewport test for portrait and landscape.

## Out of scope

- Monopoly color-set (full-group) requirement for building.
- Any change to rent, bankruptcy, or trade logic.
- Reconnect/disconnect handling.
