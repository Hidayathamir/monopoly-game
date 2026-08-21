import { test, expect } from './fixtures'
import { seedWaitingGame } from './helpers/seed'

test('board city names are not clipped at phone viewport', async ({ browser, serverUrl }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  })
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
  const code = (await codeLocator.innerText()).trim()

  await seedWaitingGame(serverUrl, code, {
    players: [
      { id: 0, name: 'Host', money: 1500 },
      { id: 1, name: 'Droid', money: 1500, isBot: true },
    ],
    currentPlayer: 0,
  })

  await expect(page.locator('[data-testid="board-cell-1"]')).toBeVisible({ timeout: 5000 })

  const results = await page.$$eval('[data-testid^="board-cell-"] .cell-name', (names) =>
    names.map((el) => {
      const name = el as HTMLElement
      const cell = name.closest('[data-testid^="board-cell-"]') as HTMLElement
      const style = getComputedStyle(name)
      return {
        text: name.textContent,
        fontSize: style.fontSize,
        hOverflow: name.scrollWidth > cell.clientWidth + 1,
        vOverflow: name.scrollHeight > cell.clientHeight + 1,
      }
    }),
  )

  expect(results.length).toBe(40)
  const clipped = results.filter((r) => r.hOverflow || r.vOverflow)
  expect(clipped).toEqual([])
})
