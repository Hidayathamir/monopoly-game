// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import TradeModal from '../Modals/TradeModal'
import { renderWithProviders } from '../../test/test-utils'
import { gameReducer, createInitialState } from '../../logic/gameReducer'
import { GameActionType, type GameState } from '../../types/game'

function makeState(): GameState {
  return gameReducer(createInitialState(), { type: GameActionType.StartGame, playerCount: 2, names: ['Alice', 'Bob'] })
}

function makeStateWithRecipientProperties(): GameState {
  const s = makeState()
  return {
    ...s,
    board: s.board.map((b) => (b.id === 1 ? { ...b, owner: 0 } : b.id === 3 ? { ...b, owner: 1 } : b)),
    players: s.players.map((p, i) => (i === 1 ? { ...p, properties: [3] } : p)),
  }
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

  it("renders the recipient's tradeable properties as request checkboxes", () => {
    renderWithProviders(<TradeModal state={makeStateWithRecipientProperties()} targetPlayerId={1} onPropose={() => {}} onClose={() => {}} />)
    expect(screen.getByText('You request:')).toBeVisible()
    expect(screen.getByRole('checkbox', { name: /Rio/ })).toBeTruthy()
  })

  it('includes the selected request property in the proposed offer', () => {
    const onPropose = vi.fn()
    renderWithProviders(<TradeModal state={makeStateWithRecipientProperties()} targetPlayerId={1} onPropose={onPropose} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('checkbox', { name: /Rio/ }))
    screen.getByRole('button', { name: /Propose/i }).click()
    expect(onPropose).toHaveBeenCalledWith(expect.objectContaining({ requestProperties: [3] }))
  })
})
