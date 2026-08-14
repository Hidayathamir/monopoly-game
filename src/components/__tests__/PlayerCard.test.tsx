// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import PlayerCard from '../PlayerCard'
import type { Player, Space } from '../../types/game'

const player: Player = {
  id: 0, name: 'Alpha', money: 15000, position: 0, properties: [],
  passedGo: false, inJail: false, jailTurns: 0, bankrupt: false, hasGetOutOfJailFree: false,
}
const board: Space[] = []

describe('PlayerCard', () => {
  it('shows the player money', () => {
    render(<PlayerCard player={player} isCurrent={false} color="#E74C3C" diff={null} board={board} />)
    expect(screen.getByText(/Rp/)).toBeTruthy()
  })
})
