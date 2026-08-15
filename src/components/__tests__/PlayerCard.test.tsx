// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, it, expect } from 'vitest'
import PlayerCard from '../PlayerCard'
import type { Player, Space } from '../../types/game'

const player: Player = {
  id: 0, name: 'Alpha', money: 15000, position: 0, properties: [],
  passedGo: false, inJail: false, jailTurns: 0, bankrupt: false, hasGetOutOfJailFree: false,
}
const board: Space[] = []

afterEach(cleanup)

describe('PlayerCard', () => {
  it('shows the player money', () => {
    render(<PlayerCard player={player} isCurrent={false} color="#E74C3C" diff={null} board={board} />)
    expect(screen.getByText(/Rp/)).toBeTruthy()
  })

  it('shows a free-jail badge when the player holds the card', () => {
    render(<PlayerCard player={{ ...player, hasGetOutOfJailFree: true }} isCurrent={false} color="#E74C3C" diff={null} board={board} />)
    expect(screen.getByTitle('Kartu Bebas Penjara')).toBeTruthy()
  })

  it('does not show the free-jail badge by default', () => {
    render(<PlayerCard player={player} isCurrent={false} color="#E74C3C" diff={null} board={board} />)
    expect(screen.queryByTitle('Kartu Bebas Penjara')).toBeNull()
  })
})
