// @vitest-environment jsdom
import { render, cleanup, screen } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import ActionSection from '../ActionSection'
import { gameReducer, createInitialState } from '../../logic/gameReducer'
import { GameActionType, type GameState } from '../../types/game'

const noop = () => {}
const actions = {
  onEndTurn: noop, onDrawCard: noop, onProposeTrade: noop, onBuyProperty: noop,
  onDeclineBuy: noop, onPayRent: noop, onDeclareBankruptcy: noop,
  onPayJailFine: noop, onUseGetOutOfJailFree: noop,
}

function makeState(): GameState {
  return gameReducer(createInitialState(), { type: GameActionType.StartGame, playerCount: 2, names: ['Alice', 'Bob'] })
}

afterEach(cleanup)

describe('ActionSection', () => {
  it('renders nothing when it is not the current player turn', () => {
    const { container } = render(<ActionSection state={makeState()} {...actions} isMyTurn={false} />)
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
    render(<ActionSection state={s} {...actions} onBuild={onBuild} />)
    const btn = screen.getByRole('button', { name: /Bangun/ })
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
    render(<ActionSection state={s} {...actions} onBuild={() => {}} />)
    expect(screen.queryByRole('button', { name: /Bangun/ })).toBeNull()
  })

  it('hides build button on a just-bought property', () => {
    let s = makeState()
    s = {
      ...s,
      players: s.players.map((p, i) => i === 0 ? { ...p, position: 8, properties: [8], passedGo: true } : p),
      board: s.board.map((b) => b.id === 8 ? { ...b, owner: 0 } : b),
      justBoughtSpaceId: 8,
    }
    render(<ActionSection state={s} {...actions} onBuild={() => {}} />)
    expect(screen.queryByRole('button', { name: /Bangun/ })).toBeNull()
  })

  it('shows the pay option on the first turn in jail', () => {
    let s = makeState()
    s = { ...s, players: s.players.map((p, i) => i === 0 ? { ...p, inJail: true, position: 10, jailTurns: 0 } : p) }
    render(<ActionSection state={s} {...actions} />)
    expect(screen.getByRole('button', { name: /Bayar/ })).toBeVisible()
  })
})
