import { test, expect } from './fixtures'
import { seedGame } from './helpers/seed'
import { INITIAL_BOARD } from './fixtures/initial-state'
import { PLAYER_COLORS } from '../src/data/players'
import { DEFAULT_AVATAR } from '../src/data/avatars'
import {
  GamePhase, PendingActionType, CardActionType, SpaceType,
  type GameState, type Space, type Card,
} from '../src/types/game'

// Mirrors `MAX_HOUSES` in src/data/board.ts (that module pulls in board-data.json,
// which Playwright's loader cannot resolve, so the value is pinned here).
const MAX_HOUSES = 5

interface BotTurnOptions {
  unowned: number
  houses: number
  money: number
}

async function seedBotBuildTurn(url: string, code: string, opts: BotTurnOptions): Promise<void> {
  const target = INITIAL_BOARD.find((s) => s.type === SpaceType.Property && s.color === '#8B4513')
  if (!target) throw new Error('no brown property')

  // Ownership: the bot (player 1) owns the brown target it stands on; the host
  // (player 0) owns the rest of the buyable spaces except `unowned` of them.
  const board: Space[] = INITIAL_BOARD.map((s) => ({ ...s, owner: null }))
  board[target.id] = { ...target, owner: 1, houses: opts.houses }
  const buyable = board.filter((s) =>
    [SpaceType.Property, SpaceType.Railroad, SpaceType.Utility].includes(s.type),
  )
  let hostOwned = buyable.length - opts.unowned - 1
  for (const s of buyable) {
    if (s.id === target.id) continue
    if (hostOwned > 0) {
      board[s.id] = { ...s, owner: 0 }
      hostOwned--
    }
  }
  const botProps = board.filter((s) => s.owner === 1).map((s) => s.id)
  const hostProps = board.filter((s) => s.owner === 0).map((s) => s.id)

  // The seed validator forbids a `Waiting` state with dice set. Seed the bot in
  // `Resolving` with a harmless collect card pending instead: driveBots resolves
  // the card, which drops into the buildable `Waiting` + dice state with no
  // position change (reducer `ResolveCard` keeps dice, `builtThisStop`, etc.).
  const collectCard: Card = { id: 5, type: 'chance', effect: { action: CardActionType.Collect, amount: 50 } }

  const state: GameState = {
    phase: GamePhase.Resolving,
    players: [
      { id: 0, name: 'Host', money: 1500, position: 0, properties: hostProps, passedGo: true, inJail: false, jailTurns: 0, bankrupt: false, getOutOfJailFreeCards: 0, isBot: false, botControlled: false, afk: false, color: PLAYER_COLORS[0], avatar: DEFAULT_AVATAR },
      { id: 1, name: 'Droid', money: opts.money, position: target.id, properties: botProps, passedGo: true, inJail: false, jailTurns: 0, bankrupt: false, getOutOfJailFreeCards: 0, isBot: true, botControlled: false, afk: false, color: PLAYER_COLORS[1], avatar: DEFAULT_AVATAR },
    ],
    turnOrder: [1, 0],
    currentPlayer: 1,
    board,
    chanceDeck: [],
    communityDeck: [],
    freeParkingPot: 0,
    dice: [3, 4] as [number, number],
    doublesCount: 0,
    lastMoveSteps: null,
    eventLog: [],
    pendingAction: { type: PendingActionType.CardEffect, card: collectCard },
    justBoughtSpaceId: null,
    builtThisStop: false,
    reconnectGrace: null,
    pendingTrades: [],
    nextTradeId: 0,
    tradesEnabled: false,
  }
  await seedGame(url, code, state)
}

async function createHostPage(browser: import('@playwright/test').Browser, url: string): Promise<import('@playwright/test').Page> {
  const context = await browser.newContext()
  await context.addInitScript(() => {
    localStorage.setItem('monopoly-language', 'en')
    localStorage.setItem('monopoly-currency', 'USD')
  })
  const page = await context.newPage()
  await page.goto(url)
  await page.fill('input[placeholder="Name"]', 'Host')
  await page.click('button:has-text("Continue")')
  // The seeded state has 2 players, so the room must have 2 joined slots. The
  // host adds a bot ("Droid") at slot 1; the seed then replaces the whole state.
  await page.click('button:has-text("Add Bot")')
  await expect(page.locator('text=Droid')).toBeVisible({ timeout: 5000 })
  return page
}

test('bot builds multiple houses in one turn on scarce land', async ({ browser, serverUrl }) => {
  const page = await createHostPage(browser, serverUrl)
  const codeLocator = page.locator('[data-testid="room-code"]')
  await expect(codeLocator).not.toHaveText('—', { timeout: 5000 })
  const code = (await codeLocator.innerText()).trim()

  // Scarce land: only 6 buyable spaces unowned. Bot (Droid) is current, standing on
  // brown property 1 (houses: 0), with 100000 cash → should build up to MAX_HOUSES.
  await seedBotBuildTurn(serverUrl, code, { unowned: 6, houses: 0, money: 100000 })

  // The bot auto-plays its whole turn. The 5th build turns the property into a
  // hotel, so the log shows 4 "built a house" + 1 "built a hotel" on Salvador.
  // EventLog renders only the last 2 entries, so expand it before counting.
  const hotel = page.locator('[data-testid="event-entry"]').filter({ hasText: 'built a hotel on Salvador' })
  await expect(hotel).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: /Full history/ }).click()
  const log = page.locator('[data-testid="event-entry"]').filter({ hasText: /built a (house|hotel) on Salvador/ })
  await expect(log).toHaveCount(MAX_HOUSES, { timeout: 10000 })
})

test('bot builds exactly once on non-scarce land', async ({ browser, serverUrl }) => {
  const page = await createHostPage(browser, serverUrl)
  const codeLocator = page.locator('[data-testid="room-code"]')
  await expect(codeLocator).not.toHaveText('—', { timeout: 5000 })
  const code = (await codeLocator.innerText()).trim()

  // Not scarce: 7 buyable spaces unowned. Same standing/budget otherwise.
  await seedBotBuildTurn(serverUrl, code, { unowned: 7, houses: 0, money: 100000 })

  const log = page.locator('[data-testid="event-entry"]').filter({ hasText: 'built a house on Salvador' })
  await expect(log.first()).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: /Full history/ }).click()
  await expect(log).toHaveCount(1, { timeout: 10000 })
})
