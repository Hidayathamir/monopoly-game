import { expect, type Locator, type Page } from '@playwright/test'

const SETTLE_TIMEOUT = 10_000
const ACTION_TIMEOUT = 5_000
const IDLE_TICK_MS = 250
const MAX_IDLE_TICKS = 40

export interface PlayHostTurnsOptions {
  stopOnWaitingFor?: boolean
}

interface HostButtons {
  roll: Locator
  buy: Locator
  no: Locator
  draw: Locator
  ok: Locator
  pay: Locator
  build: Locator
}

export async function playHostTurns(page: Page, maxLoops: number, opts: PlayHostTurnsOptions = {}): Promise<void> {
  const waitingFor = page.locator('[data-testid="waiting-for"]')
  const buttons: HostButtons = {
    roll: page.locator('[data-testid="dice-roller"] button').first(),
    buy: page.locator('button:has-text("Buy (")').first(),
    no: page.locator('button:has-text("No")').first(),
    draw: page.locator('button:has-text("Draw")').first(),
    ok: page.locator('button:has-text("OK")').first(),
    pay: page.locator('button:has-text("Pay")').first(),
    build: page.locator('button:has-text("Build")').first(),
  }

  const visible = (locator: Locator): Promise<boolean> => locator.isVisible().catch(() => false)
  const settleHidden = (locator: Locator): Promise<void> =>
    expect(locator).toBeHidden({ timeout: SETTLE_TIMEOUT }).catch(() => {})

  async function playOneAction(): Promise<boolean> {
    if (await visible(buttons.roll)) {
      await buttons.roll.click({ timeout: ACTION_TIMEOUT })
      await settleHidden(buttons.roll)
      return true
    }
    if (await visible(buttons.buy)) {
      if (await buttons.buy.isEnabled()) {
        await buttons.buy.click({ timeout: ACTION_TIMEOUT })
      } else {
        await buttons.no.click({ timeout: ACTION_TIMEOUT })
      }
      await settleHidden(buttons.buy)
      return true
    }
    if (await visible(buttons.no)) {
      await buttons.no.click({ timeout: ACTION_TIMEOUT })
      await settleHidden(buttons.no)
      return true
    }
    if (await visible(buttons.draw)) {
      await settleHidden(buttons.draw)
      return true
    }
    if (await visible(buttons.ok)) {
      await buttons.ok.click({ timeout: ACTION_TIMEOUT })
      await settleHidden(buttons.ok)
      return true
    }
    if (await visible(buttons.pay)) {
      await buttons.pay.click({ timeout: ACTION_TIMEOUT })
      await settleHidden(buttons.pay)
      return true
    }
    if (await visible(buttons.build) && await buttons.build.isEnabled()) {
      await buttons.build.click({ timeout: ACTION_TIMEOUT })
      await settleHidden(buttons.build)
      return true
    }
    return false
  }

  let actions = 0
  let idleTicks = 0
  while (actions < maxLoops) {
    if (await visible(waitingFor)) {
      if (opts.stopOnWaitingFor) break
      await settleHidden(waitingFor)
      idleTicks = 0
      continue
    }
    if (await playOneAction()) {
      actions++
      idleTicks = 0
      continue
    }
    if (idleTicks >= MAX_IDLE_TICKS) break
    idleTicks++
    await page.waitForTimeout(IDLE_TICK_MS)
  }
}
