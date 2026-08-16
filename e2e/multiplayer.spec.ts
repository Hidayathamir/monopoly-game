import { test, expect } from './fixtures'

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

  await pageA.click('button:has-text("Start")')
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

  await pageA.click('button:has-text("Start")')
  await expect(pageA.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  await pageB.click('button[aria-label="Leave Room"]')
  await pageB.getByRole('button', { name: 'Leave', exact: true }).click()
  await expect(pageB.locator('h1')).toHaveText('Monopoly', { timeout: 5000 })
})

test('host adds a bot, starts, and the bot auto-plays', async ({ browser, serverUrl }) => {
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

  await page.click('button:has-text("Start (")')
  await expect(page.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  // Play the host's turn(s) until the bot seat (Droid) becomes current.
  const waitingFor = page.locator('[data-testid="waiting-for"]')
  for (let i = 0; i < 10; i++) {
    if (await waitingFor.isVisible({ timeout: 500 }).catch(() => false)) break

    const roll = page.locator('button:has-text("Roll"), button:has-text("Roll Again")').first()
    if (await roll.isVisible({ timeout: 500 }).catch(() => false)) {
      await roll.click()
      await page.waitForTimeout(2500)
      continue
    }

    const buy = page.locator('button:has-text("Buy (")').first()
    if (await buy.isVisible({ timeout: 500 }).catch(() => false)) { await buy.click(); continue }
    const no = page.locator('button:has-text("No")').first()
    if (await no.isVisible({ timeout: 500 }).catch(() => false)) { await no.click(); continue }
    const draw = page.locator('button:has-text("Draw")').first()
    if (await draw.isVisible({ timeout: 500 }).catch(() => false)) {
      await draw.click()
      await page.waitForTimeout(500)
      const ok = page.locator('button:has-text("OK")').first()
      if (await ok.isVisible({ timeout: 1000 }).catch(() => false)) await ok.click()
      continue
    }
    const ok = page.locator('button:has-text("OK")').first()
    if (await ok.isVisible({ timeout: 500 }).catch(() => false)) { await ok.click(); continue }
    const pay = page.locator('button:has-text("Pay")').first()
    if (await pay.isVisible({ timeout: 500 }).catch(() => false)) { await pay.click(); continue }
    const end = page.locator('button:has-text("End")').first()
    if (await end.isVisible({ timeout: 500 }).catch(() => false)) { await end.click(); continue }
    await page.waitForTimeout(500) // still animating — keep polling, never break early
  }

  // The bot seat is now current and auto-plays; verify control returns to the host.
  await expect(waitingFor).toContainText('Droid', { timeout: 10000 })
  await expect(page.locator('button:has-text("Roll")').first()).toBeVisible({ timeout: 30000 })
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

  await pageA.click('button:has-text("Start")')
  await expect(pageA.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })
  await expect(pageB.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  // Hold the roll button ~400ms, then release → a target locks and a roll resolves.
  const roll = pageA.locator('button:has-text("Roll")')
  const hostRolls = await roll.isVisible()
  const current = hostRolls ? pageA : pageB
  const roller = current.locator('button:has-text("Roll"), button:has-text("Roll Again")').first()
  const box = await roller.boundingBox()
  if (box) {
    await current.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await current.mouse.down()
    await current.waitForTimeout(400)
    await current.mouse.up()
  }
  await expect(current.locator('[data-testid="dice-pip"]').first()).toBeVisible({ timeout: 5000 })
})
