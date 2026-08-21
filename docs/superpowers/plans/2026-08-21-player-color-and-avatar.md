# Player Color & Avatar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each player choose their own piece color and an avatar (preset emoji or custom upload) in the lobby, shared across all devices, persisted per name, and rendered on board tokens and player cards.

**Architecture:** Identity (`color`, `avatar`) is threaded through the shared game model — `Player` (in `GameState` snapshots), `LobbyPlayer` (lobby wire messages), and the server `Slot`. The server is authoritative: it enforces color uniqueness (first-come), validates avatars (custom data URLs size-capped), rejects mid-game identity changes, and auto-assigns free colors on join/bot-add. Clients pick in the lobby via a new `SetIdentity` message and re-send their persisted identity on create/join. Rendering reads `player.color` / `player.avatar` everywhere — no more seat-indexed `PLAYER_COLORS`.

**Tech Stack:** React 19 + TypeScript (strict, `erasableSyntaxOnly`, `verbatimModuleSyntax`), Vite 8, Tailwind v4, Node WS server (`tsx`), Vitest, i18next (en/id).

## Global Constraints

- No TS `enum`. Fixed string sets are `const` objects with derived union types (see `src/types/game.ts`).
- `verbatimModuleSyntax: true` → type-only imports must use `import type`.
- `noUnusedLocals` / `noUnusedParameters` are on — no unused imports/vars.
- Wire message values are part of the client/server contract and must never change (see `src/types/net.ts`).
- Semicolon style: match the file being edited (`src/logic/*` and `src/types/game.ts` use semicolons; most components/hooks/net/server omit them). New `src/data/avatars.ts` uses semicolons.
- Every UI string must be added to both `src/i18n/locales/en/translation.json` and `src/i18n/locales/id/translation.json` (flat keys, `keySeparator: false`).
- Server-side errors stay hardcoded Indonesian (existing convention).
- `npm run typecheck` (`tsc -b`) builds all three tsconfig projects. `npm run test:unit` runs vitest (excludes `e2e/**`).
- The reducer is the single source of truth for rules and runs on both client and server.

---

### Task 1: Avatar domain model

**Files:**
- Modify: `src/types/game.ts` (add `AvatarKind`, `PlayerAvatar`, type-only import)
- Create: `src/data/avatars.ts`
- Test: `src/data/__tests__/avatars.test.ts`

**Interfaces:**
- Consumes: nothing new (existing `GameState`/`Player` untouched in this task).
- Produces:
  - `export const AvatarKind = { Preset: 'preset', Custom: 'custom' } as const` in `src/types/game.ts`; `export type AvatarKind = (typeof AvatarKind)[keyof typeof AvatarKind]`.
  - `export type PlayerAvatar = { kind: typeof AvatarKind.Preset; id: PresetAvatarId } | { kind: typeof AvatarKind.Custom; dataUrl: string }` in `src/types/game.ts`.
  - `src/data/avatars.ts`: `PRESET_AVATARS`, `PresetAvatarId`, `PRESET_EMOJI`, `DEFAULT_AVATAR`, `CUSTOM_AVATAR_MAX_DATA_URL_LENGTH` (100_000), `CUSTOM_AVATAR_MAX_DIMENSION` (96), `isPresetAvatar`, `isCustomAvatar`, `isValidAvatar`, `avatarEmoji`.

- [ ] **Step 1: Write the failing unit test**

Create `src/data/__tests__/avatars.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  PRESET_AVATARS, PRESET_EMOJI, DEFAULT_AVATAR,
  CUSTOM_AVATAR_MAX_DATA_URL_LENGTH,
  isPresetAvatar, isCustomAvatar, isValidAvatar, avatarEmoji,
} from '../avatars';
import { AvatarKind } from '../../types/game';

describe('avatars', () => {
  it('defines 10 distinct presets with emoji', () => {
    expect(Object.keys(PRESET_AVATARS)).toHaveLength(10)
    expect(Object.keys(PRESET_EMOJI)).toHaveLength(10)
  })

  it('defaults to the cat preset', () => {
    expect(DEFAULT_AVATAR).toEqual({ kind: AvatarKind.Preset, id: PRESET_AVATARS.Cat })
  })

  it('accepts a valid preset avatar', () => {
    const avatar = { kind: AvatarKind.Preset, id: PRESET_AVATARS.Dog }
    expect(isPresetAvatar(avatar)).toBe(true)
    expect(isValidAvatar(avatar)).toBe(true)
    expect(avatarEmoji(avatar)).toBe('🐶')
  })

  it('rejects an unknown preset id', () => {
    expect(isPresetAvatar({ kind: AvatarKind.Preset, id: 'unicorn' })).toBe(false)
    expect(isValidAvatar({ kind: AvatarKind.Preset, id: 'unicorn' })).toBe(false)
    expect(avatarEmoji({ kind: AvatarKind.Preset, id: 'unicorn' })).toBeNull()
  })

  it('accepts a custom data URL avatar within the cap', () => {
    const dataUrl = `data:image/jpeg;base64,${'a'.repeat(100)}`
    expect(isCustomAvatar({ kind: AvatarKind.Custom, dataUrl })).toBe(true)
    expect(isValidAvatar({ kind: AvatarKind.Custom, dataUrl })).toBe(true)
  })

  it('rejects a custom avatar that is not a data URL', () => {
    expect(isCustomAvatar({ kind: AvatarKind.Custom, dataUrl: 'https://x/y.png' })).toBe(false)
  })

  it('rejects a custom avatar exceeding the size cap', () => {
    const tooBig = `data:image/jpeg;base64,${'a'.repeat(CUSTOM_AVATAR_MAX_DATA_URL_LENGTH + 1)}`
    expect(isCustomAvatar({ kind: AvatarKind.Custom, dataUrl: tooBig })).toBe(false)
    expect(isValidAvatar({ kind: AvatarKind.Custom, dataUrl: tooBig })).toBe(false)
  })

  it('rejects non-object values', () => {
    expect(isValidAvatar(null)).toBe(false)
    expect(isValidAvatar(undefined)).toBe(false)
    expect(isValidAvatar('cat')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/__tests__/avatars.test.ts`
Expected: FAIL — `Cannot find module '../avatars'`.

- [ ] **Step 3: Add the types to `src/types/game.ts`**

At the top of `src/types/game.ts` add the type-only import (place with the file's other imports; the file currently has no imports — add them at the top):

```ts
import type { PresetAvatarId } from '../data/avatars';
```

Add `AvatarKind` next to the other enum-like consts (e.g. near `CardType`) and `PlayerAvatar` near `Player`:

```ts
export const AvatarKind = {
  Preset: 'preset',
  Custom: 'custom',
} as const;
export type AvatarKind = (typeof AvatarKind)[keyof typeof AvatarKind];

export type PlayerAvatar =
  | { kind: typeof AvatarKind.Preset; id: PresetAvatarId }
  | { kind: typeof AvatarKind.Custom; dataUrl: string };
```

- [ ] **Step 4: Create `src/data/avatars.ts`**

```ts
import { AvatarKind, type PlayerAvatar } from '../types/game';

export const PRESET_AVATARS = {
  Cat: 'cat',
  Dog: 'dog',
  Robot: 'robot',
  Alien: 'alien',
  Ghost: 'ghost',
  Penguin: 'penguin',
  Fox: 'fox',
  Dino: 'dino',
  Crab: 'crab',
  Octopus: 'octopus',
} as const;
export type PresetAvatarId = (typeof PRESET_AVATARS)[keyof typeof PRESET_AVATARS];

export const PRESET_EMOJI: Record<PresetAvatarId, string> = {
  [PRESET_AVATARS.Cat]: '🐱',
  [PRESET_AVATARS.Dog]: '🐶',
  [PRESET_AVATARS.Robot]: '🤖',
  [PRESET_AVATARS.Alien]: '👽',
  [PRESET_AVATARS.Ghost]: '👻',
  [PRESET_AVATARS.Penguin]: '🐧',
  [PRESET_AVATARS.Fox]: '🦊',
  [PRESET_AVATARS.Dino]: '🦖',
  [PRESET_AVATARS.Crab]: '🦀',
  [PRESET_AVATARS.Octopus]: '🐙',
};

export const DEFAULT_AVATAR: PlayerAvatar = { kind: AvatarKind.Preset, id: PRESET_AVATARS.Cat };

export const CUSTOM_AVATAR_MAX_DATA_URL_LENGTH = 100_000;
export const CUSTOM_AVATAR_MAX_DIMENSION = 96;

export function isPresetAvatar(value: unknown): value is { kind: typeof AvatarKind.Preset; id: PresetAvatarId } {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return v.kind === AvatarKind.Preset && typeof v.id === 'string' && Object.hasOwn(PRESET_EMOJI, v.id);
}

export function isCustomAvatar(value: unknown): value is { kind: typeof AvatarKind.Custom; dataUrl: string } {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.kind !== AvatarKind.Custom) return false;
  if (typeof v.dataUrl !== 'string') return false;
  if (v.dataUrl.length > CUSTOM_AVATAR_MAX_DATA_URL_LENGTH) return false;
  return v.dataUrl.startsWith('data:image/');
}

export function isValidAvatar(value: unknown): value is PlayerAvatar {
  return isPresetAvatar(value) || isCustomAvatar(value);
}

export function avatarEmoji(avatar: PlayerAvatar): string | null {
  if (avatar.kind !== AvatarKind.Preset) return null;
  return Object.hasOwn(PRESET_EMOJI, avatar.id) ? (PRESET_EMOJI[avatar.id] ?? null) : null;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/data/__tests__/avatars.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: PASS (nothing consumes the new types yet).

- [ ] **Step 7: Commit**

```bash
git add src/types/game.ts src/data/avatars.ts src/data/__tests__/avatars.test.ts
git commit -m "feat: add avatar domain model (presets, custom cap, validators)"
```

---

### Task 2: Thread identity through the shared model

**Files:**
- Modify: `src/types/game.ts` (`Player` gains `color`/`avatar`; `GameActionType.StartGame` gains `colors`/`avatars`)
- Modify: `src/types/net.ts` (`LobbyPlayer` gains `color`/`avatar`)
- Modify: `src/logic/gameReducer.ts` (`StartGame` writes defaults)
- Modify: `src/logic/seed.ts` (`createSeededState` + `SeedPlayerSpec`)
- Modify: `server/gameServer.ts` (`getPlayers` emits default identity)
- Modify: `src/logic/__tests__/gameReducer.test.ts` (add StartGame identity test)
- Modify: `src/logic/__tests__/cards.test.ts`, `src/logic/__tests__/bot.test.ts` (player constructions gain `color`/`avatar`)
- Modify: `src/components/__tests__/TurnHeader.test.tsx`, `src/components/__tests__/PlayerCard.test.tsx` (player constructions gain `color`/`avatar`)
- Modify: `e2e/helpers/seed.ts` (`buildWaitingState` players gain `color`/`avatar`)
- Regenerate fixtures via scripts

**Interfaces:**
- Consumes: `PlayerAvatar`, `AvatarKind`, `DEFAULT_AVATAR`, `PRESET_AVATARS` (Task 1); `PLAYER_COLORS` from `src/data/players.ts`.
- Produces:
  - `Player` gains required `color: string` and `avatar: PlayerAvatar`.
  - `LobbyPlayer` gains required `color: string` and `avatar: PlayerAvatar`.
  - `GameActionType.StartGame` payload gains optional `colors?: string[]` and `avatars?: PlayerAvatar[]`. The reducer defaults missing entries to `PLAYER_COLORS[i % PLAYER_COLORS.length]` and `DEFAULT_AVATAR`.
  - `SeedPlayerSpec` gains optional `color?: string` and `avatar?: PlayerAvatar`.

- [ ] **Step 1: Add fields to `Player` and the `StartGame` action in `src/types/game.ts`**

`Player` (currently lines 157-171) becomes:

```ts
export type Player = {
  id: number;
  name: string;
  money: number;
  position: number;
  properties: number[];
  passedGo: boolean;
  inJail: boolean;
  jailTurns: number;
  bankrupt: boolean;
  getOutOfJailFreeCards: number;
  isBot: boolean;
  botControlled: boolean;
  afk: boolean;
  color: string;
  avatar: PlayerAvatar;
};
```

`GameActionType.StartGame` variant gains the two optional arrays:

```ts
| { type: typeof GameActionType.StartGame; playerCount: number; names: string[]; isBot?: boolean[]; colors?: string[]; avatars?: PlayerAvatar[] }
```

- [ ] **Step 2: Add fields to `LobbyPlayer` in `src/types/net.ts`**

```ts
export type LobbyPlayer = {
  id: number;
  name: string | null;
  connected: boolean;
  isBot: boolean;
  color: string;
  avatar: PlayerAvatar;
};
```

Add `import type { PlayerAvatar } from './game'` to the existing import line in `src/types/net.ts`.

- [ ] **Step 3: Write the failing reducer test (append to `src/logic/__tests__/gameReducer.test.ts`)**

Add the imports at the top of the file:

```ts
import { DEFAULT_AVATAR } from '../../data/avatars';
import { PLAYER_COLORS } from '../../data/players';
import { AvatarKind } from '../../types/game';
```

Add this test case inside the existing `describe`:

```ts
it('writes color and avatar onto each player at start, defaulting when absent', () => {
  const state = gameReducer(createInitialState(), {
    type: GameActionType.StartGame,
    playerCount: 2,
    names: ['Alice', 'Bob'],
  });
  expect(state.players[0].color).toBe(PLAYER_COLORS[0])
  expect(state.players[1].color).toBe(PLAYER_COLORS[1])
  expect(state.players[0].avatar).toEqual(DEFAULT_AVATAR)
  expect(state.players[1].avatar).toEqual(DEFAULT_AVATAR)

  const custom = { kind: AvatarKind.Preset, id: 'dog' as const }
  const state2 = gameReducer(createInitialState(), {
    type: GameActionType.StartGame,
    playerCount: 2,
    names: ['Alice', 'Bob'],
    colors: [PLAYER_COLORS[4], PLAYER_COLORS[5]],
    avatars: [custom, custom],
  });
  expect(state2.players[0].color).toBe(PLAYER_COLORS[4])
  expect(state2.players[1].color).toBe(PLAYER_COLORS[5])
  expect(state2.players[0].avatar).toEqual(custom)
})
```

> `PresetAvatarId` is a string union including `'dog'`, so `id: 'dog' as const` narrows correctly.

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx vitest run src/logic/__tests__/gameReducer.test.ts`
Expected: FAIL — `state.players[0].color` is `undefined` (and the typecheck for other player constructions breaks; that is expected and fixed in Steps 6-9).

- [ ] **Step 5: Implement defaults in the reducer (`src/logic/gameReducer.ts`)**

Add imports at the top:

```ts
import { PLAYER_COLORS } from '../data/players';
import { DEFAULT_AVATAR } from '../data/avatars';
```

In the `StartGame` case, inside the player loop, add:

```ts
color: action.colors?.[i] ?? PLAYER_COLORS[i % PLAYER_COLORS.length],
avatar: action.avatars?.[i] ?? DEFAULT_AVATAR,
```

- [ ] **Step 6: Update `createSeededState` and `SeedPlayerSpec` in `src/logic/seed.ts`**

Add to imports:

```ts
import { PLAYER_COLORS } from '../data/players';
import { DEFAULT_AVATAR } from '../data/avatars';
```

`SeedPlayerSpec` gains:

```ts
color?: string;
avatar?: PlayerAvatar;
```

Add `PlayerAvatar` to the existing `import type` from `'../types/game'`. In the player `.map(...)`, add:

```ts
color: p.color ?? PLAYER_COLORS[p.id % PLAYER_COLORS.length],
avatar: p.avatar ?? DEFAULT_AVATAR,
```

- [ ] **Step 7: Update `getPlayers()` in `server/gameServer.ts`**

```ts
getPlayers(): LobbyPlayer[] {
  return this.slots.map((s, i) => ({
    id: i,
    name: s.name,
    connected: s.connected,
    isBot: s.isBot,
    color: PLAYER_COLORS[i % PLAYER_COLORS.length],
    avatar: DEFAULT_AVATAR,
  }))
}
```

Add the imports (`PLAYER_COLORS` from `'../../src/data/players'`, `DEFAULT_AVATAR` from `'../../src/data/avatars'`). This is a temporary default until Task 3 stores real identity on slots. Import `type LobbyPlayer` already exists.

- [ ] **Step 8: Fix remaining manual `Player` constructions**

Add `color` and `avatar` to every manually constructed `Player` object (use `DEFAULT_AVATAR` and `PLAYER_COLORS[i]`):

- `src/logic/__tests__/cards.test.ts` — both players in `makeState`:
  ```ts
  color: PLAYER_COLORS[0], avatar: DEFAULT_AVATAR,
  color: PLAYER_COLORS[1], avatar: DEFAULT_AVATAR,
  ```
- `src/logic/__tests__/bot.test.ts` — `makePlayer`:
  ```ts
  color: PLAYER_COLORS[0],
  avatar: DEFAULT_AVATAR,
  ```
- `src/components/__tests__/TurnHeader.test.tsx` — the player in `makeState`:
  ```ts
  color: PLAYER_COLORS[0], avatar: DEFAULT_AVATAR,
  ```
- `src/components/__tests__/PlayerCard.test.tsx` — the `player` const:
  ```ts
  color: PLAYER_COLORS[0], avatar: DEFAULT_AVATAR,
  ```

Add the needed imports to each file (`DEFAULT_AVATAR` from the correct relative `avatars` path, `PLAYER_COLORS` from the correct relative `players` path).

- [ ] **Step 9: Update `e2e/helpers/seed.ts` `buildWaitingState`**

Each mapped player gains:

```ts
color: PLAYER_COLORS[p.id % PLAYER_COLORS.length],
avatar: DEFAULT_AVATAR,
```

Add imports from `'../../src/data/players'` and `'../../src/data/avatars'`.

- [ ] **Step 10: Regenerate the generated fixtures**

Run:
```bash
npm run print-initial-state && npm run print-seed && npm run print-monopoly-rent-seed && npm run print-bankruptcy-liquidation-seed
```

These write `e2e/fixtures/initial-state.ts`, `e2e/fixtures/bankruptcy-seed.ts`, `e2e/fixtures/monopoly-rent-seed.ts`, `e2e/fixtures/bankruptcy-liquidation-seed.ts`. `print-seed.ts` writes `e2e/fixtures/bankruptcy-seed.ts`. Confirm `git status` shows the fixture diffs gained `color`/`avatar` fields on players.

- [ ] **Step 11: Run typecheck + unit tests**

Run: `npm run typecheck`
Expected: PASS.
Run: `npx vitest run`
Expected: PASS (all unit tests, including the new reducer identity test).

- [ ] **Step 12: Commit**

```bash
git add src/types/game.ts src/types/net.ts src/logic/gameReducer.ts src/logic/seed.ts server/gameServer.ts \
  src/logic/__tests__/gameReducer.test.ts src/logic/__tests__/cards.test.ts src/logic/__tests__/bot.test.ts \
  src/components/__tests__/TurnHeader.test.tsx src/components/__tests__/PlayerCard.test.tsx \
  e2e/helpers/seed.ts e2e/fixtures
git commit -m "feat: thread player color and avatar through shared model"
```

---

### Task 3: Server-side identity (slots, SetIdentity, bots, start)

**Files:**
- Modify: `server/gameServer.ts`
- Modify: `server/http.ts`
- Modify: `src/types/net.ts` (`ClientMessageType.SetIdentity`, `ClientMessage` variants)
- Modify: `server/__tests__/gameServer.test.ts`
- Modify: `server/__tests__/http.test.ts` (if it asserts message shapes — verify)

**Interfaces:**
- Consumes: `PLAYER_COLORS`, `DEFAULT_AVATAR`, `isValidAvatar`, `AvatarKind`; `Slot` shape from Task 2's `getPlayers` default.
- Produces:
  - `Slot` gains `color: string | null` and `avatar: PlayerAvatar | null`.
  - `GameServer.join(clientId, name, opts?: { color?: string; avatar?: PlayerAvatar })` — assigns the requested free color (or first free), uses the given avatar (or default), preserves a disconnected slot's existing identity on reconnect.
  - `GameServer.setIdentity(clientId, opts: { color?: string; avatar?: PlayerAvatar })` — setup-phase only; validates color is free or your own and avatar is valid; broadcasts lobby on success; sends a hardcoded Indonesian `ServerMessageType.Error` on failure.
  - `addBot()` assigns the next free color and `DEFAULT_AVATAR`.
  - `start()` passes `colors`/`avatars` arrays into the `StartGame` action.
  - `http.ts` passes `color`/`avatar` from `Create`/`Join` messages and routes `SetIdentity`.

- [ ] **Step 1: Write the failing server tests (append to `server/__tests__/gameServer.test.ts`)**

```ts
import { PLAYER_COLORS } from '../../src/data/players'
import { DEFAULT_AVATAR, PRESET_AVATARS } from '../../src/data/avatars'
import { AvatarKind } from '../../src/types/game'

it('auto-assigns the first free color on join and keeps uniqueness', () => {
  const { server } = setup()
  server.join('c0', 'Alice', { color: PLAYER_COLORS[0] })
  server.join('c1', 'Bob', { color: PLAYER_COLORS[0] }) // taken -> first free
  const players = server.getPlayers()
  expect(players[0].color).toBe(PLAYER_COLORS[0])
  expect(players[1].color).toBe(PLAYER_COLORS[1])
})

it('stores the requested avatar on the slot and surfaces it via getPlayers', () => {
  const { server } = setup()
  server.join('c0', 'Alice', { avatar: { kind: AvatarKind.Preset, id: PRESET_AVATARS.Dog } })
  expect(server.getPlayers()[0].avatar).toEqual({ kind: AvatarKind.Preset, id: PRESET_AVATARS.Dog })
})

it('setIdentity updates color and avatar and broadcasts the lobby', () => {
  const { server, sent } = setup()
  server.join('c0', 'Alice')
  server.join('c1', 'Bob')
  const before = sent.length
  server.setIdentity('c0', { color: PLAYER_COLORS[4], avatar: { kind: AvatarKind.Preset, id: PRESET_AVATARS.Fox } })
  expect(server.getPlayers()[0].color).toBe(PLAYER_COLORS[4])
  const lobbyMsg = sent.slice(before).find((m) => m.type === 'lobby') as { type: string; players: { color: string }[] } | undefined
  expect(lobbyMsg?.players[0].color).toBe(PLAYER_COLORS[4])
})

it('rejects setIdentity onto a color another player holds', () => {
  const { server, sent } = setup()
  server.join('c0', 'Alice', { color: PLAYER_COLORS[0] })
  server.join('c1', 'Bob', { color: PLAYER_COLORS[1] })
  server.setIdentity('c1', { color: PLAYER_COLORS[0] })
  expect(sent.some((m) => m.type === 'error' && m.message === 'Warna sudah dipakai')).toBe(true)
  expect(server.getPlayers()[1].color).toBe(PLAYER_COLORS[1])
})

it('rejects setIdentity after the game has started', () => {
  const { server, sent } = setup()
  server.join('c0', 'Alice')
  server.join('c1', 'Bob')
  server.start('c0')
  server.setIdentity('c0', { color: PLAYER_COLORS[2] })
  expect(sent.some((m) => m.type === 'error')).toBe(true)
  expect(server.getState().players[0].color).not.toBe(PLAYER_COLORS[2])
})

it('rejects an invalid or oversized custom avatar', () => {
  const { server, sent } = setup()
  server.join('c0', 'Alice')
  server.setIdentity('c0', { avatar: { kind: AvatarKind.Custom, dataUrl: 'https://x/y.png' } })
  expect(sent.some((m) => m.type === 'error')).toBe(true)
})

it('assigns bots the next free color and the default avatar', () => {
  const { server } = setup()
  server.join('c0', 'Alice', { color: PLAYER_COLORS[0] })
  server.addBot('c0')
  const players = server.getPlayers()
  expect(players[1].isBot).toBe(true)
  expect(players[1].color).toBe(PLAYER_COLORS[1])
  expect(players[1].avatar).toEqual(DEFAULT_AVATAR)
})

it('passes colors and avatars into the StartGame action at start', () => {
  const { server } = setup()
  server.join('c0', 'Alice', { color: PLAYER_COLORS[2], avatar: { kind: AvatarKind.Preset, id: PRESET_AVATARS.Robot } })
  server.join('c1', 'Bob', { color: PLAYER_COLORS[3], avatar: { kind: AvatarKind.Preset, id: PRESET_AVATARS.Ghost } })
  server.start('c0')
  const players = server.getState().players
  expect(players[0].color).toBe(PLAYER_COLORS[2])
  expect(players[1].color).toBe(PLAYER_COLORS[3])
  expect(players[0].avatar).toEqual({ kind: AvatarKind.Preset, id: PRESET_AVATARS.Robot })
  expect(players[1].avatar).toEqual({ kind: AvatarKind.Preset, id: PRESET_AVATARS.Ghost })
})

it('preserves identity when a disconnected player rejoins', () => {
  const { server } = setup()
  server.join('c0', 'Alice', { color: PLAYER_COLORS[4] })
  server.leave('c0') // setup phase leave frees nothing; slot reset. Simulate in-game instead:
  server.join('c1', 'Bob')
  server.start('c1')
  server.disconnect('c0')
  server.join('c0', 'Alice') // reconnect path (in-game) keeps the slot
  const players = server.getState().players
  expect(players[0].color).toBe(PLAYER_COLORS[4])
})
```

> Note: the last test simulates reconnect during gameplay: `c0` joins (slot 0), `c1` joins (slot 1, host via `nextConnectedSlot`? — `hostSlotIndex` stays 0 unless host leaves). `server.start('c1')` requires `c1` to be host; host is slot 0 by default. Use `server.start('c0')` instead and `server.disconnect('c0')` then rejoin. Adjust the test accordingly at implementation time so it reflects the real reconnect semantics (`join()` matches a disconnected slot by name and keeps its identity).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/__tests__/gameServer.test.ts`
Expected: FAIL — `join` has no `opts` param, `setIdentity` doesn't exist, `getPlayers()` already returns defaults (not real identity).

- [ ] **Step 3: Add `SetIdentity` to the wire contract in `src/types/net.ts`**

```ts
export const ClientMessageType = {
  Create: 'create',
  Join: 'join',
  Start: 'start',
  Leave: 'leave',
  AddBot: 'addBot',
  RemoveBot: 'removeBot',
  Action: 'action',
  SetIdentity: 'setIdentity',
} as const
```

`ClientMessage` gains fields on `Create`/`Join` and a new variant:

```ts
export type ClientMessage =
  | { type: typeof ClientMessageType.Create; name: string; color?: string; avatar?: PlayerAvatar }
  | { type: typeof ClientMessageType.Join; code: string; name: string; color?: string; avatar?: PlayerAvatar }
  | { type: typeof ClientMessageType.SetIdentity; color?: string; avatar?: PlayerAvatar }
  | { type: typeof ClientMessageType.Start }
  | ...
```

Add `PlayerAvatar` to the `import type { GameState, GameAction, GamePhase }` → `import type { GameState, GameAction, GamePhase, PlayerAvatar } from './game'`.

- [ ] **Step 4: Extend `Slot` in `server/gameServer.ts`**

```ts
interface Slot {
  clientId: ClientId | null
  name: string | null
  connected: boolean
  isBot: boolean
  gracePending: boolean
  color: string | null
  avatar: PlayerAvatar | null
}
```

Update the `slots` initializer to include `color: null, avatar: null`. Import `type PlayerAvatar` from `'../../src/types/game'`.

- [ ] **Step 5: Implement identity logic in `GameServer`**

Add a helper:

```ts
private nextFreeColor(): string {
  const used = new Set(this.slots.map((s) => s.color).filter((c): c is string => c !== null))
  return PLAYER_COLORS.find((c) => !used.has(c)) ?? PLAYER_COLORS[0]
}
```

In `join(clientId, name, opts?)`:

- Reconnect path (existing `disconnected` block): leave `slot.color`/`slot.avatar` untouched (identity preserved).
- New-join path (the `this.slots[index] = { ... }` assignments at the two join sites and the create flow): set
  ```ts
  color: opts?.color !== undefined && this.isColorFree(opts.color) ? opts.color : this.nextFreeColor(),
  avatar: opts?.avatar !== undefined && isValidAvatar(opts.avatar) ? opts.avatar : DEFAULT_AVATAR,
  ```
  Add a private `isColorFree(color: string): boolean` that checks no *other* joined/connected slot holds it (and treats `undefined` as free).

Add `setIdentity`:

```ts
setIdentity(clientId: ClientId, opts: { color?: string; avatar?: PlayerAvatar }): void {
  if (this.state.phase !== GamePhase.Setup) {
    this.events.send(clientId, { type: ServerMessageType.Error, message: 'Identitas hanya bisa diubah sebelum permainan dimulai' })
    return
  }
  const index = this.slots.findIndex((s) => s.clientId === clientId)
  if (index === -1) return
  const slot = this.slots[index]
  if (opts.color !== undefined) {
    const takenBy = this.slots.findIndex((s, i) => i !== index && s.name !== null && s.color === opts.color)
    if (takenBy !== -1) {
      this.events.send(clientId, { type: ServerMessageType.Error, message: 'Warna sudah dipakai' })
      return
    }
    slot.color = opts.color
  }
  if (opts.avatar !== undefined) {
    if (!isValidAvatar(opts.avatar)) {
      this.events.send(clientId, { type: ServerMessageType.Error, message: 'Avatar tidak valid' })
      return
    }
    slot.avatar = opts.avatar
  }
  this.broadcast()
}
```

In `addBot`:

```ts
this.slots[index] = { clientId: null, name, connected: true, isBot: true, gracePending: false, color: this.nextFreeColor(), avatar: DEFAULT_AVATAR }
```

In `removeBot`, reset the slot to include `color: null, avatar: null`.

In `leave` (setup phase reset) and `disconnect` (setup phase), reset or preserve identity appropriately:
- Setup-phase `leave`: `this.slots[index] = { clientId: null, name: null, connected: false, isBot: false, gracePending: false, color: null, avatar: null }`.
- Setup-phase bot cleanup loop: same full reset.
- In-game `leave`/`disconnect`: keep `slot.color`/`slot.avatar` (only `connected`/`clientId` change).

Update `getPlayers()` to use the slot identity (fall back to defaults):

```ts
getPlayers(): LobbyPlayer[] {
  return this.slots.map((s, i) => ({
    id: i,
    name: s.name,
    connected: s.connected,
    isBot: s.isBot,
    color: s.color ?? PLAYER_COLORS[i % PLAYER_COLORS.length],
    avatar: s.avatar ?? DEFAULT_AVATAR,
  }))
}
```

In `start()`, pass the joined slots' identity:

```ts
this.dispatch({
  type: GameActionType.StartGame,
  playerCount: joined.length,
  names: joined.map((s, i) => s.name ?? `P${i + 1}`),
  isBot: joined.map((s) => s.isBot),
  colors: joined.map((s) => s.color ?? PLAYER_COLORS[this.slots.indexOf(s) % PLAYER_COLORS.length]),
  avatars: joined.map((s) => s.avatar ?? DEFAULT_AVATAR),
})
```

Add imports in `gameServer.ts`: `PLAYER_COLORS` from `'../../src/data/players'`, `DEFAULT_AVATAR`, `isValidAvatar`, `PRESET_AVATARS` (if referenced) from `'../../src/data/avatars'`.

- [ ] **Step 6: Route the new message in `server/http.ts`**

Update the `Create`/`Join` handlers to forward identity:

```ts
if (msg.type === ClientMessageType.Create) {
  const { code, game } = roomManager.create()
  if (game.join(clientId, msg.name, { color: msg.color, avatar: msg.avatar })) roomManager.addClient(code, clientId)
} else if (msg.type === ClientMessageType.Join) {
  ...
  if (game.join(clientId, msg.name, { color: msg.color, avatar: msg.avatar })) roomManager.addClient(msg.code, clientId)
}
```

Add a `SetIdentity` branch:

```ts
} else if (msg.type === ClientMessageType.SetIdentity) {
  roomManager.gameFor(clientId)?.setIdentity(clientId, { color: msg.color, avatar: msg.avatar })
}
```

- [ ] **Step 7: Run server tests**

Run: `npx vitest run server/__tests__/gameServer.test.ts server/__tests__/roomManager.test.ts server/__tests__/http.test.ts`
Expected: PASS (adjust the reconnect test to match the real flow if needed).

- [ ] **Step 8: Typecheck + full unit suite**

Run: `npm run typecheck` and `npx vitest run`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add server/gameServer.ts server/http.ts src/types/net.ts server/__tests__
git commit -m "feat: server-side player identity (join, setIdentity, bots, start)"
```

---

### Task 4: Client API and identity persistence

**Files:**
- Modify: `src/i18n/constants.ts` (add `StorageKey.PlayerIdentity`)
- Create: `src/net/identity.ts`
- Modify: `src/hooks/useNetworkGame.ts`
- Modify: `src/components/MultiplayerGame.tsx`
- Modify: `src/net/__tests__/client.test.ts` (add `SetIdentity` send test — verify file)
- Test: `src/net/__tests__/identity.test.ts`

**Interfaces:**
- Consumes: `PlayerAvatar`, `AvatarKind` (Task 1); `ClientMessageType.SetIdentity`, `Create`/`Join` payloads (Task 3); `useNetworkGame` message plumbing.
- Produces:
  - `src/net/identity.ts`:
    - `export interface PlayerIdentity { color: string; avatar: PlayerAvatar }`
    - `loadIdentity(): PlayerIdentity | null`
    - `saveIdentity(identity: PlayerIdentity): void`
    - `clearIdentity(): void`
  - `useNetworkGame.create(name: string, identity?: PlayerIdentity): void`
  - `useNetworkGame.join(code: string, name: string, identity?: PlayerIdentity): void`
  - `useNetworkGame.setIdentity(patch: { color?: string; avatar?: PlayerAvatar }): void`
  - `MultiplayerGame` passes `loadIdentity()` into `create`/`join`.

- [ ] **Step 1: Write the failing unit test `src/net/__tests__/identity.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { loadIdentity, saveIdentity, clearIdentity } from '../identity'
import { DEFAULT_AVATAR } from '../../data/avatars'
import { PLAYER_COLORS } from '../../data/players'

describe('identity persistence', () => {
  beforeEach(() => localStorage.clear())

  it('round-trips a saved identity', () => {
    const identity = { color: PLAYER_COLORS[3], avatar: DEFAULT_AVATAR }
    expect(loadIdentity()).toBeNull()
    saveIdentity(identity)
    expect(loadIdentity()).toEqual(identity)
  })

  it('clears the saved identity', () => {
    saveIdentity({ color: PLAYER_COLORS[0], avatar: DEFAULT_AVATAR })
    clearIdentity()
    expect(loadIdentity()).toBeNull()
  })

  it('returns null for corrupt JSON', () => {
    localStorage.setItem('monopoly-player-identity', 'not json')
    expect(loadIdentity()).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/net/__tests__/identity.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Add the storage key in `src/i18n/constants.ts`**

```ts
PlayerIdentity: 'monopoly-player-identity',
```

- [ ] **Step 4: Create `src/net/identity.ts`**

```ts
import type { PlayerAvatar } from '../types/game'
import { StorageKey } from '../i18n/constants'

export interface PlayerIdentity {
  color: string
  avatar: PlayerAvatar
}

export function loadIdentity(): PlayerIdentity | null {
  try {
    const raw = localStorage.getItem(StorageKey.PlayerIdentity)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PlayerIdentity
    if (!parsed || typeof parsed.color !== 'string' || !parsed.avatar) return null
    return { color: parsed.color, avatar: parsed.avatar }
  } catch {
    return null
  }
}

export function saveIdentity(identity: PlayerIdentity): void {
  localStorage.setItem(StorageKey.PlayerIdentity, JSON.stringify(identity))
}

export function clearIdentity(): void {
  localStorage.removeItem(StorageKey.PlayerIdentity)
}
```

- [ ] **Step 5: Update `src/hooks/useNetworkGame.ts`**

Import `type PlayerIdentity` from `'../net/identity'`. Change the API surface:

```ts
export type NetworkGameApi = GameApi & {
  ...
  create: (name: string, identity?: PlayerIdentity) => void
  join: (code: string, name: string, identity?: PlayerIdentity) => void
  setIdentity: (patch: { color?: string; avatar?: PlayerAvatar }) => void
  ...
}
```

Implementations:

```ts
const create = useCallback(
  (name: string, identity?: PlayerIdentity) =>
    send({ type: ClientMessageType.Create, name, color: identity?.color, avatar: identity?.avatar }),
  [send],
)
const join = useCallback(
  (code: string, name: string, identity?: PlayerIdentity) =>
    send({ type: ClientMessageType.Join, code, name, color: identity?.color, avatar: identity?.avatar }),
  [send],
)
const setIdentity = useCallback(
  (patch: { color?: string; avatar?: PlayerAvatar }) => send({ type: ClientMessageType.SetIdentity, ...patch }),
  [send],
)
```

Add `setIdentity` to the returned object and to `NetworkGameApi` type.

- [ ] **Step 6: Update `src/components/MultiplayerGame.tsx`**

```ts
import { loadIdentity } from '../net/identity'
...
const identity = loadIdentity()
...
useEffect(() => {
  if (code === null) create(name, identity ?? undefined)
  else join(code, name, identity ?? undefined)
}, [code, name, create, join, identity])
```

Note: `loadIdentity()` returns a fresh object each call, so either compute it once outside the effect (as above, module-const-style inside the component render) or use a `useMemo`. The dependency array includes `identity`.

- [ ] **Step 7: Add a `SetIdentity` send test to `src/net/__tests__/client.test.ts`**

Verify the file's existing pattern first, then append a test that constructs `new GameClient(handlers, { WebSocketImpl: FakeWS })`, connects, sends `{ type: 'setIdentity', color: '#fff' }`, and asserts the fake received the serialized message. If the file uses a different harness, mirror it.

- [ ] **Step 8: Run unit tests + typecheck**

Run: `npx vitest run src/net` and `npm run typecheck`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/i18n/constants.ts src/net/identity.ts src/net/__tests__/identity.test.ts \
  src/hooks/useNetworkGame.ts src/components/MultiplayerGame.tsx src/net/__tests__/client.test.ts
git commit -m "feat: client identity API and persistence (create/join/setIdentity)"
```

---

### Task 5: Avatar component, lobby identity picker, and i18n

**Files:**
- Create: `src/components/Avatar.tsx`
- Modify: `src/components/Lobby.tsx`
- Modify: `src/i18n/locales/en/translation.json`
- Modify: `src/i18n/locales/id/translation.json`
- Test: `src/components/__tests__/Avatar.test.tsx`
- Test: `src/components/__tests__/Lobby.test.tsx` (new)

**Interfaces:**
- Consumes: `PRESET_AVATARS`, `PRESET_EMOJI`, `AvatarKind`, `PlayerAvatar`; `NetworkGameApi.setIdentity`; `LobbyPlayer.color/avatar`; `PLAYER_COLORS`; `saveIdentity`/`loadIdentity` (Task 4).
- Produces:
  - `src/components/Avatar.tsx`: `export default function Avatar({ avatar, className, title }: { avatar: PlayerAvatar; className?: string; title?: string })` — renders the preset emoji (`PRESET_EMOJI[avatar.id]`) or a custom `<img src={avatar.dataUrl}>`.
  - Lobby identity panel markup with `data-testid` hooks: `color-swatch`, `avatar-option`, `avatar-upload`.

- [ ] **Step 1: Write the failing component test `src/components/__tests__/Avatar.test.tsx`**

```tsx
// @vitest-environment jsdom
import { screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, it, expect } from 'vitest'
import Avatar from '../Avatar'
import { renderWithProviders } from '../../test/test-utils'
import { AvatarKind } from '../../types/game'
import { PRESET_AVATARS } from '../../data/avatars'

afterEach(cleanup)

describe('Avatar', () => {
  it('renders the preset emoji', () => {
    renderWithProviders(<Avatar avatar={{ kind: AvatarKind.Preset, id: PRESET_AVATARS.Cat }} />)
    expect(screen.getByText('🐱')).toBeTruthy()
  })

  it('renders a custom image from its data URL', () => {
    const dataUrl = 'data:image/png;base64,abc'
    renderWithProviders(<Avatar avatar={{ kind: AvatarKind.Custom, dataUrl }} />)
    const img = screen.getByRole('img') as HTMLImageElement
    expect(img.src).toBe(dataUrl)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/__tests__/Avatar.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/components/Avatar.tsx`**

```tsx
import { AvatarKind, type PlayerAvatar } from '../types/game'
import { PRESET_EMOJI } from '../data/avatars'

interface Props {
  avatar: PlayerAvatar
  className?: string
  title?: string
}

export default function Avatar({ avatar, className, title }: Props) {
  if (avatar.kind === AvatarKind.Custom) {
    return <img className={className} src={avatar.dataUrl} alt={title ?? ''} title={title} />
  }
  return (
    <span className={className} title={title} aria-label={title}>
      {PRESET_EMOJI[avatar.id] ?? '❓'}
    </span>
  )
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/components/__tests__/Avatar.test.tsx`
Expected: PASS.

- [ ] **Step 5: Add i18n keys**

Add to `src/i18n/locales/en/translation.json`:

```json
"lobby.yourLook": "Your look",
"lobby.pieceColor": "Piece color",
"lobby.avatar": "Avatar",
"lobby.uploadAvatar": "Upload photo",
"lobby.usePreset": "Use preset",
"lobby.colorTaken": "In use"
```

Add to `src/i18n/locales/id/translation.json`:

```json
"lobby.yourLook": "Penampilanmu",
"lobby.pieceColor": "Warna bidak",
"lobby.avatar": "Avatar",
"lobby.uploadAvatar": "Unggah foto",
"lobby.usePreset": "Gunakan preset",
"lobby.colorTaken": "Dipakai"
```

- [ ] **Step 6: Write the failing lobby identity test `src/components/__tests__/Lobby.test.tsx`**

```tsx
// @vitest-environment jsdom
import { screen, cleanup, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, it, expect, vi } from 'vitest'
import Lobby from '../Lobby'
import { renderWithProviders } from '../../test/test-utils'
import { PLAYER_COLORS } from '../../data/players'
import { PRESET_AVATARS } from '../../data/avatars'
import { AvatarKind } from '../../types/game'
import type { NetworkGameApi } from '../../hooks/useNetworkGame'

function makeGame(overrides: Partial<NetworkGameApi> = {}): NetworkGameApi {
  return {
    state: { /* minimal GameState */ } as never,
    myPlayerId: 0,
    playerId: 0,
    hostPlayerId: 0,
    code: 'ABCDE',
    lobby: [
      { id: 0, name: 'Alice', connected: true, isBot: false, color: PLAYER_COLORS[0], avatar: { kind: AvatarKind.Preset, id: PRESET_AVATARS.Cat } },
    ],
    status: 'connected' as never,
    error: null,
    create: vi.fn(), join: vi.fn(), leave: vi.fn(), start: vi.fn(), addBot: vi.fn(), removeBot: vi.fn(),
    setIdentity: vi.fn(),
    roll: vi.fn(), buyProperty: vi.fn(), declineBuy: vi.fn(), payRent: vi.fn(), buildHouse: vi.fn(),
    sellHouse: vi.fn(), mortgage: vi.fn(), unmortgage: vi.fn(), sellProperty: vi.fn(), proposeTrade: vi.fn(),
    acceptTrade: vi.fn(), rejectTrade: vi.fn(), cancelTrade: vi.fn(), drawCard: vi.fn(), resolveCard: vi.fn(),
    endTurn: vi.fn(), declareBankruptcy: vi.fn(), skipAction: vi.fn(), payJailFine: vi.fn(),
    useGetOutOfJailFree: vi.fn(), resetGame: vi.fn(),
    ...overrides,
  } as unknown as NetworkGameApi
}

afterEach(cleanup)

describe('Lobby identity panel', () => {
  it('sends setIdentity when the player picks a color', () => {
    const setIdentity = vi.fn()
    renderWithProviders(<Lobby game={makeGame({ setIdentity })} />)
    const swatches = screen.getAllByTestId('color-swatch')
    fireEvent.click(swatches[2])
    expect(setIdentity).toHaveBeenCalledWith({ color: PLAYER_COLORS[2] })
  })

  it('sends setIdentity when the player picks a preset avatar', () => {
    const setIdentity = vi.fn()
    renderWithProviders(<Lobby game={makeGame({ setIdentity })} />)
    const options = screen.getAllByTestId('avatar-option')
    fireEvent.click(options[3]) // PRESET_AVATARS[3] === alien
    expect(setIdentity).toHaveBeenCalledWith({ avatar: { kind: AvatarKind.Preset, id: PRESET_AVATARS.Alien } })
  })

  it('marks taken colors as unavailable', () => {
    const game = makeGame({
      lobby: [
        { id: 0, name: 'Alice', connected: true, isBot: false, color: PLAYER_COLORS[0], avatar: { kind: AvatarKind.Preset, id: PRESET_AVATARS.Cat } },
        { id: 1, name: 'Bob', connected: true, isBot: false, color: PLAYER_COLORS[1], avatar: { kind: AvatarKind.Preset, id: PRESET_AVATARS.Dog } },
      ],
    })
    renderWithProviders(<Lobby game={game} />)
    expect(screen.getAllByTestId('color-swatch')[1].getAttribute('aria-disabled')).toBe('true')
  })
})
```

- [ ] **Step 7: Run to verify it fails**

Run: `npx vitest run src/components/__tests__/Lobby.test.tsx`
Expected: FAIL — no `color-swatch` elements.

- [ ] **Step 8: Implement the lobby identity panel in `src/components/Lobby.tsx`**

- Replace the row color dot `PLAYER_COLORS[i]` with `p.color` and add the avatar:
  ```tsx
  <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: p?.color ?? PLAYER_COLORS[i] }} />
  {p && <Avatar avatar={p.avatar} className="w-4 h-4 rounded-full object-cover inline-block" />}
  ```
- Add imports: `Avatar`, `AvatarKind`, `PRESET_AVATARS`, `PRESET_EMOJI`, `DEFAULT_AVATAR`, `PLAYER_COLORS`, `saveIdentity`, `loadIdentity`, `CUSTOM_AVATAR_MAX_DIMENSION`.
- Render the picker for your own seat only (`playerId != null`). `const mySlot = lobby[playerId]`.

Color picker:

```tsx
<div data-testid="color-picker" className="flex gap-1.5 flex-wrap">
  {PLAYER_COLORS.map((c) => {
    const taken = lobby.some((p) => p.id !== playerId && p.name !== null && p.color === c)
    const selected = mySlot?.color === c
    return (
      <button
        key={c}
        type="button"
        data-testid="color-swatch"
        aria-label={`${t('lobby.pieceColor')} ${c}`}
        aria-disabled={taken}
        disabled={taken}
        onClick={() => pickColor(c)}
        className={[
          'w-7 h-7 rounded-full border-2 border-transparent transition',
          selected ? 'ring-2 ring-gold border-white' : '',
          taken ? 'opacity-30 cursor-not-allowed' : '',
        ].join(' ')}
        style={{ backgroundColor: c }}
      />
    )
  })}
</div>
```

```ts
function pickColor(color: string) {
  setIdentity({ color })
  const cur = loadIdentity()
  saveIdentity({ color, avatar: cur?.avatar ?? mySlot?.avatar ?? DEFAULT_AVATAR })
}
```

Avatar picker:

```tsx
<div data-testid="avatar-picker" className="flex gap-1.5 flex-wrap">
  {(Object.keys(PRESET_AVATARS) as PresetAvatarId[]).map((id) => (
    <button
      key={id}
      type="button"
      data-testid="avatar-option"
      aria-label={`${t('lobby.avatar')} ${id}`}
      onClick={() => pickPreset(id)}
      className={[
        'w-8 h-8 rounded-lg text-lg flex items-center justify-center border',
        mySlot?.avatar.kind === AvatarKind.Preset && mySlot.avatar.id === id ? 'ring-2 ring-gold border-white' : 'border-border',
      ].join(' ')}
    >
      {PRESET_EMOJI[id]}
    </button>
  ))}
</div>
```

```ts
function pickPreset(id: PresetAvatarId) {
  const avatar = { kind: AvatarKind.Preset, id }
  setIdentity({ avatar })
  saveIdentity({ color: mySlot?.color ?? PLAYER_COLORS[playerId!], avatar })
}
```

Upload (custom avatar):

```tsx
<label data-testid="avatar-upload" className="cursor-pointer text-sm">
  {t('lobby.uploadAvatar')}
  <input
    type="file"
    accept="image/*"
    className="hidden"
    onChange={(e) => {
      const file = e.target.files?.[0]
      if (file) void uploadCustom(file)
    }}
  />
</label>
{mySlot?.avatar.kind === AvatarKind.Custom && (
  <button type="button" data-testid="avatar-remove-custom" onClick={() => pickPreset(PRESET_AVATARS.Cat)}>
    {t('lobby.usePreset')}
  </button>
)}
```

```ts
async function uploadCustom(file: File) {
  try {
    const dataUrl = await downscaleImage(file)
    const avatar = { kind: AvatarKind.Custom, dataUrl }
    setIdentity({ avatar })
    saveIdentity({ color: mySlot?.color ?? PLAYER_COLORS[playerId!], avatar })
  } catch {
    // ignore unreadable/invalid images
  }
}

function downscaleImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('read failed'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('decode failed'))
      img.onload = () => {
        const scale = Math.min(1, CUSTOM_AVATAR_MAX_DIMENSION / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(img.width * scale))
        canvas.height = Math.max(1, Math.round(img.height * scale))
        const ctx = canvas.getContext('2d')
        if (!ctx) { reject(new Error('no canvas')); return }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}
```

Guard the length server-side is automatic (`isValidAvatar`), and optionally re-check client-side with `isCustomAvatar`.

- [ ] **Step 9: Run the lobby test to verify it passes**

Run: `npx vitest run src/components/__tests__/Lobby.test.tsx src/components/__tests__/Avatar.test.tsx`
Expected: PASS.

- [ ] **Step 10: i18n parity check + typecheck + full suite**

Run: `node -e "const en=require('./src/i18n/locales/en/translation.json'), id=require('./src/i18n/locales/id/translation.json'); const ek=Object.keys(en), ik=Object.keys(id); const miss=ek.filter(k=>!ik.includes(k)).concat(ik.filter(k=>!ek.includes(k))); if(miss.length){console.error('i18n mismatch:', miss); process.exit(1)} console.log('i18n parity OK')"`
Expected: prints `i18n parity OK`.
Run: `npm run typecheck` and `npx vitest run`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add src/components/Avatar.tsx src/components/Lobby.tsx src/components/__tests__/Avatar.test.tsx src/components/__tests__/Lobby.test.tsx src/i18n/locales
git commit -m "feat: lobby identity picker (color, preset avatar, custom upload)"
```

---

### Task 6: Render identity in game UI

**Files:**
- Modify: `src/components/PlayerTokens.tsx` (drop `playerColors` prop; use `player.color`/`player.avatar`)
- Modify: `src/components/BoardGrid.tsx` (drop `playerColors` prop; use `state.players[owner.id].color`)
- Modify: `src/components/GameBoard.tsx` (stop passing `PLAYER_COLORS`)
- Modify: `src/components/PlayerPanel.tsx` (drop `playerColors` prop)
- Modify: `src/components/PlayerCard.tsx` (drop `color` prop; use `player.color`; show avatar)
- Modify: `src/components/Sidebar.tsx` (stop passing `playerColors`/`PLAYER_COLORS`)
- Modify: `src/components/__tests__/PlayerPanel.test.tsx`, `src/components/__tests__/BoardGrid.test.tsx`, `src/components/__tests__/PlayerCard.test.tsx`

**Interfaces:**
- Consumes: `Player.color`, `Player.avatar`, `Avatar` component (Task 5), `avatarEmoji` (Task 1).
- Produces: no new public API — internal rendering changes only.

- [ ] **Step 1: Update `PlayerTokens.tsx`**

- Remove `playerColors` from `Props` and the destructure.
- Render:
  ```tsx
  style={{ backgroundColor: player.color, ... }}
  ```
  and replace the inner `{player.id + 1}` with an `Avatar`:
  ```tsx
  <Avatar avatar={player.avatar} className="w-4 h-4 rounded-full" title={player.name} />
  ```
  Import `Avatar` from `'./Avatar'`.

- [ ] **Step 2: Update `BoardGrid.tsx`**

- Remove `playerColors` from `Props`, the destructure, and the `owner` stripe at line ~226:
  ```tsx
  style={{ backgroundColor: state.players[owner.id]?.color ?? '#000' }}
  ```
  (BoardGrid already receives `state`; `owner` is `Space['owner']`.)

- [ ] **Step 3: Update `GameBoard.tsx`**

- Remove the `PLAYER_COLORS` import and the `playerColors={PLAYER_COLORS}` props passed to `BoardGrid` and `PlayerTokens`.

- [ ] **Step 4: Update `PlayerPanel.tsx`**

- Remove `playerColors` from `Props` and the destructure; pass `color` to `PlayerCard` as `player.color` is read inside — instead drop the `color` prop entirely from `PlayerCard` (Step 5). `PlayerPanel` then no longer passes `color`/`playerColors`.

- [ ] **Step 5: Update `PlayerCard.tsx`**

- Remove `color` from `PlayerCardProps` and the destructure.
- Replace `style={{ borderLeft: \`3px solid ${color}\` }}` with `` `3px solid ${player.color}` `` and the dot `style={{ backgroundColor: color }}` with `player.color`.
- Add the avatar next to the name:
  ```tsx
  <Avatar avatar={player.avatar} className="w-4 h-4 rounded-full object-cover flex-shrink-0" title={player.name} />
  ```
  Import `Avatar` from `'./Avatar'`.
- `PlayerPopup` keeps its own `color` prop (passed from `PlayerCard` as `player.color`) — or read `player.color` directly inside; simplest is to keep the prop and pass `color={player.color}`.

- [ ] **Step 6: Update `Sidebar.tsx`**

- Remove `PLAYER_COLORS` import and the `playerColors={PLAYER_COLORS}` prop on `<PlayerPanel>`.

- [ ] **Step 7: Update the affected component tests**

- `src/components/__tests__/PlayerPanel.test.tsx`: remove the `playerColors={COLORS}` prop from every `<PlayerPanel>` render and delete the `COLORS` const.
- `src/components/__tests__/BoardGrid.test.tsx`: remove the `playerColors={['#000', '#fff']}` prop; the test state's players must carry `color` (add `color: '#000'` / `'#fff'` and `avatar` to its `Player` constructions, or build via `gameReducer(...StartGame...)`).
- `src/components/__tests__/PlayerCard.test.tsx`: remove `color="#E74C3C"` from every render (the `player` const already gained `color`/`avatar` in Task 2).

- [ ] **Step 8: Run the full unit suite + typecheck**

Run: `npx vitest run` and `npm run typecheck`
Expected: PASS.

- [ ] **Step 9: Manual sanity (optional, dev server)**

Run `npm run dev`, create a room with 2+ players, start a game, confirm tokens/player cards show the chosen colors and avatars.

- [ ] **Step 10: Commit**

```bash
git add src/components/GameBoard.tsx src/components/BoardGrid.tsx src/components/PlayerTokens.tsx \
  src/components/PlayerPanel.tsx src/components/PlayerCard.tsx src/components/Sidebar.tsx \
  src/components/__tests__
git commit -m "feat: render player color and avatar on board tokens and player cards"
```

---

### Task 7: Seed validation and e2e coverage

**Files:**
- Modify: `src/logic/seed.ts` (`validateStateStructure`)
- Modify: `src/logic/__tests__/seed.test.ts`
- Modify: `server/__tests__/http.test.ts` (seed path uses `validateStateStructure` — verify existing tests still pass)
- Test: `e2e/player-identity.spec.ts` (new)

**Interfaces:**
- Consumes: `isValidAvatar` (Task 1), `PLAYER_COLORS` (existing).
- Produces:
  - `validateStateStructure` returns an error when any player's `color` is not in `PLAYER_COLORS` or `avatar` is invalid.

- [ ] **Step 1: Write the failing validation tests (append to `src/logic/__tests__/seed.test.ts`)**

```ts
import { isValidAvatar } from '../../data/avatars'
import { PLAYER_COLORS } from '../../data/players'

it('rejects a player with a color outside the palette', () => {
  const s = createSeededState({ players: [{ id: 0, name: 'A', money: 100 }], currentPlayer: 0 })
  const bad = { ...s, players: [{ ...s.players[0], color: '#123456' }] }
  expect(validateStateStructure(bad).kind).toBe(ValidationKind.Error)
})

it('rejects a player with an invalid avatar', () => {
  const s = createSeededState({ players: [{ id: 0, name: 'A', money: 100 }], currentPlayer: 0 })
  const bad = { ...s, players: [{ ...s.players[0], avatar: { kind: 'custom' as never, dataUrl: 'nope' } }] }
  expect(validateStateStructure(bad).kind).toBe(ValidationKind.Error)
})

it('accepts default seeded players', () => {
  const s = createSeededState({ players: [{ id: 0, name: 'A', money: 100 }], currentPlayer: 0 })
  expect(validateStateStructure(s).kind).toBe(ValidationKind.Ok)
})
```

Check the file's existing imports: it already imports `createSeededState`, `validateStateStructure`, `ValidationKind`. Add the avatar/players imports.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/logic/__tests__/seed.test.ts`
Expected: FAIL — the two rejection cases pass through `validateStateStructure` unchanged (returns `Ok`).

- [ ] **Step 3: Implement validation in `src/logic/seed.ts`**

Add a `for (const player of state.players)` check inside `validateStateStructure` (alongside the existing money/position checks):

```ts
if (!PLAYER_COLORS.includes(player.color)) {
  return { kind: ValidationKind.Error, message: `player ${player.id} (${player.name}) has an invalid color` };
}
if (!isValidAvatar(player.avatar)) {
  return { kind: ValidationKind.Error, message: `player ${player.id} (${player.name}) has an invalid avatar` };
}
```

Add imports `PLAYER_COLORS` from `'../data/players'` and `isValidAvatar` from `'../data/avatars'`.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/logic/__tests__/seed.test.ts server/__tests__/http.test.ts server/__tests__/gameServer.test.ts`
Expected: PASS.

- [ ] **Step 5: Add an e2e spec `e2e/player-identity.spec.ts`**

Use the existing e2e harness (see `e2e/multiplayer.spec.ts` and `e2e/fixtures.ts` `serverUrl`). The spec:

1. Sets `localStorage` `monopoly-language`=`en`, `monopoly-currency`=`USD`.
2. Opens the app, types a name, creates a room (host).
3. Asserts the host's lobby row shows a color swatch (existing `PLAYER_COLORS` dot) and that the identity panel appears.
4. Clicks a `color-swatch`, then an `avatar-option`, and asserts no client error (`setIdentity` round-trip succeeds — the room stays on the lobby).
5. Opens a second browser context, joins with the room code, and asserts both players' rows render the host's chosen color/avatar (identity is shared cross-device).
6. Starts the game and asserts the board token and player card reflect the chosen color.

Keep assertions aligned with the existing `data-testid`s. If the multiplayer spec patterns require the `dist/` build, follow them (the `serverUrl` fixture auto-starts the server; run `npm run build` first).

- [ ] **Step 6: Run unit suite + typecheck**

Run: `npx vitest run` and `npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Run the e2e spec**

Run: `npm run build && npx playwright test e2e/player-identity.spec.ts`
Expected: PASS (or iterate on selectors to match the rendered UI).

- [ ] **Step 8: Commit**

```bash
git add src/logic/seed.ts src/logic/__tests__/seed.test.ts e2e/player-identity.spec.ts
git commit -m "feat: validate player identity in seeds and cover cross-device identity in e2e"
```

---

## Self-Review Notes

- **Spec coverage:** Section 1 (types, avatars.ts, server slot) → Tasks 1–3. Section 2 (wire contract, client, persistence) → Tasks 3–4. Section 3 (lobby UI) → Task 5. Section 4 (tokens, cards, bots) → Tasks 3 (bots/start) + 6. Section 5 (seeds, validation, tests, i18n) → Tasks 2 (seed defaults, fixtures, e2e helper), 5 (i18n), 7 (validation + e2e).
- **Type consistency:** `PlayerAvatar`, `AvatarKind`, `PRESET_AVATARS`/`PresetAvatarId`, `DEFAULT_AVATAR` are defined in Task 1 and used by name everywhere after. `PlayerIdentity` (Task 4) is used by `useNetworkGame` and `MultiplayerGame`. `setIdentity` signature is identical in `useNetworkGame` (Task 4) and `GameServer` (Task 3) except for the playerId resolution.
- **Placeholders:** Every code step contains concrete content. The reconnect test in Task 3 and the e2e spec in Task 7 explicitly call out that selectors/flow may need minor adaptation to existing harness conventions.
