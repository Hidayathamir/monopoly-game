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
  const context = await browser.newContext()
  await context.addInitScript(() => {
    localStorage.setItem('monopoly-language', 'en')
    localStorage.setItem('monopoly-currency', 'USD')
  })
  const pageA = await context.newPage()
  const pageB = await context.newPage()

  await pageA.goto(`http://localhost:${PORT}/`)
  await pageA.click('button:has-text("Multiplayer")')
  await pageA.fill('input[placeholder="Name"]', 'Host')
  await pageA.click('button:has-text("Continue")')
  const codeLocator = pageA.locator('[data-testid="room-code"]')
  await expect(codeLocator).not.toHaveText('—', { timeout: 5000 })
  const code = (await codeLocator.innerText()).trim()

  await pageB.goto(`http://localhost:${PORT}/`)
  await pageB.click('button:has-text("Multiplayer")')
  await pageB.fill('input[placeholder="Name"]', 'Tamu')
  await pageB.click('button:has-text("Join Room")')
  await pageB.fill('input[placeholder="Code"]', code)
  await pageB.click('button:has-text("Continue")')

  await expect(pageA.locator('text=Tamu')).toBeVisible({ timeout: 5000 })

  await pageA.click('button:has-text("Start")')
  await expect(pageA.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })
  await expect(pageB.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  await expect(pageA.locator('button:has-text("Roll")')).toBeVisible({ timeout: 5000 })
  await expect(pageA.locator('[data-testid="waiting-for"]')).toHaveCount(0)
  await expect(pageB.locator('button:has-text("Roll")')).toHaveCount(0)
  await expect(pageB.locator('[data-testid="waiting-for"]')).toBeVisible()
})

test('a player can leave the room mid-game and return to the menu', async ({ browser }) => {
  const context = await browser.newContext()
  await context.addInitScript(() => {
    localStorage.setItem('monopoly-language', 'en')
    localStorage.setItem('monopoly-currency', 'USD')
  })
  const pageA = await context.newPage()
  const pageB = await context.newPage()

  await pageA.goto(`http://localhost:${PORT}/`)
  await pageA.click('button:has-text("Multiplayer")')
  await pageA.fill('input[placeholder="Name"]', 'Host')
  await pageA.click('button:has-text("Continue")')
  const codeLocator = pageA.locator('[data-testid="room-code"]')
  await expect(codeLocator).not.toHaveText('—', { timeout: 5000 })
  const code = (await codeLocator.innerText()).trim()

  await pageB.goto(`http://localhost:${PORT}/`)
  await pageB.click('button:has-text("Multiplayer")')
  await pageB.fill('input[placeholder="Name"]', 'Tamu')
  await pageB.click('button:has-text("Join Room")')
  await pageB.fill('input[placeholder="Code"]', code)
  await pageB.click('button:has-text("Continue")')

  await pageA.click('button:has-text("Start")')
  await expect(pageA.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })

  await pageB.click('button[aria-label="Leave Room"]')
  await pageB.getByRole('button', { name: 'Leave', exact: true }).click()
  await expect(pageB.locator('button:has-text("Multiplayer")')).toBeVisible({ timeout: 5000 })
})

test('host adds a bot, starts, and the bot auto-plays', async ({ browser }) => {
  const context = await browser.newContext()
  await context.addInitScript(() => {
    localStorage.setItem('monopoly-language', 'en')
    localStorage.setItem('monopoly-currency', 'USD')
  })
  const page = await context.newPage()

  await page.goto(`http://localhost:${PORT}/`)
  await page.click('button:has-text("Multiplayer")')
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
    const pay = page.locator('button:has-text("Pay")').first()
    if (await pay.isVisible({ timeout: 500 }).catch(() => false)) { await pay.click(); continue }
    const end = page.locator('button:has-text("End")').first()
    if (await end.isVisible({ timeout: 500 }).catch(() => false)) { await end.click(); continue }
    break
  }

  // The bot seat is now current and auto-plays; verify control returns to the host.
  await expect(waitingFor).toContainText('Droid', { timeout: 10000 })
  await expect(page.locator('button:has-text("Roll")').first()).toBeVisible({ timeout: 30000 })
})
