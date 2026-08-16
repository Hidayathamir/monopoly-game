// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import TradeModal from '../Modals/TradeModal'
import { renderWithProviders } from '../../test/test-utils'
import { gameReducer, createInitialState } from '../../logic/gameReducer'
import { GameActionType, type GameState } from '../../types/game'

function makeState(): GameState {
  return gameReducer(createInitialState(), { type: GameActionType.StartGame, playerCount: 2, names: ['Alice', 'Bob'] })
}

afterEach(cleanup)

describe('TradeModal', () => {
  it('locks the target player and omits the dropdown when targetPlayerId is set', () => {
    const onPropose = vi.fn()
    renderWithProviders(
      <TradeModal state={makeState()} targetPlayerId={1} onPropose={onPropose} onClose={() => {}} />,
    )
    expect(screen.getByText('Bob')).toBeVisible()
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('proposes the trade to the locked target player', () => {
    const onPropose = vi.fn()
    renderWithProviders(
      <TradeModal state={makeState()} targetPlayerId={1} onPropose={onPropose} onClose={() => {}} />,
    )
    screen.getByRole('button', { name: /Propose/i }).click()
    expect(onPropose).toHaveBeenCalledWith(expect.objectContaining({ toId: 1 }))
  })
})
