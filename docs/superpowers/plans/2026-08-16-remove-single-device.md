# Remove Single Device — Multiplayer (LAN) Only — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the Single Device (local) game mode entirely and make Multiplayer (LAN) the only entry point, preserving gameplay e2e coverage by running those specs against the LAN server.

**Architecture:** The app no longer branches between a local `useGame` hook and a network game. `App.tsx` renders either the multiplayer setup screen (`GameSetup`, create/join form only) or `MultiplayerGame`. The shared engine (`gameReducer`, `bot.ts`, `controlledDice.ts`) is unchanged — the server already uses all three. Gameplay e2e specs are rewritten to drive a real server room with server-side bot seats.

**Tech Stack:** React 19 + Vite 8 + TypeScript, Vitest, Playwright (e2e), Node WebSocket server (`tsx server/main.ts`, `ws`).

## Global Constraints

- **No TS enums** (`erasableSyntaxOnly: true`) — use `const` objects + derived union types. `verbatimModuleSyntax: true` → type-only imports must use `import type`.
- **Enum-like string constants**: fixed string sets are `const` objects with a derived union type (see `src/types/game.ts`). Do not use raw string literals in production code where a constant exists. Wire values are part of the client/server contract and must never change.
- **i18n**: every UI string must exist in both `src/i18n/locales/en/translation.json` and `id/translation.json` (flat keys).
- **Semicolons are mixed**: `src/logic/*`, `src/data/*`, `src/types/*` use them; most components/hooks/net/server files omit them. Match the file being edited.
- **e2e requires a build first**: `dist/` is gitignored and served by the multiplayer server; run `npm run build` before any `npm run test:e2e` run.
- Bots/max players: rooms support max 6 players including bots; server-side bots auto-play via `decideBotAction`.
- `npm run lint` currently passes with 2 pre-existing `react-hooks/exhaustive-deps` warnings in `PlayerTokens.tsx` — do not regress to additional warnings/errors.

---

### Task 1: Make `GameSetup` multiplayer-only

**Files:**
- Modify: `src/components/GameSetup.tsx` (full rewrite)
- Test: `src/components/__tests__/GameSetup.test.tsx` (full rewrite)

**Interfaces:**
- Consumes: none new (still renders with `useTranslation`, `Button`).
- Produces: `GameSetup` with props `{ onCreate: (name: string) => void; onJoin: (name: string, code: string) => void }`. Used by `App.tsx` (Task 2) and `GameSetup.test.tsx` (this task).

- [ ] **Step 1: Write the failing test**

Replace the entire contents of `src/components/__tests__/GameSetup.test.tsx` with:

```tsx
// @vitest-environment jsdom
import { cleanup, screen, fireEvent } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import GameSetup from '../GameSetup'
import { renderWithProviders } from '../../test/test-utils'

afterEach(cleanup)

describe('GameSetup', () => {
  it('creates a room with the entered name', () => {
    const onCreate = vi.fn()
    renderWithProviders(<GameSetup onCreate={onCreate} onJoin={() => {}} />)

    fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'Alice' } })
    fireEvent.click(screen.getByText('Continue'))

    expect(onCreate).toHaveBeenCalledWith('Alice')
  })

  it('joins a room and calls onJoin', () => {
    const onJoin = vi.fn()
    renderWithProviders(<GameSetup onCreate={() => {}} onJoin={onJoin} />)

    fireEvent.click(screen.getByText('Join Room'))
    fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'Alice' } })
    fireEvent.change(screen.getByPlaceholderText('Code'), { target: { value: 'abc' } })
    fireEvent.click(screen.getByText('Continue'))

    expect(onJoin).toHaveBeenCalledWith('Alice', 'ABC')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- GameSetup`
Expected: FAIL — the old component requires an `onStartLocal` prop, shows the Single Device / Multiplayer toggle, and defaults to the local form (no "Continue" button), so `getByText('Continue')` throws "unable to find an element".

- [ ] **Step 3: Rewrite the component**

Replace the entire contents of `src/components/GameSetup.tsx` with:

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from './Button'

const MpAction = {
  Create: 'create',
  Join: 'join',
} as const
type MpAction = (typeof MpAction)[keyof typeof MpAction]

interface Props {
  onCreate: (name: string) => void
  onJoin: (name: string, code: string) => void
}

export default function GameSetup({ onCreate, onJoin }: Props) {
  const { t } = useTranslation()
  const [myName, setMyName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [mpAction, setMpAction] = useState<MpAction>(MpAction.Create)

  function handleSubmit() {
    const name = myName.trim() || t('lobby.player')
    if (mpAction === MpAction.Create) onCreate(name)
    else onJoin(name, roomCode.trim().toUpperCase())
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-5">
      <h1 className="text-[80px] text-gold m-0">{t('setup.title')}</h1>
      <div className="bg-bg-card px-10 py-[30px] rounded-xl flex flex-col gap-4 min-w-[360px]">
        <div className="flex flex-col gap-1.5">
          <label className="text-base text-muted">{t('setup.yourName')}</label>
          <input
            type="text"
            value={myName}
            onChange={(e) => setMyName(e.target.value)}
            placeholder={t('setup.namePlaceholder')}
            maxLength={12}
            className="px-3 py-2 rounded-lg border border-border bg-input-bg text-text text-base"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={mpAction === MpAction.Create ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setMpAction(MpAction.Create)}
            className={mpAction === MpAction.Create ? 'ring-2 ring-gold/80' : 'opacity-60'}
          >
            {t('setup.createRoom')}
          </Button>
          <Button
            variant={mpAction === MpAction.Join ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setMpAction(MpAction.Join)}
            className={mpAction === MpAction.Join ? 'ring-2 ring-gold/80' : 'opacity-60'}
          >
            {t('setup.joinRoom')}
          </Button>
        </div>
        {mpAction === MpAction.Join && (
          <div className="flex flex-col gap-1.5">
            <label className="text-base text-muted">{t('setup.roomCode')}</label>
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              placeholder={t('setup.codePlaceholder')}
              maxLength={5}
              className="px-3 py-2 rounded-lg border border-border bg-input-bg text-text text-base"
            />
          </div>
        )}
        <Button variant="start" size="lg" onClick={handleSubmit}>
          {t('setup.continue')}
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- GameSetup`
Expected: PASS (2 tests). The mode toggle, local form, `onStartLocal` prop, `PLAYER_COLORS`, and `BOT_NAMES` are all gone.

- [ ] **Step 5: Commit**

```bash
git add src/components/GameSetup.tsx src/components/__tests__/GameSetup.test.tsx
git commit -m "refactor: GameSetup is multiplayer-only (remove Single Device form)"
```

---

### Task 2: Simplify `App.tsx` to multiplayer-only

**Files:**
- Modify: `src/App.tsx` (full rewrite)

**Interfaces:**
- Consumes: `GameSetup` from Task 1; `MultiplayerGame`, `JoinInfo` (unchanged, `src/components/MultiplayerGame.tsx`); `loadSession`/`clearSession` from `src/net/session.ts`.
- Produces: `App` that renders `<GameSetup onCreate onJoin />` or `<MultiplayerGame joinInfo onLeft />`. Enables deleting `useGame` in Task 3.

- [ ] **Step 1: Rewrite the component**

Replace the entire contents of `src/App.tsx` with:

```tsx
import { useState } from 'react'
import GameSetup from './components/GameSetup'
import MultiplayerGame, { type JoinInfo } from './components/MultiplayerGame'
import LanguageCurrencyBar from './components/LanguageCurrencyBar'
import { loadSession, clearSession } from './net/session'

export default function App() {
  const [started, setStarted] = useState(() => loadSession() !== null)
  const [joinInfo, setJoinInfo] = useState<JoinInfo>(() => {
    const session = loadSession()
    return session ? { name: session.name, code: session.code } : { name: '', code: null }
  })

  function handleCreate(name: string) {
    setJoinInfo({ name, code: null })
    setStarted(true)
  }

  function handleJoin(name: string, code: string) {
    setJoinInfo({ name, code })
    setStarted(true)
  }

  if (started) {
    return (
      <>
        <MultiplayerGame
          joinInfo={joinInfo}
          onLeft={() => {
            clearSession()
            setStarted(false)
          }}
        />
        <LanguageCurrencyBar />
      </>
    )
  }

  return (
    <>
      <div className="flex justify-center items-center h-screen p-0 overflow-hidden">
        <GameSetup onCreate={handleCreate} onJoin={handleJoin} />
      </div>
      <LanguageCurrencyBar />
    </>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS. (`useGame.ts` still exists but is no longer imported — deletion happens in Task 3.)

- [ ] **Step 3: Run unit tests**

Run: `npm run test:unit`
Expected: PASS (all suites; `useGame.test.ts` still runs and passes).

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "refactor: App is multiplayer-only, drop local mode branch"
```

---

### Task 3: Delete the `useGame` hook and its tests

**Files:**
- Delete: `src/hooks/useGame.ts`
- Delete: `src/hooks/__tests__/useGame.test.ts`

**Interfaces:**
- Consumes: Task 2 removed the only importer of `useGame` (`App.tsx`).
- Produces: no more local-mode hook; `monopoly-game-state` localStorage key dies with it.

- [ ] **Step 1: Delete the files**

```bash
git rm src/hooks/useGame.ts src/hooks/__tests__/useGame.test.ts
```

- [ ] **Step 2: Confirm no dangling references**

Run: `rg -n "useGame" src e2e server`
Expected: no matches.

- [ ] **Step 3: Typecheck and unit tests**

Run: `npm run typecheck && npm run test:unit`
Expected: both PASS.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: delete useGame hook and its tests"
```

---

### Task 4: Remove local-only i18n keys

**Files:**
- Modify: `src/i18n/locales/en/translation.json`
- Modify: `src/i18n/locales/id/translation.json`
- Modify: `src/components/__tests__/RoomExit.test.tsx:40-54`

**Interfaces:**
- Consumes: Tasks 1–3 removed all production references to the deleted keys. `RoomExit.test.tsx` still passes the `exit.*` keys to the custom-copy-keys test and asserts their translated output, so it must switch to keys that remain.
- Produces: both locale files without the local-mode keys; the kept `setup.*` multiplayer keys are used by the new `GameSetup`.

- [ ] **Step 1: Edit `en/translation.json` — remove `common.player`**

Old:
```
{
  "common.player": "Player {{n}}",
```
New:
```
{
```
(Keeps `"common.yes"` on the following line.)

- [ ] **Step 2: Edit `en/translation.json` — slim the `setup.*` block**

Old:
```
  "setup.title": "Monopoly",
  "setup.singleDevice": "Single Device",
  "setup.multiplayer": "Multiplayer (LAN)",
  "setup.playerCount": "Number of Players",
  "setup.playerCount2": "2 Players",
  "setup.playerCount3": "3 Players",
  "setup.playerCount4": "4 Players",
  "setup.playerCount5": "5 Players",
  "setup.playerCount6": "6 Players",
  "setup.playerName": "Player {{n}} Name",
  "setup.playerPlaceholder": "Player {{n}}",
  "setup.isBot": "Bot seat {{n}}",
  "setup.isBotLabel": "Bot",
  "setup.start": "Start Game",
  "setup.yourName": "Your Name",
```
New:
```
  "setup.title": "Monopoly",
  "setup.yourName": "Your Name",
```

- [ ] **Step 3: Edit `en/translation.json` — remove the `exit.*` block**

Old:
```
  "trade.reject": "Reject",

  "exit.label": "Exit Game",
  "exit.title": "Exit Game",
  "exit.message": "Leave the current game? Progress will be lost and a new game will start.",
  "exit.confirm": "Exit",

  "settings.language": "Language",
```
New:
```
  "trade.reject": "Reject",

  "settings.language": "Language",
```

- [ ] **Step 4: Edit `id/translation.json` — remove `common.player`**

Old:
```
{
  "common.player": "Pemain {{n}}",
```
New:
```
{
```

- [ ] **Step 5: Edit `id/translation.json` — slim the `setup.*` block**

Old:
```
  "setup.title": "Monopoli",
  "setup.singleDevice": "Satu Perangkat",
  "setup.multiplayer": "Multiplayer (LAN)",
  "setup.playerCount": "Jumlah Pemain",
  "setup.playerCount2": "2 Pemain",
  "setup.playerCount3": "3 Pemain",
  "setup.playerCount4": "4 Pemain",
  "setup.playerCount5": "5 Pemain",
  "setup.playerCount6": "6 Pemain",
  "setup.playerName": "Nama Pemain {{n}}",
  "setup.playerPlaceholder": "Pemain {{n}}",
  "setup.isBot": "Kursi bot {{n}}",
  "setup.isBotLabel": "Bot",
  "setup.start": "Mulai Permainan",
  "setup.yourName": "Nama Kamu",
```
New:
```
  "setup.title": "Monopoli",
  "setup.yourName": "Nama Kamu",
```

- [ ] **Step 6: Edit `id/translation.json` — remove the `exit.*` block**

Old:
```
  "trade.reject": "Tolak",

  "exit.label": "Keluar Permainan",
  "exit.title": "Keluar Permainan",
  "exit.message": "Keluar dari permainan saat ini? Progres akan hilang dan permainan baru akan dimulai.",
  "exit.confirm": "Keluar",

  "settings.language": "Bahasa",
```
New:
```
  "trade.reject": "Tolak",

  "settings.language": "Bahasa",
```

- [ ] **Step 7: Update `RoomExit.test.tsx` to not depend on removed keys**

In `src/components/__tests__/RoomExit.test.tsx`, replace the "uses the provided copy keys" test:

Old:
```tsx
  it('uses the provided copy keys for the exit button and modal', () => {
    renderWithProviders(
      <RoomExit
        onLeave={() => {}}
        variant="icon"
        labelKey="exit.label"
        titleKey="exit.title"
        messageKey="exit.message"
        confirmKey="exit.confirm"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Exit Game' }))
    expect(screen.getByText('Leave the current game? Progress will be lost and a new game will start.')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Exit' }))
  })
```

New:
```tsx
  it('uses the provided copy keys for the leave button and modal', () => {
    renderWithProviders(
      <RoomExit
        onLeave={() => {}}
        variant="icon"
        labelKey="lobby.leaveRoom"
        titleKey="confirm.leaveTitle"
        messageKey="confirm.leaveMessage"
        confirmKey="confirm.leave"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Leave Room' }))
    expect(screen.getByText('Are you sure you want to leave this room?')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }))
  })
```

- [ ] **Step 8: Verify no references remain and typecheck**

Run: `rg -n "setup\.(singleDevice|multiplayer|playerCount|playerName|playerPlaceholder|isBot|start)|common\.player|exit\.(label|title|message|confirm)" src`
Expected: no matches.
Run: `npm run typecheck && npm run test:unit`
Expected: both PASS.

- [ ] **Step 9: Commit**

```bash
git add src/i18n/locales/en/translation.json src/i18n/locales/id/translation.json src/components/__tests__/RoomExit.test.tsx
git commit -m "chore: remove local-only i18n keys"
```

---

### Task 5: Shared e2e server fixture and refactor `multiplayer.spec.ts`

**Files:**
- Create: `e2e/helpers/server.ts`
- Create: `e2e/fixtures.ts`
- Modify: `e2e/multiplayer.spec.ts`

**Interfaces:**
- Produces: `test`/`expect` re-exported from `e2e/fixtures.ts`, with a worker-scoped `serverUrl: string` fixture (lazy — only starts when a test requests it). `startServer(port: number): Promise<{ url: string; close: () => void }>` from `e2e/helpers/server.ts`. Consumed by Tasks 6 and 7.

- [ ] **Step 1: Create `e2e/helpers/server.ts`**

```ts
import { spawn, type ChildProcess } from 'node:child_process'

export interface TestServer {
  url: string
  close: () => void
}

export async function startServer(port: number): Promise<TestServer> {
  // Requires `npm run build` first so `dist/` exists (served by the server).
  const proc: ChildProcess = spawn('npx', ['tsx', 'server/main.ts'], {
    env: { ...process.env, PORT: String(port) },
    cwd: process.cwd(),
    stdio: 'ignore',
    detached: true,
  })
  const url = `http://localhost:${port}`
  const startedAt = Date.now()
  while (Date.now() - startedAt < 10000) {
    try {
      const res = await fetch(`${url}/`)
      if (res.ok) {
        return {
          url,
          close: () => {
            if (proc.pid) {
              try {
                process.kill(-proc.pid, 'SIGTERM')
              } catch {
                proc.kill()
              }
            }
          },
        }
      }
    } catch {
      // server not up yet, poll again
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  try {
    if (proc.pid) process.kill(-proc.pid, 'SIGTERM')
  } catch {
    proc.kill()
  }
  throw new Error(`server on port ${port} did not start`)
}
```

- [ ] **Step 2: Create `e2e/fixtures.ts`**

```ts
import { test as base, expect } from '@playwright/test'
import { startServer } from './helpers/server'

interface WorkerFixtures {
  serverUrl: string
}

export const test = base.extend<{}, WorkerFixtures>({
  serverUrl: [
    async ({}, use, workerInfo) => {
      const server = await startServer(4000 + workerInfo.workerIndex)
      await use(server.url)
      server.close()
    },
    { scope: 'worker' },
  ],
})

export { expect }
```

- [ ] **Step 3: Refactor `e2e/multiplayer.spec.ts`**

First replace the header (imports + server bootstrapping + the first test's signature). Old:

```ts
import { test, expect } from '@playwright/test'
import { spawn, type ChildProcess } from 'node:child_process'

const PORT = 3123
let serverProc: ChildProcess | null = null

test.beforeAll(async () => {
  // Requires `npm run build` first so `dist/` exists (served by the server).
  serverProc = spawn('npx', ['tsx', 'server/main.ts'], {
    env: { ...process.env, PORT: String(PORT) },
    cwd: process.cwd(),
    stdio: 'ignore',
    detached: true,
  })
  // Wait for the server to start listening.
  await new Promise((resolve, reject) => {
    const startedAt = Date.now()
    const poll = async () => {
      try {
        const res = await fetch(`http://localhost:${PORT}/`)
        if (res.ok) return resolve(undefined)
      } catch {
        // server not up yet, poll again
      }
      if (Date.now() - startedAt > 10000) return reject(new Error('server did not start'))
      setTimeout(poll, 200)
    }
    poll()
  })
})

test.afterAll(() => {
  if (serverProc?.pid) {
    try {
      process.kill(-serverProc.pid, 'SIGTERM')
    } catch {
      serverProc.kill()
    }
  }
})

test('two clients create and join a room, then start a game', async ({ browser }) => {
```

New:

```ts
import { test, expect } from './fixtures'

test('two clients create and join a room, then start a game', async ({ browser, serverUrl }) => {
```

Then, in that same first test, replace these two blocks:

Old:
```ts
  await pageA.goto(`http://localhost:${PORT}/`)
  await pageA.click('button:has-text("Multiplayer")')
```
New:
```ts
  await pageA.goto(serverUrl)
```

Old:
```ts
  await pageB.goto(`http://localhost:${PORT}/`)
  await pageB.click('button:has-text("Multiplayer")')
```
New:
```ts
  await pageB.goto(serverUrl)
```

The `pageA` two-line block and the `pageB` two-line block each repeat identically in later tests — use **replace all** for both patterns (each appears 4 times). Do the same `replaceAll` in the same file for:

Old (all `pageA` occurrences):
```ts
  await pageA.goto(`http://localhost:${PORT}/`)
  await pageA.click('button:has-text("Multiplayer")')
```
New:
```ts
  await pageA.goto(serverUrl)
```

Old (all `pageB` occurrences):
```ts
  await pageB.goto(`http://localhost:${PORT}/`)
  await pageB.click('button:has-text("Multiplayer")')
```
New:
```ts
  await pageB.goto(serverUrl)
```

Finally, add `serverUrl` to the remaining test signatures by replacing these four lines:

```ts
test('a player who refreshes mid-game rejoins the same room', async ({ browser }) => {
```
→
```ts
test('a player who refreshes mid-game rejoins the same room', async ({ browser, serverUrl }) => {
```

```ts
test('a player can leave the room mid-game and return to the menu', async ({ browser }) => {
```
→
```ts
test('a player can leave the room mid-game and return to the menu', async ({ browser, serverUrl }) => {
```

```ts
test('host adds a bot, starts, and the bot auto-plays', async ({ browser }) => {
```
→
```ts
test('host adds a bot, starts, and the bot auto-plays', async ({ browser, serverUrl }) => {
```

```ts
test('a player can hold-to-roll without breaking multiplayer', async ({ browser }) => {
```
→
```ts
test('a player can hold-to-roll without breaking multiplayer', async ({ browser, serverUrl }) => {
```

- [ ] **Step 4: Run the multiplayer e2e spec**

Run: `npm run build && npm run test:e2e -- e2e/multiplayer.spec.ts`
Expected: PASS (5 tests). The "Multiplayer" toggle clicks are gone; the setup screen shows the multiplayer form directly.

- [ ] **Step 5: Commit**

```bash
git add e2e/helpers/server.ts e2e/fixtures.ts e2e/multiplayer.spec.ts
git commit -m "test: shared e2e server fixture; multiplayer spec uses it and drops mode toggle"
```

---

### Task 6: Rewrite `e2e/monopoly.spec.ts` against the server

**Files:**
- Create: `e2e/helpers/gameplay.ts`
- Modify: `e2e/monopoly.spec.ts` (full rewrite)

**Interfaces:**
- Consumes: `test`/`expect` from `e2e/fixtures.ts` (Task 5). `playHostTurns(page, maxLoops)` from `e2e/helpers/gameplay.ts`.
- Produces: gameplay e2e coverage running through the real server with server-side bot seats.

- [ ] **Step 1: Create `e2e/helpers/gameplay.ts`**

```ts
import { type Page } from '@playwright/test'

export async function playHostTurns(page: Page, maxLoops: number): Promise<void> {
  const roll = page.locator('button:has-text("Roll"), button:has-text("Roll Again")').first()
  const waitingFor = page.locator('[data-testid="waiting-for"]')
  for (let i = 0; i < maxLoops; i++) {
    if (await waitingFor.isVisible({ timeout: 300 }).catch(() => false)) {
      await page.waitForTimeout(500)
      continue
    }
    if (await roll.isVisible({ timeout: 300 }).catch(() => false)) {
      await roll.click()
      await page.waitForTimeout(2000)
      continue
    }
    const buy = page.locator('button:has-text("Buy (")').first()
    if (await buy.isVisible({ timeout: 300 }).catch(() => false)) { await buy.click(); continue }
    const no = page.locator('button:has-text("No")').first()
    if (await no.isVisible({ timeout: 300 }).catch(() => false)) { await no.click(); continue }
    const draw = page.locator('button:has-text("Draw")').first()
    if (await draw.isVisible({ timeout: 300 }).catch(() => false)) {
      await draw.click()
      await page.waitForTimeout(500)
      const ok = page.locator('button:has-text("OK")').first()
      if (await ok.isVisible({ timeout: 1000 }).catch(() => false)) await ok.click()
      continue
    }
    const pay = page.locator('button:has-text("Pay")').first()
    if (await pay.isVisible({ timeout: 300 }).catch(() => false)) { await pay.click(); continue }
    const end = page.locator('button:has-text("End"), button:has-text("Roll Again")').first()
    if (await end.isVisible({ timeout: 300 }).catch(() => false)) {
      await end.click()
      await page.waitForTimeout(300)
      continue
    }
    await page.waitForTimeout(500)
  }
}
```

- [ ] **Step 2: Rewrite `e2e/monopoly.spec.ts`**

Replace the entire file with:

```ts
import { test, expect } from './fixtures'
import type { Browser, Page } from '@playwright/test'
import { playHostTurns } from './helpers/gameplay'

async function newGamePage(browser: Browser, serverUrl: string): Promise<Page> {
  const context = await browser.newContext()
  await context.addInitScript(() => {
    localStorage.setItem('monopoly-language', 'en')
    localStorage.setItem('monopoly-currency', 'USD')
  })
  const page = await context.newPage()
  await page.goto(serverUrl)
  return page
}

async function createRoom(page: Page, name = 'Host'): Promise<void> {
  await page.fill('input[placeholder="Name"]', name)
  await page.click('button:has-text("Continue")')
  const codeLocator = page.locator('[data-testid="room-code"]')
  await expect(codeLocator).not.toHaveText('—', { timeout: 5000 })
}

async function startWithBots(page: Page, botCount: number): Promise<void> {
  for (let i = 0; i < botCount; i++) {
    await page.click('button:has-text("Add Bot")')
    await page.waitForTimeout(300)
  }
  await page.click(`button:has-text("Start (${botCount + 1}/6)")`)
  await expect(page.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })
}

test.describe('Monopoly Game E2E', () => {
  test('setup screen renders the multiplayer form', async ({ browser, serverUrl }) => {
    const page = await newGamePage(browser, serverUrl)
    await expect(page.locator('h1')).toHaveText('Monopoly')
    await expect(page.locator('button:has-text("Create Room")')).toBeVisible()
    await expect(page.locator('button:has-text("Join Room")')).toBeVisible()
    await expect(page.locator('input[placeholder="Name"]')).toBeVisible()
    await expect(page.locator('input[placeholder="Code"]')).toHaveCount(0)
  })

  test('start game with 2 players', async ({ browser, serverUrl }) => {
    const page = await newGamePage(browser, serverUrl)
    await createRoom(page, 'Alpha')
    await startWithBots(page, 1)
    await expect(page.locator('[data-testid="player-card"]')).toHaveCount(2)
    await expect(page.locator('[data-testid="player-card"]').first()).toContainText('$')
    const texts = await page.locator('[data-testid="player-card"]').allTextContents()
    expect(texts.some((t) => t.includes('Alpha'))).toBe(true)
  })

  test('gameplay survives turns', async ({ browser, serverUrl }) => {
    test.setTimeout(120000)
    const page = await newGamePage(browser, serverUrl)
    await createRoom(page, 'Buyer')
    await startWithBots(page, 1)
    await playHostTurns(page, 15)
    const firstCard = page.locator('[data-testid="player-card"]').first()
    await expect(firstCard).toContainText('$')
    const text = await firstCard.textContent()
    expect(text).toBeDefined()
    expect(text).not.toBe('')
  })

  for (const viewport of [
    { width: 375, height: 667 },
    { width: 667, height: 375 },
    { width: 812, height: 375 },
  ]) {
    test(`center panel fits on ${viewport.width}x${viewport.height}`, async ({ browser, serverUrl }) => {
      const page = await newGamePage(browser, serverUrl)
      await page.setViewportSize(viewport)
      await createRoom(page)
      await startWithBots(page, 1)
      const board = await page.locator('[data-game-board]').boundingBox()
      const sidebar = await page.locator('[data-testid="sidebar"]').boundingBox()
      expect(board).not.toBeNull()
      expect(sidebar).not.toBeNull()
      if (!board || !sidebar) return

      const innerW = (board.width * 9) / 11
      const innerH = (board.height * 9) / 11
      const innerLeft = board.x + board.width / 11
      const innerRight = board.x + (board.width * 10) / 11
      const innerTop = board.y + board.height / 11
      const innerBottom = board.y + (board.height * 10) / 11
      expect(sidebar.width).toBeLessThanOrEqual(innerW)
      expect(sidebar.height).toBeLessThanOrEqual(innerH)
      expect(sidebar.x).toBeGreaterThanOrEqual(innerLeft)
      expect(sidebar.x + sidebar.width).toBeLessThanOrEqual(innerRight)
      expect(sidebar.y).toBeGreaterThanOrEqual(innerTop)
      expect(sidebar.y + sidebar.height).toBeLessThanOrEqual(innerBottom)
    })
  }

  test('4-player game survives many turns without crash', async ({ browser, serverUrl }) => {
    test.setTimeout(120000)
    const page = await newGamePage(browser, serverUrl)
    await createRoom(page, 'P1')
    await startWithBots(page, 3)
    await expect(page.locator('[data-testid="player-card"]')).toHaveCount(4)
    await playHostTurns(page, 10)
    const count = await page.locator('[data-testid="player-card"]').count()
    expect(count).toBeGreaterThanOrEqual(2)
  })
})
```

- [ ] **Step 3: Run the spec**

Run: `npm run build && npm run test:e2e -- e2e/monopoly.spec.ts`
Expected: PASS (6 tests). If the long tests are flaky on timing, increase the `test.setTimeout` values (max 180000) rather than changing assertions.

- [ ] **Step 4: Commit**

```bash
git add e2e/helpers/gameplay.ts e2e/monopoly.spec.ts
git commit -m "test: rewrite monopoly e2e to run against the LAN server with bots"
```

---

### Task 7: Rewrite `e2e/i18n.spec.ts`

**Files:**
- Modify: `e2e/i18n.spec.ts` (full rewrite)

**Interfaces:**
- Consumes: `test`/`expect` from `e2e/fixtures.ts` (Task 5). Uses the `page` fixture (baseURL `http://localhost:4173`, Vite dev) for the setup-screen test and the `serverUrl` fixture for the currency test.

- [ ] **Step 1: Rewrite the spec**

Replace the entire file with:

```ts
import { test, expect } from './fixtures'

test('defaults to English and toggles to Indonesian', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Create Room')).toBeVisible()
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByLabel('Language').selectOption('id')
  await expect(page.getByText('Buat Ruangan')).toBeVisible()
})

test('currency defaults to USD and toggles money symbol', async ({ browser, serverUrl }) => {
  const context = await browser.newContext()
  await context.addInitScript(() => {
    localStorage.setItem('monopoly-language', 'en')
    localStorage.setItem('monopoly-currency', 'USD')
  })
  const page = await context.newPage()
  await page.goto(serverUrl)
  await page.fill('input[placeholder="Name"]', 'Alpha')
  await page.click('button:has-text("Continue")')
  await page.click('button:has-text("Add Bot")')
  await expect(page.locator('text=Droid')).toBeVisible()
  await page.click('button:has-text("Start (2/6)")')
  await expect(page.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })
  await expect(page.locator('[data-testid="player-card"]').first()).toContainText('$')
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByLabel('Currency').selectOption('IDR')
  await expect(page.locator('[data-testid="player-card"]').first()).toContainText('Rp')
})
```

- [ ] **Step 2: Run the spec**

Run: `npm run build && npm run test:e2e -- e2e/i18n.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 3: Confirm no spec references the removed toggle**

Run: `rg -n "has-text\(\"Multiplayer\"\)|Single Device|Start Game" e2e`
Expected: no matches.

- [ ] **Step 4: Commit**

```bash
git add e2e/i18n.spec.ts
git commit -m "test: rewrite i18n e2e to the multiplayer setup and server flow"
```

---

### Task 8: Update `AGENTS.md`

**Files:**
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: all prior tasks (the local mode is gone).
- Produces: accurate repo docs.

- [ ] **Step 1: Update the architecture bullets**

Replace:
```md
- **Shared game logic**: `src/logic/gameReducer.ts` (the reducer + `createInitialState`) is the single source of truth for rules. It runs on the client for local mode (`src/hooks/useGame.ts`) and on the server, authoritatively, for multiplayer (`server/gameServer.ts`). New rules/actions go in `src/logic` + `src/types/game.ts` and must work in both contexts.
```
with:
```md
- **Shared game logic**: `src/logic/gameReducer.ts` (the reducer + `createInitialState`) is the single source of truth for rules. It runs on the server, authoritatively, for multiplayer (`server/gameServer.ts`). New rules/actions go in `src/logic` + `src/types/game.ts` and must work in both contexts.
```

Replace:
```md
- **Bots**: `src/logic/bot.ts` (`decideBotAction`) drives bot seats locally and on the server; `src/data/bots.ts` supplies `BOT_NAMES`. Bot turns auto-play through the same reducer in both modes.
```
with:
```md
- **Bots**: `src/logic/bot.ts` (`decideBotAction`) drives bot seats on the server; `src/data/bots.ts` supplies `BOT_NAMES`. Bot turns auto-play through the server reducer.
```

Replace:
```md
- **Local state persistence**: `useGame` saves state to `localStorage` under `monopoly-game-state`; bump `STATE_VERSION` in `src/hooks/useGame.ts` when the `GameState` shape changes incompatibly.
```
with:
```md
- **Multiplayer session persistence**: the client stores the active room session under `monopoly-mp-session` (`src/net/session.ts`) so a refresh auto-rejoins the same room.
```

- [ ] **Step 2: Commit**

```bash
git add AGENTS.md
git commit -m "docs: AGENTS.md reflects multiplayer-only architecture"
```

---

## Final verification

- [ ] Run `npm run typecheck` — PASS
- [ ] Run `npm run lint` — PASS (only the 2 pre-existing `PlayerTokens.tsx` warnings)
- [ ] Run `npm run test:unit` — PASS
- [ ] Run `npm run build` — PASS
- [ ] Run `npm run test:e2e` — PASS (multiplayer, monopoly, i18n specs all green)
