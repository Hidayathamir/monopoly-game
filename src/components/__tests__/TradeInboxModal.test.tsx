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
      // Alice (id 0) offers Bob (id 1): gives Rio(3)+$0, wants $100.
      { id: 0, fromId: 0, toId: 1, offerProperties: [3], offerCash: 0, requestProperties: [], requestCash: 100 },
    ],
  }
  return state
}

afterEach(cleanup)

describe('TradeInboxModal', () => {
  it('shows the recipient perspective (You receive / You give)', () => {
    const onAccept = vi.fn()
    const onReject = vi.fn()
    const onCancel = vi.fn()
    // Bob (id 1) is the recipient of the trade above.
    renderWithProviders(
      <TradeInboxModal state={makeStateWithTrades()} myPlayerId={1} onAccept={onAccept} onReject={onReject} onCancel={onCancel} onClose={() => {}} />,
    )
    expect(screen.getByText(/You receive:/)).toBeTruthy()
    expect(screen.getByText(/You give:/)).toBeTruthy()
    // The recipient receives Rio and gives $100.
    expect(screen.getByText(/You receive:.*Rio/)).toBeTruthy()
    expect(screen.getByText(/You give:.*100/)).toBeTruthy()
    // The proposer-frame labels must NOT appear.
    expect(screen.queryByText(/You offer:/)).toBeNull()
    expect(screen.queryByText(/You request:/)).toBeNull()
  })

  it('shows accept/reject for the recipient and cancel for the proposer', () => {
    const onAccept = vi.fn()
    const onReject = vi.fn()
    const onCancel = vi.fn()

    // Recipient (Bob, id 1) can accept/reject.
    const { unmount } = renderWithProviders(
      <TradeInboxModal state={makeStateWithTrades()} myPlayerId={1} onAccept={onAccept} onReject={onReject} onCancel={onCancel} onClose={() => {}} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Accept/ }))
    expect(onAccept).toHaveBeenCalledWith(0)
    fireEvent.click(screen.getByRole('button', { name: /Reject/ }))
    expect(onReject).toHaveBeenCalledWith(0)
    unmount()

    // Proposer (Alice, id 0) can cancel their own offer.
    renderWithProviders(
      <TradeInboxModal state={makeStateWithTrades()} myPlayerId={0} onAccept={onAccept} onReject={onReject} onCancel={onCancel} onClose={() => {}} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Cancel/ }))
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
