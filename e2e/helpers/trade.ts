import { expect, type Browser, type Page } from '@playwright/test'

export const ALPHA_STRIPE = 'rgb(231, 76, 60)'
export const BRAVO_STRIPE = 'rgb(52, 152, 219)'
export const CHARLIE_STRIPE = 'rgb(46, 204, 113)'
// Droid sits at player id 1, so createSeededState colors it PLAYER_COLORS[1] — the color comes from the generated seed, not a bot-specific palette.
export const DROID_STRIPE = 'rgb(52, 152, 219)'

export async function makePage(browser: Browser): Promise<Page> {
  const context = await browser.newContext()
  await context.addInitScript(() => {
    localStorage.setItem('monopoly-language', 'en')
    localStorage.setItem('monopoly-currency', 'USD')
  })
  return context.newPage()
}

export async function createRoom(page: Page, url: string, name: string): Promise<string> {
  await page.goto(url)
  await page.fill('input[placeholder="Name"]', name)
  await page.click('button:has-text("Continue")')
  const codeLocator = page.locator('[data-testid="room-code"]')
  await expect(codeLocator).not.toHaveText('—', { timeout: 5000 })
  return (await codeLocator.innerText()).trim()
}

export async function joinByCode(page: Page, url: string, code: string, name: string): Promise<void> {
  await page.goto(url)
  await page.fill('input[placeholder="Name"]', name)
  await page.click('button:has-text("Join Room")')
  await page.fill('input[placeholder="Code"]', code)
  await page.click('button:has-text("Continue")')
}

export async function joinRoom(host: Page, guest: Page, serverUrl: string): Promise<string> {
  const code = await createRoom(host, serverUrl, 'Alpha')
  await joinByCode(guest, serverUrl, code, 'Bravo')
  await expect(host.locator('text=Bravo')).toBeVisible({ timeout: 5000 })
  return code
}

export async function joinThree(host: Page, pageB: Page, pageC: Page, serverUrl: string): Promise<string> {
  const code = await createRoom(host, serverUrl, 'Alpha')
  await joinByCode(pageB, serverUrl, code, 'Bravo')
  await expect(host.locator('text=Bravo')).toBeVisible({ timeout: 5000 })
  await joinByCode(pageC, serverUrl, code, 'Charlie')
  await expect(host.locator('text=Charlie')).toBeVisible({ timeout: 5000 })
  return code
}

export async function addBot(page: Page): Promise<void> {
  await page.click('button:has-text("Add Bot")')
  await expect(page.locator('text=Droid')).toBeVisible()
}

export async function openTradeModal(page: Page, targetCardText: string): Promise<void> {
  const card = page.locator('[data-testid="player-card"]').filter({ hasText: targetCardText })
  // Park the pointer off the player row so any popup from a previous hover
  // closes, then move straight to the card in a single pointer step so sibling
  // cards' popups never open and cover the target (a multi-step hover path
  // across the row would open the wrong popup and swallow the hover).
  await page.mouse.move(0, 0)
  await page.waitForTimeout(250)
  const box = await card.boundingBox()
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  } else {
    await card.hover()
  }
  const tradeBtn = page.getByRole('button', { name: /^🤝 Trade$/ })
  await expect(tradeBtn).toBeVisible({ timeout: 5000 })
  await tradeBtn.hover()
  await tradeBtn.click()
  await expect(page.getByRole('heading', { name: /^🤝 Trade$/ })).toBeVisible({ timeout: 5000 })
}
