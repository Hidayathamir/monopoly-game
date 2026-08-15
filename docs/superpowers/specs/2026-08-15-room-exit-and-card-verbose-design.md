# Monopoly — Room Exit Collapse & Verbose Card Logs

**Date**: 2026-08-15
**Stack**: React 19 + TypeScript + Vite 8; authoritative Node.js `ws` server (shared reducer/cards logic)

## Goal

Fix four UX issues:

1. The in-game "Keluar Kamar" (Leave Room) button always shows by default in the Sidebar — it should be collapsed behind a small icon and expand on click.
2. Rename all Indonesian wording "kamar" → "ruangan".
3. Make Chance/Community-chest card events verbose in the event log — especially cards whose amount is computed from game state (StreetRepairs per house/hotel, CollectFromPlayers per player).
5. The leave button should ask for confirmation before actually leaving.

Issue 4 (turn-switch bug in Multiplayer LAN) is **dropped** from this batch — root cause unconfirmed, will be investigated separately.

## Decisions

| # | Change | Decision |
|---|--------|----------|
| 1 | Leave button visibility | Collapsed by default behind a small icon in the Sidebar footer (same pattern as the 🌐 LanguageCurrencyBar); expands on click |
| 2 | Wording | Indonesian: all user-facing "Kamar" → "Ruangan" (server error strings + i18n values). English "Room" unchanged |
| 3 | Card event logs | One verbose log line per card effect that includes the card name, player, and amount; computed cards show the full breakdown (per house/hotel, per player) |
| 5 | Leave confirmation | Custom themed `Modal` with Batal/Keluar buttons before calling `onLeave` |

## Change details

### 1 + 5 — Room exit collapse + confirmation

**Current state:** `Sidebar.tsx:48-52` renders a danger Button "Keluar Kamar" whenever `onLeave` is provided (i.e. always in multiplayer). `Lobby.tsx:54-56` always renders "Keluar". No confirmation anywhere.

**New reusable component `RoomExit.tsx`** (new file `src/components/RoomExit.tsx`):

- Props: `{ onLeave: () => void; collapsed?: boolean }`.
- When `collapsed` (used by Sidebar): render a small icon-only toggle button in the sidebar footer (e.g. ⚙, matching the LanguageCurrencyBar pattern). Default collapsed. Click toggles an expanded panel that shows the danger button "Keluar Ruangan".
- In both modes, clicking the leave button opens a custom confirmation `Modal` (reuse `src/components/Modals/Modal.tsx`):
  - Title: `confirm.leaveTitle`
  - Body: `confirm.leaveMessage` ("Yakin ingin keluar dari ruangan ini?")
  - Buttons: `confirm.cancel` (Batal, secondary) and `confirm.leave` (Keluar, danger).
- Only on "Keluar" (confirm) does it call `onLeave()`.
- In the Lobby the button stays visible (not collapsed — it's the primary exit there) but still gets the confirmation modal (`collapsed={false}`).

**i18n keys to add** (both locales):
- `confirm.leaveTitle`: "Keluar Ruangan" / "Leave Room"
- `confirm.leaveMessage`: "Yakin ingin keluar dari ruangan ini?" / "Are you sure you want to leave this room?"
- `confirm.cancel`: "Batal" / "Cancel"
- `confirm.leave`: "Keluar" / "Leave"

**Files:**
- `src/components/RoomExit.tsx` (new)
- `src/components/Sidebar.tsx` — replace the Button block (lines 48-52) with `<RoomExit onLeave={onLeave} collapsed />`
- `src/components/Lobby.tsx` — replace Button (lines 54-56) with `<RoomExit onLeave={leave} />`
- `src/i18n/locales/{en,id}/translation.json` — add `confirm.*` keys

### 2 — "kamar" → "ruangan"

Only Indonesian strings change; English already uses "Room".

**i18n `src/i18n/locales/id/translation.json`:**
- `setup.createRoom`: "Buat Kamar" → "Buat Ruangan"
- `setup.joinRoom`: "Masuk Kamar" → "Masuk Ruangan"
- `setup.roomCode`: "Kode Kamar" → "Kode Ruangan"
- `lobby.roomCode`: "Kode Kamar:" → "Kode Ruangan:"
- `lobby.leaveRoom`: "Keluar Kamar" → "Keluar Ruangan"

**Server error strings** (hardcoded Indonesian, shown to clients):
- `server/gameServer.ts:90`: "Kamar penuh (maks 6 pemain)" → "Ruangan penuh (maks 6 pemain)"
- `server/http.ts:75`: "Kamar tidak ditemukan" → "Ruangan tidak ditemukan"

**Tests to update:**
- `server/__tests__/gameServer.test.ts:42` — expects "Kamar penuh (maks 6 pemain)"
- `server/__tests__/http.test.ts:86` — expects "Kamar tidak ditemukan"

### 3 — Verbose card event logs

**Current state:** every card draw pushes `event.drewCard` ("{{name}} mengambil kartu: {{cardId}}"), then the effect pushes a generic line. Two lines, and the effect line doesn't name the card.

**Design:** make **one** verbose line per card effect that names the card, player, and amount. Drop the generic `event.drewCard` line (each effect names the card itself).

**`src/logic/cards.ts` — `resolveCardEffect`:** every card effect log now names the card (`cardId`); computed cards add breakdown params:

- `Collect` → `{ key: 'event.cardCollect', params: { name, cardId, amount } }`
- `Pay` → `{ key: 'event.cardPay', params: { name, cardId, amount } }`
- `CollectFromPlayers` → `{ key: 'event.cardCollectPlayers', params: { name, cardId, amount, perPlayer, playerCount } }` (perPlayer = `effect.amount`, playerCount = number of other players who paid)
- `StreetRepairs` → `{ key: 'event.cardStreetRepairs', params: { name, cardId, amount, houseCount, hotelCount, perHouse, perHotel } }`
- `GoToJail` → **new key** `{ key: 'event.cardToJail', params: { name, cardId } }` — do **not** reuse `event.toJail` (that key is shared with the GoToJail space at `gameReducer.ts:236`, asserted in `gameReducer.test.ts:718`)
- `GetOutOfJailFree` → `{ key: 'event.gotJailCard', params: { name, cardId } }`
- `GoToSpace` → `movedForward`/`movedBack` gain a `cardId` param

**`src/logic/gameReducer.ts`:** in the `DRAW_CARD` case, remove the `event.drewCard` push (line 525) — every card effect now produces a self-describing line with `cardId`.

**i18n — new key (en + id):** `event.cardToJail`: "{{name}} menarik kartu {{cardId}} dan masuk Penjara!" / "{{name}} drew {{cardId}} and went to Jail!"

**i18n — rewrite the `event.*` money-card keys (en + id):**
- `event.cardCollect`: "{{name}} menarik kartu {{cardId}} dan mendapat {{amount}}" / "{{name}} drew {{cardId}} and collected {{amount}}"
- `event.cardPay`: "{{name}} menarik kartu {{cardId}} dan membayar {{amount}} ke Parkir Gratis" / "{{name}} drew {{cardId}} and paid {{amount}} to Free Parking"
- `event.cardCollectPlayers`: "{{name}} menarik kartu {{cardId}} dan menerima {{amount}} dari semua pemain ({{playerCount}} pemain × {{perPlayer}})" / "{{name}} drew {{cardId}} and collected {{amount}} from all players ({{playerCount}} × {{perPlayer}})"
- `event.cardStreetRepairs`: "{{name}} menarik kartu {{cardId}} dan membayar {{amount}} untuk perbaikan ({{houseCount}} rumah × {{perHouse}} + {{hotelCount}} hotel × {{perHotel}})" / "{{name}} drew {{cardId}} and paid {{amount}} in repairs ({{houseCount}} houses × {{perHouse}} + {{hotelCount}} hotels × {{perHotel}})"
- `event.cardToJail` (new): "{{name}} menarik kartu {{cardId}} dan masuk Penjara!" / "{{name}} drew {{cardId}} and went to Jail!"
- `event.gotJailCard`: add `{{cardId}}` to the message
- `movedForward`/`movedBack`: add `{{cardId}}` to the message.

**`src/i18n/log.ts`:** extend `MONEY_PARAM_KEYS` to include `perHouse`, `perHotel`, `perPlayer` so the breakdown numbers are formatted as money.

**Test to update:** `src/logic/__tests__/cards.test.ts:35` — the `cardCollect` assertion must include the `cardId` param (and any other assertions that check card-effect log shapes).

## Files summary

| File | Change |
|------|--------|
| `src/components/RoomExit.tsx` | New: collapsed icon toggle + confirmation modal |
| `src/components/Sidebar.tsx` | Use `RoomExit collapsed` in footer |
| `src/components/Lobby.tsx` | Use `RoomExit` (visible) with confirmation |
| `src/i18n/locales/{en,id}/translation.json` | Add `confirm.*`; "Kamar"→"Ruangan"; verbose `event.card*` strings |
| `server/gameServer.ts` | "Ruangan penuh (maks 6 pemain)" |
| `server/http.ts` | "Ruangan tidak ditemukan" |
| `server/__tests__/gameServer.test.ts` | Updated error string |
| `server/__tests__/http.test.ts` | Updated error string |
| `src/logic/cards.ts` | `cardId` + breakdown params in effect logs |
| `src/logic/gameReducer.ts` | Remove `event.drewCard` push |
| `src/i18n/log.ts` | Money-format `perHouse`/`perHotel`/`perPlayer` |
| `src/logic/__tests__/cards.test.ts` | Updated log shapes |
| `e2e/multiplayer.spec.ts` | Leave flow: expand toggle + confirm |

## Testing

- Unit: `cards.test.ts` (verbose log shapes incl. breakdown params); `gameReducer.test.ts` (no `event.drewCard`, existing card effect logs still present); server `gameServer`/`http` tests (updated strings); a small `RoomExit` component test (expand → confirm modal → confirm calls `onLeave`).
- E2E: `multiplayer.spec.ts` — the "player can leave the room mid-game" test now: click the collapsed icon → click "Leave Room" → confirm modal → confirm → back to menu. Existing create/join smoke tests stay green (leave buttons now require confirmation, but those tests don't leave).
- Manual: verify ID + EN locales render the verbose card lines correctly, and that "ruangan" appears on the setup/lobby screens.

## Out of scope

- Issue 4 (turn-switch bug) — deferred until root-caused.
- Any change to card effect *amounts* or game rules — only the log wording changes.
- Trade-flow behavior changes.
