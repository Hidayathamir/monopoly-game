import { test, expect } from './fixtures'
import { seedWaitingGame } from './helpers/seed'

test('two clients create and join a room, then start a game', async ({ browser, serverUrl }) => {
  const context = await browser.newContext()
  await context.addInitScript(() => {
    localStorage.setItem('monopoly-language', 'en')
    localStorage.setItem('monopoly-currency', 'USD')
  })
  const pageA = await context.newPage()
  const pageB = await context.newPage()

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

  await pageA.click('button:has-text("Start")')
  await expect(pageA.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })
  await expect(pageB.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  // Turn order is randomized, so either player may roll first; the other waits.
  const hostRoll = pageA.locator('button:has-text("Roll")')
  const tamuRoll = pageB.locator('button:has-text("Roll")')
  const exactlyOneCanRoll = async () =>
    (await hostRoll.isVisible()) !== (await tamuRoll.isVisible())
  await expect.poll(exactlyOneCanRoll, { timeout: 5000 }).toBe(true)
  const hostRolls = await hostRoll.isVisible()
  const tamuRolls = await tamuRoll.isVisible()
  expect(hostRolls !== tamuRolls).toBe(true)
  if (hostRolls) {
    await expect(pageB.locator('[data-testid="waiting-for"]')).toBeVisible()
  } else {
    await expect(pageA.locator('[data-testid="waiting-for"]')).toBeVisible()
  }
})

test('a player who refreshes mid-game rejoins the same room', async ({ browser, serverUrl }) => {
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

  // Seed a mid-game Waiting state so the refresh happens mid-game.
  await seedWaitingGame(serverUrl, code, {
    players: [
      { id: 0, name: 'Host', money: 1500 },
      { id: 1, name: 'Tamu', money: 1500 },
    ],
    currentPlayer: 0,
  })
  await expect(pageA.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })
  await expect(pageB.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  await pageB.reload()
  // The session in localStorage makes the refreshed page auto-rejoin as Tamu.
  await expect(pageB.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 10000 })
  await expect(pageB.getByText('Tamu').first()).toBeVisible()
})

test('a player can leave the room mid-game and return to the menu', async ({ browser, serverUrl }) => {
  const context = await browser.newContext()
  await context.addInitScript(() => {
    localStorage.setItem('monopoly-language', 'en')
    localStorage.setItem('monopoly-currency', 'USD')
  })
  const pageA = await context.newPage()
  const pageB = await context.newPage()

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

  // Seed a mid-game Waiting state so the leave happens mid-game.
  await seedWaitingGame(serverUrl, code, {
    players: [
      { id: 0, name: 'Host', money: 1500 },
      { id: 1, name: 'Tamu', money: 1500 },
    ],
    currentPlayer: 0,
  })
  await expect(pageA.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  await pageB.click('button[aria-label="Leave Room"]')
  await pageB.getByRole('button', { name: 'Leave', exact: true }).click()
  await expect(pageB.locator('h1')).toHaveText('Monopoly', { timeout: 5000 })
})

test('host adds a bot, and the bot auto-plays from a seeded turn', async ({ browser, serverUrl }) => {
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

  await page.click('button:has-text("Add Bot")')
  await expect(page.locator('text=Droid')).toBeVisible()

  // Seed a Waiting state where the bot seat (Droid, slot 1) is current → it auto-plays.
  const code = (await codeLocator.innerText()).trim()
  await seedWaitingGame(serverUrl, code, {
    players: [
      { id: 0, name: 'Host', money: 1500 },
      { id: 1, name: 'Droid', money: 1500, isBot: true },
    ],
    currentPlayer: 1,
    turnOrder: [0, 1],
  })

  // The bot seat is current and auto-plays; verify control returns to the host.
  await expect(page.locator('[data-testid="waiting-for"]')).toContainText('Droid', { timeout: 10000 })
  await expect(page.locator('[data-testid="dice-roller"] button').first()).toBeVisible({ timeout: 30000 })
})

test('a player can hold-to-roll without breaking multiplayer', async ({ browser, serverUrl }) => {
  const context = await browser.newContext()
  await context.addInitScript(() => {
    localStorage.setItem('monopoly-language', 'en')
    localStorage.setItem('monopoly-currency', 'USD')
  })
  const pageA = await context.newPage()
  const pageB = await context.newPage()

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

  // Seed a mid-game Waiting state with the host to roll, so the roller is deterministic.
  await seedWaitingGame(serverUrl, code, {
    players: [
      { id: 0, name: 'Host', money: 1500 },
      { id: 1, name: 'Tamu', money: 1500 },
    ],
    currentPlayer: 0,
  })
  await expect(pageA.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })
  await expect(pageB.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  // Hold the roll button ~400ms, then release → a target locks and a roll resolves.
  const roll = pageA.locator('[data-testid="dice-roller"] button').first()
  await expect(roll).toBeVisible({ timeout: 5000 })
  const box = await roll.boundingBox()
  if (box) {
    await pageA.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await pageA.mouse.down()
    await pageA.waitForTimeout(400)
    await pageA.mouse.up()
  }
  await expect(pageA.locator('[data-testid="dice-pip"]').first()).toBeVisible({ timeout: 5000 })
})

test('a lobby room appears in the public list and is joinable by clicking', async ({ browser, serverUrl }) => {
  const contextA = await browser.newContext()
  await contextA.addInitScript(() => {
    localStorage.setItem('monopoly-language', 'en')
    localStorage.setItem('monopoly-currency', 'USD')
  })
  const pageA = await contextA.newPage()

  await pageA.goto(serverUrl)
  await pageA.fill('input[placeholder="Name"]', 'ListHost')
  await pageA.click('button:has-text("Continue")')
  const codeLocator = pageA.locator('[data-testid="room-code"]')
  await expect(codeLocator).not.toHaveText('—', { timeout: 5000 })

  // A second client on the menu sees ListHost's lobby room and joins by clicking.
  const contextB = await browser.newContext()
  await contextB.addInitScript(() => {
    localStorage.setItem('monopoly-language', 'en')
    localStorage.setItem('monopoly-currency', 'USD')
  })
  const pageB = await contextB.newPage()
  await pageB.goto(serverUrl)
  await pageB.fill('input[placeholder="Name"]', 'Tamu')
  await expect(pageB.locator('[data-testid="room-row"]').filter({ hasText: 'ListHost' })).toHaveCount(1, { timeout: 10000 })
  await pageB.locator('[data-testid="room-row"]').filter({ hasText: 'ListHost' }).click()

  // Both clients end up in the same lobby.
  await expect(pageA.locator('text=Tamu')).toBeVisible({ timeout: 5000 })
  await expect(pageB.locator('[data-testid="room-code"]')).toBeVisible({ timeout: 5000 })
})
