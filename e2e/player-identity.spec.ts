import { test, expect } from './fixtures'
import { PLAYER_COLORS } from '../src/data/players'
import { PRESET_AVATARS, PRESET_EMOJI } from '../src/data/avatars'

const CHOSEN_COLOR = PLAYER_COLORS[1]
const CHOSEN_AVATAR = PRESET_AVATARS.Dog
const CHOSEN_EMOJI = PRESET_EMOJI[CHOSEN_AVATAR]

function hexToRgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`
}

async function newIdentityContext(browser: import('@playwright/test').Browser) {
  const context = await browser.newContext()
  await context.addInitScript(() => {
    localStorage.setItem('monopoly-language', 'en')
    localStorage.setItem('monopoly-currency', 'USD')
  })
  return context
}

test('host identity is shared cross-device and reflected on the board', async ({ browser, serverUrl }) => {
  const contextA = await newIdentityContext(browser)
  const pageA = await contextA.newPage()
  await pageA.goto(serverUrl)
  await pageA.fill('input[placeholder="Name"]', 'Host')
  await pageA.click('button:has-text("Continue")')

  const codeLocator = pageA.locator('[data-testid="room-code"]')
  await expect(codeLocator).not.toHaveText('—', { timeout: 5000 })
  const code = (await codeLocator.innerText()).trim()

  // The lobby exposes the identity panel with color and avatar pickers.
  await expect(pageA.locator('[data-testid="color-picker"]')).toBeVisible()
  await expect(pageA.locator('[data-testid="avatar-picker"]')).toBeVisible()

  // Pick a non-default color and avatar; the round-trip updates the selection.
  const swatch = pageA.locator(`[data-testid="color-swatch"][aria-label*="${CHOSEN_COLOR}"]`)
  await swatch.click()
  await expect(swatch).toHaveClass(/ring-gold/, { timeout: 5000 })
  const avatar = pageA.locator(`[data-testid="avatar-option"][aria-label*="${CHOSEN_AVATAR}"]`)
  await avatar.click()
  await expect(avatar).toHaveClass(/ring-gold/, { timeout: 5000 })

  // The host stays in the lobby with no error, and its row shows the choices.
  await expect(codeLocator).toBeVisible()
  const hostRow = pageA.locator('div.flex.items-center.gap-2').filter({ hasText: 'Host' })
  await expect(hostRow.locator('span').nth(2)).toHaveText(CHOSEN_EMOJI)
  await expect(hostRow.locator('span').first()).toHaveCSS('background-color', hexToRgb(CHOSEN_COLOR))

  // A second device joins with the room code and sees the host's identity.
  const contextB = await newIdentityContext(browser)
  const pageB = await contextB.newPage()
  await pageB.goto(serverUrl)
  await pageB.fill('input[placeholder="Name"]', 'Tamu')
  await pageB.click('button:has-text("Join Room")')
  await pageB.fill('input[placeholder="Code"]', code)
  await pageB.click('button:has-text("Continue")')
  await expect(pageA.locator('text=Tamu')).toBeVisible({ timeout: 5000 })

  const hostRowB = pageB.locator('div.flex.items-center.gap-2').filter({ hasText: 'Host' })
  await expect(hostRowB.locator('span').nth(2)).toHaveText(CHOSEN_EMOJI, { timeout: 5000 })
  await expect(hostRowB.locator('span').first()).toHaveCSS('background-color', hexToRgb(CHOSEN_COLOR))

  // Start the game; the host's player card reflects the chosen color and avatar.
  await pageA.click('button:has-text("Start")')
  const hostCard = pageA.locator('[data-testid="player-card"]').filter({ hasText: 'Host' })
  await expect(hostCard).toBeVisible({ timeout: 5000 })
  await expect(hostCard).toHaveCSS('border-left-color', hexToRgb(CHOSEN_COLOR))
  await expect(hostCard.getByTitle('Host')).toHaveText(CHOSEN_EMOJI)

  // The host's board token reflects the chosen color and avatar.
  const hostToken = pageA.locator('[data-game-board]').getByTitle('Host').first()
  await expect(hostToken).toBeVisible({ timeout: 5000 })
  await expect(hostToken).toHaveCSS('background-color', hexToRgb(CHOSEN_COLOR))
  await expect(hostToken).toHaveText(CHOSEN_EMOJI)
})

test('host can pick a custom hex color and it round-trips to the board', async ({ browser, serverUrl }) => {
  const contextA = await newIdentityContext(browser)
  const pageA = await contextA.newPage()
  await pageA.goto(serverUrl)
  await pageA.fill('input[placeholder="Name"]', 'Host')
  await pageA.click('button:has-text("Continue")')

  const codeLocator = pageA.locator('[data-testid="room-code"]')
  await expect(codeLocator).not.toHaveText('—', { timeout: 5000 })
  const code = (await codeLocator.innerText()).trim()

  const CUSTOM = '#123abc'
  const colorInput = pageA.locator('[data-testid="color-custom"]')
  await expect(colorInput).toBeVisible()
  await colorInput.evaluate((el, val) => {
    const input = el as HTMLInputElement
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
    setter.call(input, val)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }, CUSTOM)
  await expect(colorInput).toHaveValue(CUSTOM, { timeout: 5000 })

  const hostRow = pageA.locator('div.flex.items-center.gap-2').filter({ hasText: 'Host' })
  await expect(hostRow.locator('span').first()).toHaveCSS('background-color', hexToRgb(CUSTOM))

  const contextB = await newIdentityContext(browser)
  const pageB = await contextB.newPage()
  await pageB.goto(serverUrl)
  await pageB.fill('input[placeholder="Name"]', 'Tamu')
  await pageB.click('button:has-text("Join Room")')
  await pageB.fill('input[placeholder="Code"]', code)
  await pageB.click('button:has-text("Continue")')
  await expect(pageA.locator('text=Tamu')).toBeVisible({ timeout: 5000 })

  const hostRowB = pageB.locator('div.flex.items-center.gap-2').filter({ hasText: 'Host' })
  await expect(hostRowB.locator('span').first()).toHaveCSS('background-color', hexToRgb(CUSTOM))

  await pageA.click('button:has-text("Start")')
  const hostCard = pageA.locator('[data-testid="player-card"]').filter({ hasText: 'Host' })
  await expect(hostCard).toBeVisible({ timeout: 5000 })
  await expect(hostCard).toHaveCSS('border-left-color', hexToRgb(CUSTOM))
  const hostToken = pageA.locator('[data-game-board]').getByTitle('Host').first()
  await expect(hostToken).toBeVisible({ timeout: 5000 })
  await expect(hostToken).toHaveCSS('background-color', hexToRgb(CUSTOM))
})

test('an avatar already taken by another player cannot be selected', async ({ browser, serverUrl }) => {
  const contextA = await newIdentityContext(browser)
  const pageA = await contextA.newPage()
  await pageA.goto(serverUrl)
  await pageA.fill('input[placeholder="Name"]', 'Host')
  await pageA.click('button:has-text("Continue")')

  const codeLocator = pageA.locator('[data-testid="room-code"]')
  await expect(codeLocator).not.toHaveText('—', { timeout: 5000 })
  const code = (await codeLocator.innerText()).trim()

  const dog = pageA.locator(`[data-testid="avatar-option"][aria-label*="${PRESET_AVATARS.Dog}"]`)
  await dog.click()
  await expect(dog).toHaveClass(/ring-gold/, { timeout: 5000 })

  const contextB = await newIdentityContext(browser)
  const pageB = await contextB.newPage()
  await pageB.goto(serverUrl)
  await pageB.fill('input[placeholder="Name"]', 'Tamu')
  await pageB.click('button:has-text("Join Room")')
  await pageB.fill('input[placeholder="Code"]', code)
  await pageB.click('button:has-text("Continue")')
  await expect(pageA.locator('text=Tamu')).toBeVisible({ timeout: 5000 })

  const dogB = pageB.locator(`[data-testid="avatar-option"][aria-label*="${PRESET_AVATARS.Dog}"]`)
  await expect(dogB).toBeDisabled()
})
