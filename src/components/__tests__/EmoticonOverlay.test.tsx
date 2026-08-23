// @vitest-environment jsdom
import { cleanup } from '@testing-library/react'
import { afterEach, describe, it, expect } from 'vitest'
import '@testing-library/jest-dom/vitest'
import EmoticonOverlay from '../EmoticonOverlay'
import { renderWithProviders } from '../../test/test-utils'
import { gameReducer, createInitialState } from '../../logic/gameReducer'
import { GameActionType, type GameState } from '../../types/game'
import type { ActiveEmotion } from '../../types/emotion'

function makeState(): GameState {
  return gameReducer(createInitialState(), {
    type: GameActionType.StartGame,
    playerCount: 2,
    names: ['Alice', 'Bob'],
  })
}

afterEach(cleanup)

describe('EmoticonOverlay', () => {
  it('renders a bubble above the emitting player with the right glyph', () => {
    const emotions: ActiveEmotion[] = [{ id: 1, playerId: 0, emoticon: 'happy' }]
    const { container } = renderWithProviders(<EmoticonOverlay state={makeState()} emotions={emotions} />)
    const bubble = container.querySelector('[data-testid="emoticon-0-happy"]') as HTMLElement
    expect(bubble).not.toBeNull()
    expect(bubble.textContent).toBe('😂')
  })

  it('ignores emotions for unknown players', () => {
    const emotions: ActiveEmotion[] = [{ id: 1, playerId: 99, emoticon: 'sad' }]
    const { container } = renderWithProviders(<EmoticonOverlay state={makeState()} emotions={emotions} />)
    expect(container.querySelector('[data-testid="emoticon-99-sad"]')).toBeNull()
  })

  it('renders multiple bubbles for multiple emotions', () => {
    const emotions: ActiveEmotion[] = [
      { id: 1, playerId: 0, emoticon: 'sad' },
      { id: 2, playerId: 1, emoticon: 'angry' },
    ]
    const { container } = renderWithProviders(<EmoticonOverlay state={makeState()} emotions={emotions} />)
    expect(container.querySelector('[data-testid="emoticon-0-sad"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="emoticon-1-angry"]')).not.toBeNull()
  })
})
