// @vitest-environment jsdom
import { screen, cleanup } from '@testing-library/react'
import { afterEach, describe, it, expect } from 'vitest'
import '@testing-library/jest-dom/vitest'
import CardModal from '../Modals/CardModal'
import { renderWithProviders } from '../../test/test-utils'
import { gameReducer, createInitialState } from '../../logic/gameReducer'
import { GameActionType, PendingActionType, type GameState } from '../../types/game'

function makeState(): GameState {
  const s = gameReducer(createInitialState(), { type: GameActionType.StartGame, playerCount: 2, names: ['Alice', 'Bob'] })
  return { ...s, pendingAction: { type: PendingActionType.CardEffect, card: { id: 0, type: 'chance', effect: { action: 'collect', amount: 50 } } } }
}

afterEach(cleanup)

describe('CardModal', () => {
  it('shows OK for the current player', () => {
    renderWithProviders(<CardModal state={makeState()} isMyTurn={true} onResolve={() => {}} />)
    expect(screen.getByRole('button', { name: 'OK' })).toBeVisible()
  })

  it('hides OK and shows a waiting note for other players', () => {
    renderWithProviders(<CardModal state={makeState()} isMyTurn={false} onResolve={() => {}} />)
    expect(screen.queryByRole('button', { name: 'OK' })).toBeNull()
    expect(screen.getByText(/Waiting for/)).toBeVisible()
  })
})
