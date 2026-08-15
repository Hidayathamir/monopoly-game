// @vitest-environment jsdom
import { screen, cleanup } from '@testing-library/react'
import { afterEach, describe, it, expect } from 'vitest'
import '@testing-library/jest-dom/vitest'
import BankruptcyModal from '../Modals/BankruptcyModal'
import { renderWithProviders } from '../../test/test-utils'
import { gameReducer, createInitialState } from '../../logic/gameReducer'
import { GameActionType, PendingActionType, type GameState } from '../../types/game'

function makeState(amount: number): GameState {
  const s = gameReducer(createInitialState(), { type: GameActionType.StartGame, playerCount: 2, names: ['Alice', 'Bob'] })
  return { ...s, pendingAction: { type: PendingActionType.Bankruptcy, amount, spaceId: 1 } }
}

afterEach(cleanup)

describe('BankruptcyModal', () => {
  it('shows action buttons for the current player', () => {
    renderWithProviders(<BankruptcyModal state={makeState(99999)} isMyTurn={true} onClose={() => {}} onBankruptcy={() => {}} />)
    expect(screen.getByRole('button', { name: /Declare Bankruptcy/ })).toBeVisible()
    expect(screen.getByRole('button', { name: /Close/ })).toBeVisible()
  })

  it('hides action buttons for other players', () => {
    renderWithProviders(<BankruptcyModal state={makeState(99999)} isMyTurn={false} onClose={() => {}} onBankruptcy={() => {}} />)
    expect(screen.queryByRole('button', { name: /Declare Bankruptcy/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Close/ })).toBeNull()
    expect(screen.getByText(/Waiting for/)).toBeVisible()
  })
})
