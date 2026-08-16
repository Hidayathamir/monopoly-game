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
