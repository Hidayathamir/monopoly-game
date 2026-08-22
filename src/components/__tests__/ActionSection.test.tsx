// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import ActionSection from '../ActionSection'
import { renderWithProviders } from '../../test/test-utils'
import { gameReducer, createInitialState } from '../../logic/gameReducer'
import { GameActionType, PendingActionType, type GameState } from '../../types/game'

const noop = () => {}
const actions = {
  onDrawCard: noop, onBuyProperty: noop,
  onDeclineBuy: noop, onPayRent: noop, onDeclareBankruptcy: noop,
  onPayJailFine: noop, onUseGetOutOfJailFree: noop,
}

function makeState(): GameState {
  const s = gameReducer(createInitialState(), { type: GameActionType.StartGame, playerCount: 2, names: ['Alice', 'Bob'] })
  return { ...s, turnOrder: [0, 1], currentPlayer: 0 }
}

afterEach(cleanup)

describe('ActionSection', () => {
  it('renders nothing when it is not the current player turn', () => {
    const { container } = renderWithProviders(<ActionSection state={makeState()} {...actions} isMyTurn={false} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows a build button when on own buildable property after rolling', () => {
    let s = makeState()
    s = {
      ...s,
      players: s.players.map((p, i) => i === 0 ? { ...p, position: 8, properties: [8], passedGo: true } : p),
      board: s.board.map((b) => b.id === 8 ? { ...b, owner: 0 } : b),
      dice: [2, 3],
    }
    const onBuild = vi.fn()
    renderWithProviders(<ActionSection state={s} {...actions} onBuild={onBuild} />)
    const btn = screen.getByRole('button', { name: /Build/ })
    btn.click()
    expect(onBuild).toHaveBeenCalledWith(8)
  })

  it('does not show a build button before the player has rolled', () => {
    let s = makeState()
    s = {
      ...s,
      players: s.players.map((p, i) => i === 0 ? { ...p, position: 8, properties: [8], passedGo: true } : p),
      board: s.board.map((b) => b.id === 8 ? { ...b, owner: 0 } : b),
      dice: null,
    }
    renderWithProviders(<ActionSection state={s} {...actions} onBuild={() => {}} />)
    expect(screen.queryByRole('button', { name: /Build/ })).toBeNull()
  })

  it('hides build button on a just-bought property', () => {
    let s = makeState()
    s = {
      ...s,
      players: s.players.map((p, i) => i === 0 ? { ...p, position: 8, properties: [8], passedGo: true } : p),
      board: s.board.map((b) => b.id === 8 ? { ...b, owner: 0 } : b),
      dice: [2, 3],
      justBoughtSpaceId: 8,
    }
    renderWithProviders(<ActionSection state={s} {...actions} onBuild={() => {}} />)
    expect(screen.queryByRole('button', { name: /Build/ })).toBeNull()
  })

  it('shows the pay option on the first turn in jail', () => {
    let s = makeState()
    s = { ...s, players: s.players.map((p, i) => i === 0 ? { ...p, inJail: true, position: 10, jailTurns: 0 } : p) }
    renderWithProviders(<ActionSection state={s} {...actions} />)
    expect(screen.getByRole('button', { name: /Pay/ })).toBeVisible()
  })

  it('does not render an end-of-turn button after rolling', () => {
    let s = makeState()
    s = { ...s, dice: [3, 3], doublesCount: 1 }
    renderWithProviders(<ActionSection state={s} {...actions} />)
    expect(screen.queryByRole('button', { name: /Roll Again/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /End Turn/ })).not.toBeInTheDocument()
  })

  describe('bankruptcy hold-to-confirm', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('fires onDeclareBankruptcy once after a completed hold', () => {
      const s = { ...makeState(), pendingAction: { type: PendingActionType.Bankruptcy, amount: 99999, spaceId: 1 } }
      const onDeclareBankruptcy = vi.fn()
      renderWithProviders(<ActionSection state={s} {...actions} onDeclareBankruptcy={onDeclareBankruptcy} />)
      const button = screen.getByRole('button', { name: /Declare Bankruptcy/ })
      fireEvent.pointerDown(button, { button: 0 })
      act(() => vi.advanceTimersByTime(5000))
      expect(onDeclareBankruptcy).toHaveBeenCalledTimes(1)
    })
  })
})
