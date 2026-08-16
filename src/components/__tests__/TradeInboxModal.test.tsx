// @vitest-environment jsdom
import { cleanup, screen, fireEvent } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import TradeInboxModal from '../Modals/TradeInboxModal'
import { renderWithProviders } from '../../test/test-utils'
import { gameReducer, createInitialState } from '../../logic/gameReducer'
import { GameActionType, type GameState } from '../../types/game'

function makeStateWithTrades(): GameState {
  let state = gameReducer(createInitialState(), {
    type: GameActionType.StartGame,
    playerCount: 3,
    names: ['Alice', 'Bob', 'Charlie'],
  })
  state = {
    ...state,
    pendingTrades: [
      { id: 0, fromId: 0, toId: 1, offerProperties: [], offerCash: 50, requestProperties: [], requestCash: 0 },
      { id: 1, fromId: 2, toId: 0, offerProperties: [], offerCash: 0, requestProperties: [], requestCash: 100 },
    ],
  }
  return state
}

afterEach(cleanup)

describe('TradeInboxModal', () => {
  it('shows incoming offers with accept/reject and outgoing offers with cancel for a specific player', () => {
    const onAccept = vi.fn()
    const onReject = vi.fn()
    const onCancel = vi.fn()
    renderWithProviders(
      <TradeInboxModal state={makeStateWithTrades()} myPlayerId={0} onAccept={onAccept} onReject={onReject} onCancel={onCancel} onClose={() => {}} />,
    )
    // Trade 0 (from Alice to Bob) is not for us; trade 1 (from Charlie to Alice) is incoming; trade 0 is outgoing.
    expect(screen.getByText('Charlie')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Accept/ }))
    expect(onAccept).toHaveBeenCalledWith(1)
    fireEvent.click(screen.getAllByRole('button', { name: /Cancel/ })[0])
    expect(onCancel).toHaveBeenCalledWith(0)
  })

  it('shows a no-offers message when the inbox is empty', () => {
    const state = gameReducer(createInitialState(), {
      type: GameActionType.StartGame,
      playerCount: 2,
      names: ['Alice', 'Bob'],
    })
    renderWithProviders(<TradeInboxModal state={state} myPlayerId={0} onAccept={() => {}} onReject={() => {}} onCancel={() => {}} onClose={() => {}} />)
    expect(screen.getByText('No pending trade offers')).toBeVisible()
  })
})
