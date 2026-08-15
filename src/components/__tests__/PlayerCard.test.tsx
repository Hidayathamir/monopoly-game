// @vitest-environment jsdom
import { screen, cleanup } from '@testing-library/react'
import { afterEach, describe, it, expect } from 'vitest'
import PlayerCard from '../PlayerCard'
import { renderWithProviders } from '../../test/test-utils'
import type { Player, Space } from '../../types/game'

const player: Player = {
  id: 0, name: 'Alpha', money: 15000, position: 0, properties: [],
  passedGo: false, inJail: false, jailTurns: 0, bankrupt: false, hasGetOutOfJailFree: false,
}
const board: Space[] = []

afterEach(cleanup)

describe('PlayerCard', () => {
  it('shows the player money', () => {
    renderWithProviders(<PlayerCard player={player} isCurrent={false} color="#E74C3C" diff={null} board={board} />)
    expect(screen.getByText(/\$/)).toBeTruthy()
  })

  it('shows a free-jail badge when the player holds the card', () => {
    renderWithProviders(<PlayerCard player={{ ...player, hasGetOutOfJailFree: true }} isCurrent={false} color="#E74C3C" diff={null} board={board} />)
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
