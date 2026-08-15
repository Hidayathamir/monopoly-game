import { test, expect } from '@playwright/test'

test('defaults to English and toggles to Indonesian', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Start Game')).toBeVisible()
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByLabel('Language').selectOption('id')
  await expect(page.getByText('Mulai Permainan')).toBeVisible()
})

test('currency toggle switches money symbol', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('player-count').selectOption('2')
  await page.locator('input[placeholder^="Player"]').first().fill('Alpha')
  await page.locator('input[placeholder^="Player"]').nth(1).fill('Beta')
  await page.getByRole('button', { name: 'Start Game' }).click()
  await expect(page.locator('[data-testid="player-card"]').first()).toContainText('$')
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByLabel('Currency').selectOption('IDR')
  await expect(page.locator('[data-testid="player-card"]').first()).toContainText('Rp')
})
