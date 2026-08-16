// @vitest-environment jsdom
import { screen, cleanup, fireEvent, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, it, expect, vi } from 'vitest'
import type { ComponentProps } from 'react'
import PlayerCard from '../PlayerCard'
import { renderWithProviders } from '../../test/test-utils'
import type { Player, Space } from '../../types/game'

const player: Player = {
  id: 0, name: 'Alpha', money: 15000, position: 0, properties: [],
  passedGo: false, inJail: false, jailTurns: 0, bankrupt: false, getOutOfJailFreeCards: 0, isBot: false,
}
const board: Space[] = []

afterEach(cleanup)

describe('PlayerCard', () => {
  it('shows the player money', () => {
    renderWithProviders(<PlayerCard player={player} isCurrent={false} color="#E74C3C" diff={null} board={board} />)
    expect(screen.getByText(/\$/)).toBeTruthy()
  })

  it('shows a free-jail badge when the player holds the card', () => {
    renderWithProviders(<PlayerCard player={{ ...player, getOutOfJailFreeCards: 1 }} isCurrent={false} color="#E74C3C" diff={null} board={board} />)
    expect(screen.getByTitle('Get Out of Jail Free')).toBeTruthy()
  })

  it('does not show the free-jail badge by default', () => {
    renderWithProviders(<PlayerCard player={player} isCurrent={false} color="#E74C3C" diff={null} board={board} />)
    expect(screen.queryByTitle('Get Out of Jail Free')).toBeNull()
  })

  it('shows negative money in red and positive money in green', () => {
    renderWithProviders(<PlayerCard player={{ ...player, money: -5 }} isCurrent={false} color="#E74C3C" diff={null} board={board} />)
    const negativeDiv = screen.getByText(/-\$5/).closest('div')!
    expect(negativeDiv.className).toContain('text-red-danger')

    renderWithProviders(<PlayerCard player={{ ...player, money: 15000 }} isCurrent={false} color="#E74C3C" diff={null} board={board} />)
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
        color="#E74C3C"
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
})

describe('PlayerCard connection indicator', () => {
  it('shows the OFFLINE label and dims the card when disconnected', () => {
    renderWithProviders(<PlayerCard player={player} isCurrent={false} color="#E74C3C" diff={null} board={board} connected={false} />)
    const card = screen.getByTestId('player-card')
    expect(within(card).getByText('OFFLINE')).toBeTruthy()
    expect(card.className).toContain('opacity-50')
  })

  it('does not show the OFFLINE label when connected (default)', () => {
    renderWithProviders(<PlayerCard player={player} isCurrent={false} color="#E74C3C" diff={null} board={board} />)
    expect(screen.queryByText('OFFLINE')).toBeNull()
    expect(screen.getByTestId('player-card').className).not.toContain('opacity-50')
  })
})
