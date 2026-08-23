// @vitest-environment jsdom
import { cleanup, screen, within, fireEvent } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import Sidebar from '../Sidebar'
import { renderWithProviders } from '../../test/test-utils'
import { gameReducer, createInitialState } from '../../logic/gameReducer'
import { GameActionType, type GameState } from '../../types/game'
import { SoundProvider } from '../../audio/SoundContext'

const { playSoundMock } = vi.hoisted(() => ({ playSoundMock: vi.fn() }))
vi.mock('../../audio/soundEngine', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../audio/soundEngine')>()
  return { ...mod, playSound: playSoundMock }
})

const noop = () => {}

function makeState(): GameState {
  return gameReducer(createInitialState(), {
    type: GameActionType.StartGame,
    playerCount: 2,
    names: ['Alice', 'Bob'],
  })
}

function makeRolledState(): GameState {
  return { ...makeState(), dice: [2, 3] }
}

function makeProps() {
  return {
    onRoll: noop,
    onEndTurn: noop,
    onProposeTrade: noop,
    canTrade: true,
    tradesEnabled: true,
    onBuyProperty: noop,
    onDeclineBuy: noop,
    onPayRent: noop,
    onDeclareBankruptcy: noop,
    onSkipAction: noop,
    onPayJailFine: noop,
    onUseGetOutOfJailFree: noop,
    onBuild: noop,
    tradeCount: 0,
    onOpenTrades: noop,
    onEmitEmoticon: noop,
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
    const hoverHint = screen.getByText('Hover a property on the board to sell/mortgage')
    const playersLabel = screen.getByText('Players')
    const eventLog = screen.getByTestId('event-log')
    expect(domIndex(turnLabel)).toBeLessThan(domIndex(hoverHint))
    expect(domIndex(hoverHint)).toBeLessThan(domIndex(playersLabel))
    expect(domIndex(playersLabel)).toBeLessThan(domIndex(eventLog))
  })

  it('renders the roll button above the player list', () => {
    renderWithProviders(<Sidebar state={makeState()} isMyTurn onLeave={noop} {...makeProps()} />)
    const roll = screen.getByRole('button', { name: /Roll/ })
    const playersLabel = screen.getByText('Players')
    expect(domIndex(roll)).toBeLessThan(domIndex(playersLabel))
  })

  it('renders the leave icon at the top of the sidebar', () => {
    renderWithProviders(<Sidebar state={makeRolledState()} isMyTurn onLeave={noop} {...makeProps()} />)
    const sidebar = screen.getByTestId('sidebar')
    const firstChild = sidebar.children[0] as HTMLElement
    expect(within(firstChild).getByRole('button', { name: 'Leave Room' })).toBeVisible()
  })

  it('shows the trade inbox badge count', () => {
    renderWithProviders(<Sidebar state={makeRolledState()} isMyTurn onLeave={noop} {...makeProps()} tradeCount={3} />)
    expect(screen.getByText('Trades')).toBeVisible()
    expect(screen.getByText('3')).toBeVisible()
  })

  it('hides the trades button when trades are disabled', () => {
    renderWithProviders(<Sidebar state={makeRolledState()} isMyTurn onLeave={noop} {...makeProps()} tradesEnabled={false} />)
    expect(screen.queryByText('Trades')).toBeNull()
  })

  it('shows OFFLINE on a disconnected player card', () => {
    renderWithProviders(<Sidebar state={makeState()} isMyTurn onLeave={noop} {...makeProps()} connectedPlayerIds={new Set([1])} />)
    expect(screen.getByText('OFFLINE')).toBeTruthy()
  })

  it('plays a click sound when opening the trade inbox', () => {
    playSoundMock.mockClear()
    renderWithProviders(
      <SoundProvider>
        <Sidebar state={makeRolledState()} isMyTurn onLeave={noop} {...makeProps()} />
      </SoundProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Trades' }))
    expect(playSoundMock).toHaveBeenCalledWith('click')
  })
})
