// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import TradeModal from '../Modals/TradeModal'
import { renderWithProviders } from '../../test/test-utils'
import { gameReducer, createInitialState } from '../../logic/gameReducer'
import { GameActionType, type GameState } from '../../types/game'

function makeState(): GameState {
  const s = gameReducer(createInitialState(), { type: GameActionType.StartGame, playerCount: 2, names: ['Alice', 'Bob'] })
  return { ...s, turnOrder: [0, 1], currentPlayer: 0 }
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
      <TradeModal state={makeState()} targetPlayerId={1} myPlayerId={0} onPropose={onPropose} onClose={() => {}} />,
    )
    expect(screen.getByText('Bob')).toBeVisible()
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('proposes the trade to the locked target player', () => {
    const onPropose = vi.fn()
    renderWithProviders(
      <TradeModal state={makeState()} targetPlayerId={1} myPlayerId={0} onPropose={onPropose} onClose={() => {}} />,
    )
    fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '100' } })
    screen.getByRole('button', { name: /Propose/i }).click()
    expect(onPropose).toHaveBeenCalledWith(expect.objectContaining({ toId: 1, offerCash: 100 }))
  })

  it('disables Propose until the trade has at least one item', () => {
    const onPropose = vi.fn()
    renderWithProviders(
      <TradeModal state={makeStateWithRecipientProperties()} targetPlayerId={1} myPlayerId={0} onPropose={onPropose} onClose={() => {}} />,
    )
    const propose = screen.getByRole('button', { name: /Propose/i })
    expect(propose).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox', { name: /Rio/ }))
    expect(propose).toBeEnabled()
    expect(onPropose).not.toHaveBeenCalled()
  })

  it("renders the recipient's tradeable properties as request checkboxes", () => {
    renderWithProviders(<TradeModal state={makeStateWithRecipientProperties()} targetPlayerId={1} myPlayerId={0} onPropose={() => {}} onClose={() => {}} />)
    expect(screen.getByText('You request:')).toBeVisible()
    expect(screen.getByRole('checkbox', { name: /Rio/ })).toBeTruthy()
  })

  it('includes the selected request property in the proposed offer', () => {
    const onPropose = vi.fn()
    renderWithProviders(<TradeModal state={makeStateWithRecipientProperties()} targetPlayerId={1} myPlayerId={0} onPropose={onPropose} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('checkbox', { name: /Rio/ }))
    screen.getByRole('button', { name: /Propose/i }).click()
    expect(onPropose).toHaveBeenCalledWith(expect.objectContaining({ requestProperties: [3] }))
  })

  it('clamps offered cash to the proposer\'s available cash', () => {
    const s = makeState()
    const state = { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, money: 50 } : p)) }
    renderWithProviders(<TradeModal state={state} targetPlayerId={1} myPlayerId={0} onPropose={() => {}} onClose={() => {}} />)
    const offer = screen.getAllByRole('spinbutton')[0]
    fireEvent.change(offer, { target: { value: '100' } })
    expect(offer).toHaveValue(50)
  })

  it('clamps negative cash entries to 0', () => {
    renderWithProviders(<TradeModal state={makeState()} targetPlayerId={1} myPlayerId={0} onPropose={() => {}} onClose={() => {}} />)
    const offer = screen.getAllByRole('spinbutton')[0]
    fireEvent.change(offer, { target: { value: '-100' } })
    expect(offer).toHaveValue(0)
  })

  it('includes mortgaged and developed properties in both columns', () => {
    const s = makeState()
    const state = {
      ...s,
      board: s.board.map((b) =>
        b.id === 1 ? { ...b, owner: 0 }
          : b.id === 3 ? { ...b, owner: 0, mortgaged: true }
          : b.id === 6 ? { ...b, owner: 1, houses: 1 }
          : b.id === 9 ? { ...b, owner: 1 }
          : b,
      ),
      players: s.players.map((p, i) => (i === 0 ? { ...p, properties: [1, 3] } : { ...p, properties: [6, 9] })),
    }
    renderWithProviders(<TradeModal state={state} targetPlayerId={1} myPlayerId={0} onPropose={() => {}} onClose={() => {}} />)
    expect(screen.getByRole('checkbox', { name: /Salvador/ })).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: /Rio/ })).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: /Jerusalem/ })).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: /Tel Aviv/ })).toBeTruthy()
  })

  it('uses the viewer as proposer when off-turn (myPlayerId != currentPlayer)', () => {
    const s = makeState()
    const state = {
      ...s,
      board: s.board.map((b) => (b.id === 3 ? { ...b, owner: 1 } : b.id === 1 ? { ...b, owner: 0 } : b)),
      players: s.players.map((p, i) => (i === 1 ? { ...p, properties: [3] } : { ...p, properties: [1] })),
    }
    const onPropose = vi.fn()
    // Viewer is Bob (id 1), who is off-turn (currentPlayer is 0); trade targets Alice (id 0).
    renderWithProviders(<TradeModal state={state} targetPlayerId={0} myPlayerId={1} onPropose={onPropose} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('checkbox', { name: /Rio/ }))
    screen.getByRole('button', { name: /Propose/i }).click()
    expect(onPropose).toHaveBeenCalledWith(expect.objectContaining({ fromId: 1, offerProperties: [3] }))
  })
})
