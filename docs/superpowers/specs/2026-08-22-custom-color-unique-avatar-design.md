# Design: Custom player colors & unique avatars

**Date:** 2026-08-22
**Status:** Draft (working-while-away; assumptions made, no approval gate)

## Context

The approved design `2026-08-21-player-color-and-avatar-design.md` shipped
palette-only colors (6 fixed `PLAYER_COLORS`) and avatars (preset emoji or
custom upload) but with two gaps that these two issues close:

- **Issue 1:** Players can only pick one of the 6 preset palette colors. They
  want to choose *any* color (custom), not just a preset.
- **Issue 2:** Two players can currently pick the same avatar (preset or
  uploaded). No player should share an avatar with another.

This design extends the existing identity model; it does not replace it.

## Assumptions (made autonomously — user is away)

1. **Custom color entry point:** the lobby identity panel keeps the 6 preset
   swatches as quick-picks AND adds a native `<input type="color">` labeled
   "Custom color" that sends any chosen hex via `SetIdentity`.
2. **Valid color format:** any CSS hex — `#RGB`, `#RRGGBB`, or `#RRGGBBAA`.
   Stored/compared normalized to lowercase. Invalid strings are ignored:
   on `join` they fall back to the next free color; on `SetIdentity` they are
   rejected with an error.
3. **Color uniqueness:** enforced server-side across *all* players (preset or
   custom). A duplicate color is rejected ("Warna sudah dipakai"). First-come
   wins; the UI disables swatches already taken by others.
4. **Avatar uniqueness:** enforced server-side. Two players may not share the
   same `PlayerAvatar` — for presets, equal `id`; for customs, equal
   `dataUrl`. A duplicate avatar is rejected ("Avatar sudah dipakai"). The UI
   disables preset avatar buttons already taken by another player; custom
   uploads are treated as unique (only an identical data URL collides, which
   the server still rejects).
5. **Bots:** `addBot()` assigns the *first free preset avatar* (not always
   `DEFAULT_AVATAR`/Cat) so a bot never collides with a human's chosen
   avatar under the new uniqueness rule.
6. **Local (single-player) mode:** unchanged. It already assigns distinct
   palette colors via `StartGame`. Custom/unique identity is a lobby
   (multiplayer) feature; the data model already accepts arbitrary color
   strings and avatars, so nothing breaks.
7. **Server error strings** stay hardcoded Indonesian (repo convention). New
   UI labels go through i18n (en + id).

## Changes

### `src/data/players.ts`
- Add `isValidColor(value: unknown): value is string` — true for `#RGB`,
  `#RRGGBB`, `#RRGGBBAA` (case-insensitive).
- Add `normalizeColor(value: string): string` — lowercases and expands
  `#RGB`/`#RGBA` to `#RRGGBB`/`#RRGGBBAA` for stable equality.

### `src/data/avatars.ts`
- Add `isSameAvatar(a: PlayerAvatar, b: PlayerAvatar): boolean` — preset ids
  equal OR custom data URLs equal.

### `server/gameServer.ts`
- `join()`: accept a custom valid color; uniqueness check covers custom colors
  too (use `normalizeColor` + `isColorTaken`). Invalid color → next free
  palette color (unchanged fallback).
- `setIdentity()`: replace the `PLAYER_COLORS.includes(...)` gate with
  `isValidColor`; normalize; reject taken colors; add avatar-taken check via
  `isSameAvatar` against other slots; reject duplicates.
- `addBot()`: pick first free preset avatar via a new helper instead of
  `DEFAULT_AVATAR`, so it respects uniqueness.
- `start()`: unchanged (passes slot colors/avatars through).

### `src/components/Lobby.tsx`
- Add `<input type="color" data-testid="color-custom">` wired to `pickColor`.
- Preset avatar buttons: compute `avatarTaken` (a *different* player slot
  already has that preset id) and disable/aria-disabled them, mirroring the
  existing taken-color treatment.

### i18n
- Add `lobby.customColor` to `en/translation.json` ("Custom color") and
  `id/translation.json` ("Warna kustom").

## Tests

- `server/__tests__/gameServer.test.ts`: update the "rejects setIdentity with
  a non-palette color" test to assert a valid custom hex color is now
  *accepted*; add tests for custom-color uniqueness, avatar uniqueness
  rejection, and bot picking a free avatar.
- `src/data/__tests__/players.test.ts`: cover `isValidColor` /
  `normalizeColor`.
- `src/data/__tests__/avatars.test.ts`: cover `isSameAvatar`.
- `src/components/__tests__/Lobby.test.tsx`: cover the custom color input and
  disabled taken preset avatars.

## Out of scope

- Mid-game identity changes, server-side avatar storage, local-setup color UI.
