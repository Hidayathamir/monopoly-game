import { test as base, expect } from '@playwright/test'
import { startServer } from './helpers/server'
import { seedWaitingGame } from './helpers/seed'

// Dedicated server with short AFK + room-empty grace so the tests run fast.
const test = base.extend<object, { serverUrl: string }>({
  serverUrl: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use, workerInfo) => {
      const server = await startServer(4500 + workerInfo.workerIndex, {
        AFK_TIMEOUT_MS: '3000',
        ROOM_EMPTY_GRACE_MS: '4000',
      })
      await use(server.url)
      server.close()
    },
    { scope: 'worker' },
  ],
})

async function roomStillListed(serverUrl: string, code: string): Promise<boolean> {
  const res = await fetch(`${serverUrl}/rooms`)
  const rooms = (await res.json()) as Array<{ code: string }>
  return rooms.some((r) => r.code === code)
}

test('a connected human who stops acting is marked AFK and the bot plays their turn', async ({ browser, serverUrl }) => {
  const context = await browser.newContext()
  await context.addInitScript(() => {
    localStorage.setItem('monopoly-language', 'en')
    localStorage.setItem('monopoly-currency', 'USD')
  })
  const page = await context.newPage()

  await page.goto(serverUrl)
  await page.fill('input[placeholder="Name"]', 'Host')
  await page.click('button:has-text("Continue")')
  const codeLocator = page.locator('[data-testid="room-code"]')
  await expect(codeLocator).not.toHaveText('—', { timeout: 5000 })
  const code = (await codeLocator.innerText()).trim()

  await page.click('button:has-text("Add Bot")')
  await expect(page.locator('text=Droid')).toBeVisible()

  // Seed a Waiting state where the connected host is current and never acts.
  await seedWaitingGame(serverUrl, code, {
    players: [
      { id: 0, name: 'Host', money: 1500 },
      { id: 1, name: 'Droid', money: 1500, isBot: true },
    ],
    currentPlayer: 0,
    turnOrder: [0, 1],
  })

  // After the 3s AFK window the server marks the host AFK and a bot takes over.
  await expect(page.locator('[data-testid="player-card"]').filter({ hasText: 'Host' })).toContainText('BOT', { timeout: 10000 })
  await expect(page.locator('[data-testid="event-entry"]').filter({ hasText: 'AFK' })).toBeVisible({ timeout: 10000 })
  // The bot actually plays the host's turn (bot-labeled log entries).
  await expect(page.locator('[data-testid="event-entry"]').filter({ hasText: '(bot)' }).first()).toBeVisible({ timeout: 15000 })
})

test('removes the room after a grace window when every human leaves mid-game', async ({ browser, serverUrl }) => {
  const contextA = await browser.newContext()
  await contextA.addInitScript(() => {
    localStorage.setItem('monopoly-language', 'en')
    localStorage.setItem('monopoly-currency', 'USD')
  })
  const contextB = await browser.newContext()
  await contextB.addInitScript(() => {
    localStorage.setItem('monopoly-language', 'en')
    localStorage.setItem('monopoly-currency', 'USD')
  })
  const pageA = await contextA.newPage()
  const pageB = await contextB.newPage()

  await pageA.goto(serverUrl)
  await pageA.fill('input[placeholder="Name"]', 'Host')
  await pageA.click('button:has-text("Continue")')
  const codeLocator = pageA.locator('[data-testid="room-code"]')
  await expect(codeLocator).not.toHaveText('—', { timeout: 5000 })
  const code = (await codeLocator.innerText()).trim()

  await pageB.goto(serverUrl)
  await pageB.fill('input[placeholder="Name"]', 'Tamu')
  await pageB.click('button:has-text("Join Room")')
  await pageB.fill('input[placeholder="Code"]', code)
  await pageB.click('button:has-text("Continue")')
  await expect(pageA.locator('text=Tamu')).toBeVisible({ timeout: 5000 })

  await seedWaitingGame(serverUrl, code, {
    players: [
      { id: 0, name: 'Host', money: 1500 },
      { id: 1, name: 'Tamu', money: 1500 },
    ],
    currentPlayer: 0,
  })

  // Both humans leave mid-game.
  for (const page of [pageA, pageB]) {
    await page.click('button[aria-label="Leave Room"]')
    await page.getByRole('button', { name: 'Leave', exact: true }).click()
  }

  // The last human leaving stops the game and the room is removed after the grace.
  await expect.poll(async () => roomStillListed(serverUrl, code), { timeout: 15000 }).toBe(false)
})

test('removes the room after a grace window when every human disconnects', async ({ browser, serverUrl }) => {
  const contextA = await browser.newContext()
  await contextA.addInitScript(() => {
    localStorage.setItem('monopoly-language', 'en')
    localStorage.setItem('monopoly-currency', 'USD')
  })
  const contextB = await browser.newContext()
  await contextB.addInitScript(() => {
    localStorage.setItem('monopoly-language', 'en')
    localStorage.setItem('monopoly-currency', 'USD')
  })
  const pageA = await contextA.newPage()
  const pageB = await contextB.newPage()

  await pageA.goto(serverUrl)
  await pageA.fill('input[placeholder="Name"]', 'Host')
  await pageA.click('button:has-text("Continue")')
  const codeLocator = pageA.locator('[data-testid="room-code"]')
  await expect(codeLocator).not.toHaveText('—', { timeout: 5000 })
  const code = (await codeLocator.innerText()).trim()

  await pageB.goto(serverUrl)
  await pageB.fill('input[placeholder="Name"]', 'Tamu')
  await pageB.click('button:has-text("Join Room")')
  await pageB.fill('input[placeholder="Code"]', code)
  await pageB.click('button:has-text("Continue")')
  await expect(pageA.locator('text=Tamu')).toBeVisible({ timeout: 5000 })

  await seedWaitingGame(serverUrl, code, {
    players: [
      { id: 0, name: 'Host', money: 1500 },
      { id: 1, name: 'Tamu', money: 1500 },
    ],
    currentPlayer: 0,
  })

  // Both humans go offline (WebSocket closes).
  await contextA.close()
  await contextB.close()

  // No humans left → the game stops and the room is removed after the grace.
  await expect.poll(async () => roomStillListed(serverUrl, code), { timeout: 15000 }).toBe(false)
})

test('keeps the room when the last human reconnects within the grace window', async ({ browser, serverUrl }) => {
  const context = await browser.newContext()
  await context.addInitScript(() => {
    localStorage.setItem('monopoly-language', 'en')
    localStorage.setItem('monopoly-currency', 'USD')
  })
  const page = await context.newPage()

  await page.goto(serverUrl)
  await page.fill('input[placeholder="Name"]', 'Host')
  await page.click('button:has-text("Continue")')
  const codeLocator = page.locator('[data-testid="room-code"]')
  await expect(codeLocator).not.toHaveText('—', { timeout: 5000 })
  const code = (await codeLocator.innerText()).trim()

  await page.click('button:has-text("Add Bot")')
  await expect(page.locator('text=Droid')).toBeVisible()

  await seedWaitingGame(serverUrl, code, {
    players: [
      { id: 0, name: 'Host', money: 1500 },
      { id: 1, name: 'Droid', money: 1500, isBot: true },
    ],
    currentPlayer: 0,
  })
  await expect(page.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  // Refresh mid-game: the ws closes (teardown scheduled) then the session auto-rejoins.
  await page.reload()
  await expect(page.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 10000 })

  // Let the grace window fully pass; the rejoin must have cancelled the teardown.
  await page.waitForTimeout(6000)
  expect(await roomStillListed(serverUrl, code)).toBe(true)
})
