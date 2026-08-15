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

test('two clients join and start a game', async ({ browser }) => {
  const pageA = await browser.newPage()
  const pageB = await browser.newPage()

  await pageA.goto(`http://localhost:${PORT}/`)
  await pageA.click('button:has-text("Multiplayer")')
  await pageA.fill('input[placeholder="Nama"]', 'Host')
  await pageA.click('button:has-text("Masuk")')

  await pageB.goto(`http://localhost:${PORT}/`)
  await pageB.click('button:has-text("Multiplayer")')
  await pageB.fill('input[placeholder="Nama"]', 'Tamu')
  await pageB.click('button:has-text("Masuk")')

  await expect(pageA.locator('text=Tamu')).toBeVisible({ timeout: 5000 })

  await pageA.click('button:has-text("Mulai")')
  await expect(pageA.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })
  await expect(pageB.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 5000 })
})
