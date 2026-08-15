// @vitest-environment jsdom
import { render, cleanup } from '@testing-library/react'
import { afterEach, describe, it, expect } from 'vitest'
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
})
