# Custom player colors & unique avatars — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let players pick any custom hex color (not just 6 presets) and guarantee no two players share an avatar.

**Architecture:** Extend the existing identity model. Server stays authoritative: `join`/`setIdentity` accept + validate custom hex colors and reject duplicate colors/avatars; the lobby UI adds a native color input and disables taken preset avatars.

**Tech Stack:** TypeScript, React 19, Vite, Vitest, existing `PLAYER_COLORS`/`avatars.ts` conventions (const objects + derived unions, no TS enums, `verbatimModuleSyntax`).

## Global Constraints

- No TS enums; `erasableSyntaxOnly: true`. Use `const` + derived unions (repo convention).
- `verbatimModuleSyntax: true` — type-only imports use `import type`.
- `noUnusedLocals`/`noUnusedParameters` are on.
- Server-side error strings are hardcoded Indonesian; UI strings go through i18n (both `en` and `id`).
- Wire values are part of the client/server contract and must not change.
- Run `npm run typecheck`, `npm run lint`, `npm run test:unit` (and the relevant server unit tests) green before commit.
- Semicolons: match `src/data/*` and `server/*` (semicolons), components/hooks (no semicolons). Match the file edited.

---

### Task 1: Color validation utilities

**Files:**
- Modify: `src/data/players.ts`
- Test: `src/data/__tests__/players.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `isValidColor(value: unknown): value is string`, `normalizeColor(value: string): string` (exported from `src/data/players.ts`).

- [ ] **Step 1: Write the failing test**

```typescript
import { isValidColor, normalizeColor, PLAYER_COLORS } from '../players'

describe('color validation', () => {
  it('accepts hex colors in 3/6/8 digit forms (case-insensitive)', () => {
    expect(isValidColor('#abc')).toBe(true)
    expect(isValidColor('#ABCDEF')).toBe(true)
    expect(isValidColor('#a1b2c3d4')).toBe(true)
  })
  it('rejects non-hex and non-strings', () => {
    expect(isValidColor('not-a-color')).toBe(false)
    expect(isValidColor('#gggggg')).toBe(false)
    expect(isValidColor(123)).toBe(false)
    expect(isValidColor(null)).toBe(false)
  })
  it('normalizes to lowercase and expands short forms', () => {
    expect(normalizeColor('#ABC')).toBe('#aabbcc')
    expect(normalizeColor('#ABCDEF')).toBe('#abcdef')
    expect(normalizeColor('#A1B2C3D4')).toBe('#a1b2c3d4')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/data/__tests__/players.test.ts`
Expected: FAIL (`isValidColor`/`normalizeColor` not defined).

- [ ] **Step 3: Write minimal implementation**

Append to `src/data/players.ts` (match semicolons style of that file):

```typescript
const HEX_COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export function isValidColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR_RE.test(value);
}

export function normalizeColor(value: string): string {
  const hex = value.toLowerCase();
  if (hex.length === 4) {
    return '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
  }
  if (hex.length === 9) {
    return '#' + hex[1] + hex[2] + hex[3] + hex[4] + hex[5] + hex[6] + hex[7] + hex[8];
  }
  return hex;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/data/__tests__/players.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/players.ts src/data/__tests__/players.test.ts
git commit -m "feat: add hex color validation/normalization helpers"
```

---

### Task 2: Avatar equality helper

**Files:**
- Modify: `src/data/avatars.ts`
- Test: `src/data/__tests__/avatars.test.ts`

**Interfaces:**
- Consumes: `PlayerAvatar`, `AvatarKind` from `src/types/game`.
- Produces: `isSameAvatar(a: PlayerAvatar, b: PlayerAvatar): boolean`.

- [ ] **Step 1: Write the failing test**

```typescript
import { isSameAvatar, AvatarKind } from '../avatars'
import type { PlayerAvatar } from '../../types/game'

describe('isSameAvatar', () => {
  const cat: PlayerAvatar = { kind: AvatarKind.Preset, id: 'cat' }
  const dog: PlayerAvatar = { kind: AvatarKind.Preset, id: 'dog' }
  const customA: PlayerAvatar = { kind: AvatarKind.Custom, dataUrl: 'data:image/png;base64,AAA' }
  const customB: PlayerAvatar = { kind: AvatarKind.Custom, dataUrl: 'data:image/png;base64,AAA' }
  const customC: PlayerAvatar = { kind: AvatarKind.Custom, dataUrl: 'data:image/png;base64,BBB' }

  it('treats presets with the same id as equal', () => {
    expect(isSameAvatar(cat, { kind: AvatarKind.Preset, id: 'cat' })).toBe(true)
    expect(isSameAvatar(cat, dog)).toBe(false)
  })
  it('treats customs with the same dataUrl as equal', () => {
    expect(isSameAvatar(customA, customB)).toBe(true)
    expect(isSameAvatar(customA, customC)).toBe(false)
  })
  it('never treats a preset as equal to a custom', () => {
    expect(isSameAvatar(cat, customA)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/data/__tests__/avatars.test.ts`
Expected: FAIL (`isSameAvatar` not defined).

- [ ] **Step 3: Write minimal implementation**

Append to `src/data/avatars.ts` (semicolons style):

```typescript
export function isSameAvatar(a: PlayerAvatar, b: PlayerAvatar): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === AvatarKind.Preset && b.kind === AvatarKind.Preset) {
    return a.id === b.id;
  }
  if (a.kind === AvatarKind.Custom && b.kind === AvatarKind.Custom) {
    return a.dataUrl === b.dataUrl;
  }
  return false;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/data/__tests__/avatars.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/avatars.ts src/data/__tests__/avatars.test.ts
git commit -m "feat: add avatar equality helper for uniqueness checks"
```

---

### Task 3: Server-side custom color + avatar uniqueness

**Files:**
- Modify: `server/gameServer.ts`
- Test: `server/__tests__/gameServer.test.ts`

**Interfaces:**
- Consumes: `isValidColor`, `normalizeColor` from `../src/data/players`; `isSameAvatar` from `../src/data/avatars`; `PLAYER_COLORS`, `DEFAULT_AVATAR`, `PRESET_AVATARS` already imported there.
- Produces: updated `join`, `setIdentity`, `addBot` behavior; helper `isAvatarTaken(avatar, exceptIndex)`.

- [ ] **Step 1: Write failing tests**

Add/update in `server/__tests__/gameServer.test.ts`. Replace the existing
test named `rejects setIdentity with a non-palette color and leaves the slot color unchanged`
with a positive custom-color test, and add uniqueness tests:

```typescript
import { isValidColor, normalizeColor } from '../../src/data/players'
import { isSameAvatar } from '../../src/data/avatars'

it('accepts a valid custom hex color via setIdentity', () => {
  server.join('c0', 'Alice', { color: PLAYER_COLORS[0] })
  server.setIdentity('c0', { color: '#123abc' })
  expect(server.getPlayers()[0].color).toBe('#123abc')
})

it('rejects an invalid custom color via setIdentity', () => {
  server.join('c0', 'Alice', { color: PLAYER_COLORS[0] })
  server.setIdentity('c0', { color: 'not-a-color' })
  expect(server.getPlayers()[0].color).toBe(PLAYER_COLORS[0])
})

it('rejects setIdentity onto a color another player holds (custom or preset)', () => {
  server.join('c0', 'Alice', { color: '#123abc' })
  server.join('c1', 'Bob', { color: PLAYER_COLORS[1] })
  server.setIdentity('c1', { color: '#123abc' })
  expect(server.getPlayers()[1].color).toBe(PLAYER_COLORS[1])
})

it('rejects setIdentity with a duplicate preset avatar', () => {
  server.join('c0', 'Alice', { avatar: { kind: AvatarKind.Preset, id: PRESET_AVATARS.Dog } })
  server.join('c1', 'Bob', { color: PLAYER_COLORS[1] })
  server.setIdentity('c1', { avatar: { kind: AvatarKind.Preset, id: PRESET_AVATARS.Dog } })
  expect(server.getPlayers()[1].avatar).toEqual(DEFAULT_AVATAR)
})

it('rejects setIdentity with a duplicate custom avatar dataUrl', () => {
  const dataUrl = 'data:image/png;base64,AAAA'
  server.join('c0', 'Alice', { avatar: { kind: AvatarKind.Custom, dataUrl } })
  server.join('c1', 'Bob', { color: PLAYER_COLORS[1] })
  server.setIdentity('c1', { avatar: { kind: AvatarKind.Custom, dataUrl } })
  expect(server.getPlayers()[1].avatar).toEqual(DEFAULT_AVATAR)
})

it('assigns a bot the first free preset avatar, not always the default', () => {
  server.join('c0', 'Alice', { avatar: { kind: AvatarKind.Preset, id: PRESET_AVATARS.Cat } })
  server.addBot('c0')
  const bot = server.getPlayers()[1]
  expect(bot.isBot).toBe(true)
  expect(bot.avatar).not.toEqual({ kind: AvatarKind.Preset, id: PRESET_AVATARS.Cat })
})
```

- [ ] **Step 2: Run tests to verify failures**

Run: `npm run test:unit -- server/__tests__/gameServer.test.ts`
Expected: the new/updated tests FAIL (custom color still rejected; no avatar uniqueness; bot always Cat).

- [ ] **Step 3: Implement**

In `server/gameServer.ts`:

1. Add a helper near `isColorFree`:

```typescript
private isColorTaken(color: string, exceptIndex: number): boolean {
  const norm = normalizeColor(color);
  return this.slots.some((s, i) => i !== exceptIndex && s.name !== null && s.color !== null && normalizeColor(s.color) === norm);
}

private isAvatarTaken(avatar: PlayerAvatar, exceptIndex: number): boolean {
  return this.slots.some((s, i) => i !== exceptIndex && s.name !== null && s.avatar !== null && isSameAvatar(s.avatar, avatar));
}
```

2. In `join()` line ~141, change the color assignment to accept custom valid colors:

```typescript
color: opts?.color !== undefined && isValidColor(opts.color) && !this.isColorTaken(opts.color, index) ? normalizeColor(opts.color) : this.nextFreeColor(),
```

(note: `index` is known at that point from the slot search; pass it.)

3. In `setIdentity()` (lines ~164-183), replace the color block:

```typescript
if (opts.color !== undefined) {
  if (!isValidColor(opts.color)) {
    this.events.send(clientId, { type: ServerMessageType.Error, message: 'Warna tidak valid' })
    return
  }
  if (this.isColorTaken(opts.color, index)) {
    this.events.send(clientId, { type: ServerMessageType.Error, message: 'Warna sudah dipakai' })
    return
  }
}
if (opts.avatar !== undefined) {
  if (!isValidAvatar(opts.avatar)) {
    this.events.send(clientId, { type: ServerMessageType.Error, message: 'Avatar tidak valid' })
    return
  }
  if (this.isAvatarTaken(opts.avatar, index)) {
    this.events.send(clientId, { type: ServerMessageType.Error, message: 'Avatar sudah dipakai' })
    return
  }
}
```

4. In `addBot()` line ~202, replace `avatar: DEFAULT_AVATAR` with the first free preset avatar. Add a helper:

```typescript
private nextFreePresetAvatar(): PlayerAvatar {
  const taken = new Set(
    this.slots.filter((s) => s.name !== null && s.avatar !== null && s.avatar.kind === AvatarKind.Preset).map((s) => (s.avatar as { kind: typeof AvatarKind.Preset; id: PresetAvatarId }).id),
  )
  const free = (Object.values(PRESET_AVATARS) as PresetAvatarId[]).find((id) => !taken.has(id))
  return free ? { kind: AvatarKind.Preset, id: free } : DEFAULT_AVATAR
}
```

and use `avatar: this.nextFreePresetAvatar()` in `addBot`. Ensure `AvatarKind`, `PresetAvatarId` are imported in `server/gameServer.ts`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- server/__tests__/gameServer.test.ts`
Expected: PASS (including previously passing color/avatar tests).

- [ ] **Step 5: Commit**

```bash
git add server/gameServer.ts server/__tests__/gameServer.test.ts
git commit -m "feat: accept custom hex colors and enforce avatar uniqueness server-side"
```

---

### Task 4: Lobby UI — custom color input + disable taken avatars

**Files:**
- Modify: `src/components/Lobby.tsx`
- Modify: `src/i18n/locales/en/translation.json`
- Modify: `src/i18n/locales/id/translation.json`

**Interfaces:**
- Consumes: `isValidColor`/`normalizeColor` (not strictly required client-side, but `pickColor` should send the raw value; server validates), `setIdentity`, `mySlot`, `lobby` from `game`. Reuses `AvatarKind`, `PRESET_AVATARS` already imported.

- [ ] **Step 1: Add i18n keys**

In both `en/translation.json` and `id/translation.json`, add inside `lobby`:

en: `"customColor": "Custom color"`
id: `"customColor": "Warna kustom"`

- [ ] **Step 2: Update Lobby.tsx**

1. Add a custom color input in the identity panel, after the swatch grid
   (after line ~141, before the avatar picker). It should default to the
   player's current color and call `pickColor` on change:

```tsx
<label className="flex items-center gap-2 justify-center text-xs text-muted">
  {t('lobby.customColor')}
  <input
    type="color"
    data-testid="color-custom"
    value={mySlot?.color ?? PLAYER_COLORS[playerId ?? 0]}
    onChange={(e) => pickColor(e.target.value)}
    className="w-8 h-8 rounded cursor-pointer bg-transparent border border-border"
  />
</label>
```

2. Compute taken preset avatars and disable them, mirroring taken colors.
   In the `PRESET_AVATARS` map (around line ~144), compute:

```tsx
const takenAvatar = (id: PresetAvatarId) =>
  lobby.some((p) => p.id !== playerId && p.name !== null && p.avatar?.kind === AvatarKind.Preset && p.avatar.id === id)
```

   and on the button add `disabled={takenAvatar(id)} aria-disabled={takenAvatar(id)}` and the existing `taken ?` class pattern (reuse `opacity-30 cursor-not-allowed`).

- [ ] **Step 3: Run lint/typecheck**

Run: `npm run typecheck && npm run lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/Lobby.tsx src/i18n/locales/en/translation.json src/i18n/locales/id/translation.json
git commit -m "feat: lobby custom color input and disable taken preset avatars"
```

---

### Task 5: Lobby component tests for new behavior

**Files:**
- Modify: `src/components/__tests__/Lobby.test.tsx`

**Interfaces:**
- Consumes: `setIdentity` mock, `PLAYER_COLORS`, `PRESET_AVATARS`, `AvatarKind` — already imported.

- [ ] **Step 1: Add tests**

```typescript
it('sends setIdentity with a custom hex color from the color input', () => {
  const setIdentity = vi.fn()
  renderWithProviders(<Lobby game={makeGame({
    setIdentity,
    lobby: [{ id: 0, name: 'Alice', connected: true, isBot: false, color: PLAYER_COLORS[0], avatar: DEFAULT_AVATAR }],
  })} />)
  const input = screen.getByTestId('color-custom') as HTMLInputElement
  fireEvent.change(input, { target: { value: '#123abc' } })
  expect(setIdentity).toHaveBeenCalledWith({ color: '#123abc' })
})

it('disables a preset avatar already taken by another player', () => {
  renderWithProviders(<Lobby game={makeGame({
    lobby: [
      { id: 0, name: 'Alice', connected: true, isBot: false, color: PLAYER_COLORS[0], avatar: { kind: AvatarKind.Preset, id: PRESET_AVATARS.Dog } },
      { id: 1, name: 'Bob', connected: true, isBot: false, color: PLAYER_COLORS[1], avatar: DEFAULT_AVATAR },
    ],
  })} />)
  const dogOption = screen.getByTestId('avatar-option').closest('button')! // first is Cat; find Dog via aria-label
  const dogBtn = screen.getByLabelText(`${'Avatar'} ${PRESET_AVATARS.Dog}`)
  expect(dogBtn).toBeDisabled()
})
```

(Adjust the Dog lookup to query by `data-testid="avatar-option"` and
`aria-label` matching `${t('lobby.avatar')} ${id}`; use the helper that
filters by the Dog id.)

- [ ] **Step 2: Run tests**

Run: `npm run test:unit -- src/components/__tests__/Lobby.test.tsx`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/__tests__/Lobby.test.tsx
git commit -m "test: cover lobby custom color input and taken avatar disabling"
```

---

### Task 6: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run typecheck, lint, unit tests**

Run: `npm run typecheck && npm run lint && npm run test:unit`
Expected: all green.

- [ ] **Step 2: Commit (if any fixups needed)**

Only commit fixups if the previous tasks left uncommitted changes; otherwise no commit.
