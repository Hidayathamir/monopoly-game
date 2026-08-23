# Manual Bot Toggle

## Summary

A toggle button that lets the player manually enable/disable bot control for their turn. When ON, the bot plays all decisions. When OFF, the player plays manually.

## Motivation

Currently, bot control is only triggered automatically (AFK timer, disconnect, leave). Players may want to temporarily let the bot play their turn while they step away briefly, without disconnecting.

## Behavior

- **Toggle ON:** Bot plays the player's turn. A visible indicator shows bot is active.
- **Toggle OFF:** Player resumes manual control.
- **Auto-reset:** If the player manually performs any action (roll, buy, trade, build, etc.), the toggle resets to OFF automatically.
- **Server trust:** Server allows client-sent bot toggle for their own player. No extra validation needed.

## UI Design

- Toggle button placed next to the leave icon in the sidebar's top-right corner (`Sidebar.tsx`).
- Icon: robot icon (same as bot indicator used elsewhere).
- Active state: gold/amber color to distinguish from inactive state.
- When toggle is ON, the TurnHeader shows "Bot is playing" status message.

## Technical Design

### New Client Message

Add `ManualBotToggle` to `ClientMessage` in `src/types/net.ts`:

```typescript
ManualBotToggle: 'manualBotToggle'
```

No payload needed — the server uses the sender's player ID.

### Server Handler

In `server/gameServer.ts`, handle `ManualBotToggle`:

1. Find the player slot by `clientId`.
2. Toggle the player's `botControlled` state (flip current value).
3. Dispatch `SetBotControl` action with the new state.
4. When manual bot is ON, clear AFK timer (bot is playing, no AFK needed).
5. When manual bot is OFF, reschedule AFK timer.

### Client State

In `GameView.tsx`:

1. Track `manualBotEnabled` state (boolean).
2. Pass toggle callback to Sidebar.
3. On toggle: send `ManualBotToggle` message, flip local state.
4. On any manual game action (roll, buy, trade, build, etc.): if `manualBotEnabled` is true, send `ManualBotToggle` to disable, reset local state.

### Reducer Integration

The existing `SetBotControl` action handler in `src/logic/gameReducer.ts` already handles setting `botControlled`. No reducer changes needed — the server dispatches the same action.

### Auto-Reset Mechanism

Client-side: When the player sends any of these game actions, check if `manualBotEnabled` is true. If so, send `ManualBotToggle` to disable bot control before sending the actual action:

- `roll` (dice roll)
- `buyProperty` / `declineBuy`
- `payRent`
- `buildHouse`
- `sellHouse` / `sellProperty`
- `mortgage` / `unmortgage`
- `proposeTrade` / `acceptTrade` / `rejectTrade` / `cancelTrade`
- `payJailFine` / `useGetOutOfJailFree`
- `declareBankruptcy`
- `skipAction`
- `endTurn`

### Visibility

When `botControlled` is true for the current player, the existing UI already shows:
- Robot icon in PlayerCard (`PlayerCard.tsx:141`)
- "Bot is playing" text in TurnHeader (`TurnHeader.tsx:18-19`)

These indicators will naturally appear when the manual toggle activates bot control.

## Files to Change

| File | Change |
|------|--------|
| `src/types/net.ts` | Add `ManualBotToggle` to `ClientMessage` |
| `server/gameServer.ts` | Handle `ManualBotToggle` message |
| `src/components/Sidebar.tsx` | Add toggle button next to leave icon |
| `src/components/GameView.tsx` | Track toggle state, handle auto-reset |
| `src/net/client.ts` | Add `manualBotToggle()` method to send message |
| i18n files | Add translation keys for toggle tooltip |

## E2E Test Cases

1. **Toggle ON:** Player clicks toggle, bot plays the turn (dice rolled automatically, actions taken).
2. **Toggle OFF:** Player clicks toggle again, manual control resumes.
3. **Auto-reset:** Player enables toggle, then manually rolls dice — toggle resets to OFF.
4. **Visual indicator:** When toggle is ON, TurnHeader shows bot status message.

## Out of Scope

- Persistence across page refresh (toggle is session-only).
- Server-side AFK timer interaction with manual toggle (handled by clearing/rescheduling).
- Distinguishing manual vs automatic bot control in the reducer (same action type).
