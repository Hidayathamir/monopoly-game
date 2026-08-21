// @vitest-environment jsdom
import { screen, cleanup, fireEvent, within, act } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, it, expect, vi } from 'vitest'
import type { ComponentProps } from 'react'
import PlayerCard, { computePopupPosition } from '../PlayerCard'
import { renderWithProviders } from '../../test/test-utils'
import type { Player, Space } from '../../types/game'
import { PLAYER_COLORS } from '../../data/players'
import { DEFAULT_AVATAR } from '../../data/avatars'

const player: Player = {
  id: 0, name: 'Alpha', money: 15000, position: 0, properties: [],
  passedGo: false, inJail: false, jailTurns: 0, bankrupt: false, getOutOfJailFreeCards: 0, isBot: false, botControlled: false, afk: false,
  color: PLAYER_COLORS[0], avatar: DEFAULT_AVATAR,
}
const board: Space[] = []

afterEach(cleanup)

describe('PlayerCard', () => {
  it('shows the player money', () => {
    renderWithProviders(<PlayerCard player={player} isCurrent={false} diff={null} board={board} />)
    expect(screen.getByText(/\$/)).toBeTruthy()
  })

  it('shows a free-jail badge when the player holds the card', () => {
    renderWithProviders(<PlayerCard player={{ ...player, getOutOfJailFreeCards: 1 }} isCurrent={false} diff={null} board={board} />)
    expect(screen.getByTitle('Get Out of Jail Free')).toBeTruthy()
  })

  it('does not show the free-jail badge by default', () => {
    renderWithProviders(<PlayerCard player={player} isCurrent={false} diff={null} board={board} />)
    expect(screen.queryByTitle('Get Out of Jail Free')).toBeNull()
  })

  it('shows negative money in red and positive money in green', () => {
    renderWithProviders(<PlayerCard player={{ ...player, money: -5 }} isCurrent={false} diff={null} board={board} />)
    const negativeDiv = screen.getByText(/-\$5/).closest('div')!
    expect(negativeDiv.className).toContain('text-red-danger')

    renderWithProviders(<PlayerCard player={{ ...player, money: 15000 }} isCurrent={false} diff={null} board={board} />)
    const positiveDiv = screen.getByText(/\$15K/).closest('div')!
    expect(positiveDiv.className).toContain('text-green-money')
  })
})

describe('PlayerCard popup trade button', () => {
  const otherPlayer = { ...player, id: 1, name: 'Beta' }

  function openPopup(props: Partial<ComponentProps<typeof PlayerCard>> = {}) {
    renderWithProviders(
      <PlayerCard
        player={otherPlayer}
        isCurrent={false}
        diff={null}
        board={board}
        currentPlayerId={0}
        canTrade
        onProposeTrade={() => {}}
        {...props}
      />,
    )
    fireEvent.mouseEnter(screen.getByTestId('player-card'))
  }

  it('shows a Trade button in the popup for another player', () => {
    openPopup()
    expect(screen.getByRole('button', { name: /Trade/ })).toBeVisible()
  })

  it('hides the Trade button on your own card', () => {
    openPopup({ player, currentPlayerId: 0 })
    expect(screen.queryByRole('button', { name: /Trade/ })).toBeNull()
  })

  it('disables the Trade button when canTrade is false', () => {
    openPopup({ canTrade: false })
    expect(screen.getByRole('button', { name: /Trade/ })).toBeDisabled()
  })

  it('hides the Trade button when trades are disabled', () => {
    openPopup({ tradesEnabled: false })
    expect(screen.queryByRole('button', { name: /Trade/ })).toBeNull()
  })

  it('calls onProposeTrade with the hovered player id and closes the popup', () => {
    const onProposeTrade = vi.fn()
    openPopup({ onProposeTrade })
    fireEvent.click(screen.getByRole('button', { name: /Trade/ }))
    expect(onProposeTrade).toHaveBeenCalledWith(1)
    expect(screen.queryByRole('button', { name: /Trade/ })).toBeNull()
  })

  it('closes the popup when tapping outside the card', () => {
    openPopup()
    expect(screen.getByRole('button', { name: /Trade/ })).toBeVisible()
    act(() => {
      document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    })
    expect(screen.queryByRole('button', { name: /Trade/ })).toBeNull()
  })

  it('keeps the popup open when tapping inside the card', () => {
    openPopup()
    act(() => {
      screen.getByTestId('player-card').dispatchEvent(new Event('pointerdown', { bubbles: true }))
    })
    expect(screen.getByRole('button', { name: /Trade/ })).toBeVisible()
  })
})

describe('PlayerCard connection indicator', () => {
  it('shows the OFFLINE label and dims the card when disconnected', () => {
    renderWithProviders(<PlayerCard player={player} isCurrent={false} diff={null} board={board} connected={false} />)
    const card = screen.getByTestId('player-card')
    expect(within(card).getByText('OFFLINE')).toBeTruthy()
    expect(card.className).toContain('opacity-50')
  })

  it('does not show the OFFLINE label when connected (default)', () => {
    renderWithProviders(<PlayerCard player={player} isCurrent={false} diff={null} board={board} />)
    expect(screen.queryByText('OFFLINE')).toBeNull()
    expect(screen.getByTestId('player-card').className).not.toContain('opacity-50')
  })
})

describe('PlayerCard bot-control badge', () => {
  it('shows a bot-control badge when the player is bot-controlled', () => {
    renderWithProviders(<PlayerCard player={{ ...player, botControlled: true }} isCurrent={false} diff={null} board={board} />)
    expect(screen.getByText(/BOT/)).toBeTruthy()
  })

  it('does not show the bot-control badge by default', () => {
    renderWithProviders(<PlayerCard player={player} isCurrent={false} diff={null} board={board} />)
    expect(screen.queryByText(/BOT/)).toBeNull()
  })
})

describe('computePopupPosition', () => {
  const viewport = { width: 375, height: 667 }

  it('places the popup to the right of the card when there is room', () => {
    const rect = { left: 40, right: 150, top: 40 } as DOMRect
    const pos = computePopupPosition(rect, 200, 120, viewport)
    expect(pos.left).toBe(158)
    expect(pos.top).toBe(36)
  })

  it('flips to the left when the right side would overflow', () => {
    const rect = { left: 220, right: 300, top: 40 } as DOMRect
    const pos = computePopupPosition(rect, 200, 120, viewport)
    expect(pos.left).toBe(12)
    expect(pos.left).toBeLessThan(rect.left)
    expect(pos.top).toBe(36)
  })

  it('clamps into the viewport when there is no room on either side', () => {
    const rect = { left: 170, right: 205, top: 40 } as DOMRect
    const pos = computePopupPosition(rect, 200, 120, viewport)
    expect(pos.left).toBeGreaterThanOrEqual(8)
    expect(pos.left + 200).toBeLessThanOrEqual(375 - 8)
  })

  it('clamps the top so the popup stays fully on screen', () => {
    const rect = { left: 100, right: 260, top: 620 } as DOMRect
    const pos = computePopupPosition(rect, 200, 120, viewport)
    expect(pos.top).toBeLessThanOrEqual(667 - 120 - 8)
    expect(pos.top).toBeGreaterThanOrEqual(8)
  })
})
