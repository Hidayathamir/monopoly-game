// @vitest-environment jsdom
import { screen, cleanup, fireEvent, within, waitFor } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import BoardGrid from '../BoardGrid'
import { gameReducer, createInitialState } from '../../logic/gameReducer'
import { GameActionType, type GameState } from '../../types/game'
import { renderWithProviders } from '../../test/test-utils'

function setHoverNone(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === '(hover: none)' ? matches : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia
}

function makeState(): GameState {
  return gameReducer(createInitialState(), { type: GameActionType.StartGame, playerCount: 2, names: ['Alice', 'Bob'] })
}

function renderBoard(touch: boolean) {
  setHoverNone(touch)
  const s = makeState()
  return renderWithProviders(
    <BoardGrid
      state={s}
      isMyTurn={true}
      playerColors={['#000', '#fff']}
      onSell={() => {}}
      onMortgage={() => {}}
      onUnmortgage={() => {}}
      onSellProperty={() => {}}
    />,
  )
}

afterEach(cleanup)

describe('BoardGrid tooltip (touch device, hover: none)', () => {
  it('opens the tooltip on tap and keeps it open after leaving the cell', () => {
    renderBoard(true)
    const cell = screen.getByTestId('board-cell-1')
    fireEvent.click(cell)
    expect(screen.getByTestId('property-tooltip')).toBeInTheDocument()
    fireEvent.mouseLeave(cell)
    expect(screen.getByTestId('property-tooltip')).toBeInTheDocument()
  })

  it('opens on tap even without a preceding mouseenter (first-tap case)', () => {
    renderBoard(true)
    fireEvent.click(screen.getByTestId('board-cell-3'))
    expect(screen.getByTestId('property-tooltip')).toBeInTheDocument()
    expect(within(screen.getByTestId('property-tooltip')).getByText('Rio')).toBeInTheDocument()
  })

  it('closes the tooltip when tapping outside the board', () => {
    renderBoard(true)
    fireEvent.click(screen.getByTestId('board-cell-1'))
    expect(screen.getByTestId('property-tooltip')).toBeInTheDocument()
    fireEvent.pointerDown(document.body)
    expect(screen.queryByTestId('property-tooltip')).toBeNull()
  })

  it('does not close when tapping inside the tooltip', () => {
    renderBoard(true)
    fireEvent.click(screen.getByTestId('board-cell-1'))
    fireEvent.pointerDown(screen.getByTestId('property-tooltip'))
    expect(screen.getByTestId('property-tooltip')).toBeInTheDocument()
  })

  it('switches the tooltip when tapping another property', () => {
    renderBoard(true)
    fireEvent.click(screen.getByTestId('board-cell-1'))
    expect(within(screen.getByTestId('property-tooltip')).getByText('Salvador')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('board-cell-3'))
    expect(within(screen.getByTestId('property-tooltip')).getByText('Rio')).toBeInTheDocument()
  })

  it('closes the tooltip via the X button', () => {
    renderBoard(true)
    fireEvent.click(screen.getByTestId('board-cell-1'))
    expect(screen.getByTestId('property-tooltip')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('tooltip-close'))
    expect(screen.queryByTestId('property-tooltip')).toBeNull()
  })

  it('shows the X close button only on touch-pinned tooltips', () => {
    renderBoard(true)
    expect(screen.queryByTestId('tooltip-close')).toBeNull()
    fireEvent.click(screen.getByTestId('board-cell-1'))
    expect(screen.getByTestId('tooltip-close')).toBeInTheDocument()
  })
})

describe('BoardGrid tooltip (desktop, hover: hover)', () => {
  it('opens on mouseenter and does not pin on click', () => {
    renderBoard(false)
    fireEvent.click(screen.getByTestId('board-cell-1'))
    expect(screen.queryByTestId('property-tooltip')).toBeNull()
    fireEvent.mouseEnter(screen.getByTestId('board-cell-1'))
    expect(screen.getByTestId('property-tooltip')).toBeInTheDocument()
    expect(screen.queryByTestId('tooltip-close')).toBeNull()
  })

  it('closes on mouseleave after the hide delay', async () => {
    renderBoard(false)
    const cell = screen.getByTestId('board-cell-1')
    fireEvent.mouseEnter(cell)
    expect(screen.getByTestId('property-tooltip')).toBeInTheDocument()
    fireEvent.mouseLeave(cell)
    expect(screen.getByTestId('property-tooltip')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByTestId('property-tooltip')).toBeNull(), { timeout: 1000 })
  })
})
