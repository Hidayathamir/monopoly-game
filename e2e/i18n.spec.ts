import { test, expect } from '@playwright/test'

test('defaults to Indonesian and toggles to English', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Mulai Permainan')).toBeVisible()
  await page.getByRole('button', { name: 'Pengaturan' }).click()
  await page.getByLabel('Bahasa').selectOption('en')
  await expect(page.getByText('Start Game')).toBeVisible()
})

test('currency defaults to IDR and toggles money symbol', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('player-count').selectOption('2')
  await page.locator('input[type="text"]').nth(0).fill('Alpha')
  await page.locator('input[type="text"]').nth(1).fill('Beta')
  await page.getByRole('button', { name: 'Mulai Permainan' }).click()
  await expect(page.locator('[data-testid="player-card"]').first()).toContainText('Rp')
  await page.getByRole('button', { name: 'Pengaturan' }).click()
  await page.getByLabel('Mata Uang').selectOption('USD')
  await expect(page.locator('[data-testid="player-card"]').first()).toContainText('$')
})
