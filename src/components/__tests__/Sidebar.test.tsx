// @vitest-environment jsdom
import { cleanup, screen, within } from '@testing-library/react'
import { afterEach, describe, it, expect } from 'vitest'
import '@testing-library/jest-dom/vitest'
import Sidebar from '../Sidebar'
import { renderWithProviders } from '../../test/test-utils'
import { gameReducer, createInitialState } from '../../logic/gameReducer'
import { GameActionType, type GameState } from '../../types/game'

const noop = () => {}

function makeRolledState(): GameState {
  const s = gameReducer(createInitialState(), {
    type: GameActionType.StartGame,
    playerCount: 2,
    names: ['Alice', 'Bob'],
  })
  return { ...s, dice: [2, 3] }
}

function makeProps() {
  return {
    onRoll: noop,
    onEndTurn: noop,
    onProposeTrade: noop,
    onDrawCard: noop,
    onBuyProperty: noop,
    onDeclineBuy: noop,
    onPayRent: noop,
    onDeclareBankruptcy: noop,
    onSkipAction: noop,
    onPayJailFine: noop,
    onUseGetOutOfJailFree: noop,
    onBuild: noop,
  }
}

function domIndex(el: HTMLElement): number {
  return Array.from(document.querySelectorAll('[data-testid="sidebar"] *')).indexOf(el)
}

afterEach(cleanup)

describe('Sidebar', () => {
  it('places action buttons above the player list and event log', () => {
    renderWithProviders(<Sidebar state={makeRolledState()} isMyTurn onLeave={noop} {...makeProps()} />)
    const turnLabel = screen.getByText('Turn')
    const endTurn = screen.getByRole('button', { name: 'End Turn' })
    const playersLabel = screen.getByText('Players')
    const eventLog = screen.getByTestId('event-log')
    expect(domIndex(turnLabel)).toBeLessThan(domIndex(endTurn))
    expect(domIndex(endTurn)).toBeLessThan(domIndex(playersLabel))
    expect(domIndex(playersLabel)).toBeLessThan(domIndex(eventLog))
  })

  it('renders the leave icon at the top of the sidebar', () => {
    renderWithProviders(<Sidebar state={makeRolledState()} isMyTurn onLeave={noop} {...makeProps()} />)
    const sidebar = screen.getByTestId('sidebar')
    const firstChild = sidebar.children[0] as HTMLElement
    expect(within(firstChild).getByRole('button', { name: 'Leave Room' })).toBeVisible()
  })
})
