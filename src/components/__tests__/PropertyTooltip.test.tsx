// @vitest-environment jsdom
import { screen, cleanup } from '@testing-library/react'
import { afterEach, describe, it, expect } from 'vitest'
import '@testing-library/jest-dom/vitest'
import PropertyTooltip from '../PropertyTooltip'
import { gameReducer, createInitialState } from '../../logic/gameReducer'
import { GameActionType, type GameState, type Space } from '../../types/game'
import { renderWithProviders } from '../../test/test-utils'

function makeState(money: number): GameState {
  const s = gameReducer(createInitialState(), { type: GameActionType.StartGame, playerCount: 2, names: ['Alice', 'Bob'] })
  return { ...s, players: s.players.map((p, i) => i === 0 ? { ...p, money, properties: [8] } : p) }
}

afterEach(cleanup)

const mortgagedSpace: Space = {
  id: 8, type: 'property', price: 100, owner: 0,
  houses: 0, mortgaged: true,
}

describe('PropertyTooltip', () => {
  it('disables Redeem when money is insufficient', () => {
    renderWithProviders(<PropertyTooltip space={mortgagedSpace} state={makeState(1)} onSell={() => {}} onMortgage={() => {}} onUnmortgage={() => {}} onSellProperty={() => {}} />)
    expect(screen.getByRole('button', { name: /Redeem/ })).toBeDisabled()
  })

  it('enables Redeem when money is sufficient', () => {
    renderWithProviders(<PropertyTooltip space={mortgagedSpace} state={makeState(100)} onSell={() => {}} onMortgage={() => {}} onUnmortgage={() => {}} onSellProperty={() => {}} />)
    expect(screen.getByRole('button', { name: /Redeem/ })).toBeEnabled()
  })

  it('shows monopoly 2x notice when owner has full color group with no houses', () => {
    const s = makeState(100)
    const board = s.board.map((b) => {
      if (b.color === '#8B4513' && b.type === 'property') return { ...b, owner: 0 }
      return b
    })
    const space = { ...board[1], houses: 0, owner: 0 }
    renderWithProviders(<PropertyTooltip space={space} state={{ ...s, board }} onSell={() => {}} onMortgage={() => {}} onUnmortgage={() => {}} onSellProperty={() => {}} />)
    expect(screen.getByText(/Complete group/)).toBeTruthy()
  })

  it('shows 75% payout on unmortgaged Sell to Bank button', () => {
    const space: Space = { ...mortgagedSpace, mortgaged: false }
    renderWithProviders(<PropertyTooltip space={space} state={makeState(100)} onSell={() => {}} onMortgage={() => {}} onUnmortgage={() => {}} onSellProperty={() => {}} />)
    expect(screen.getByRole('button', { name: /Sell to Bank/ }).textContent).toContain('75')
  })

  it('renders Sell to Bank button on mortgaged property with 10% payout', () => {
    renderWithProviders(<PropertyTooltip space={mortgagedSpace} state={makeState(100)} onSell={() => {}} onMortgage={() => {}} onUnmortgage={() => {}} onSellProperty={() => {}} />)
    expect(screen.getByRole('button', { name: /Sell to Bank/ }).textContent).toContain('10')
  })

  it('shows 75% payout on house sell button', () => {
    const space: Space = { ...mortgagedSpace, mortgaged: false, houses: 2, houseCost: [25, 50] }
    renderWithProviders(<PropertyTooltip space={space} state={makeState(100)} onSell={() => {}} onMortgage={() => {}} onUnmortgage={() => {}} onSellProperty={() => {}} />)
    expect(screen.getByRole('button', { name: /Sell House/ }).textContent).toContain('37')
  })
})
