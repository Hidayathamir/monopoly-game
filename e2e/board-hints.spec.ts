import { test, expect } from './fixtures'
import { seedWaitingGame } from './helpers/seed'

test.describe('Board token highlight and dice hints', () => {
  test('shows dice hint badges during aiming phase and hides after rolling', async ({ browser, serverUrl }) => {
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

    // Dice hints should be visible during aiming phase
    await expect(page.locator('[data-testid="dice-hints"]')).toBeVisible({ timeout: 5000 })

    // Should have 11 hints (values 2-12)
    const hints = page.locator('[data-testid^="dice-hint-"]')
    await expect(hints).toHaveCount(11)

    // Roll the dice
    await page.click('button:has-text("Roll")')

    // Dice hints should disappear after rolling
    await expect(page.locator('[data-testid="dice-hints"]')).not.toBeVisible({ timeout: 5000 })
  })

  test('current player token is larger than other tokens', async ({ browser, serverUrl }) => {
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

    // The current player's token should have the larger size class (z-20, 28px)
    // The other player's token should have the smaller size class (z-10, 22px)
    // Seed sets currentPlayer: 0 (Host), so Host gets the larger token
    // Use :scope > to match only direct child divs (the board tokens), not nested Avatars
    const hostToken = page.locator('.absolute.rounded-full[title="Host"]')
    await expect(hostToken).toHaveClass(/z-20/)
    await expect(hostToken).toHaveClass(/w-\[28px\]/)

    const droidToken = page.locator('.absolute.rounded-full[title="Droid"]')
    await expect(droidToken).toHaveClass(/z-10/)
    await expect(droidToken).toHaveClass(/w-\[22px\]/)
  })
})
