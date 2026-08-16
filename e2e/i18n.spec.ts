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
