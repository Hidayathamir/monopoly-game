// @vitest-environment jsdom
import { cleanup } from '@testing-library/react'
import { afterEach, describe, it, expect } from 'vitest'
import '@testing-library/jest-dom/vitest'
import PlayerTokens, { getPath, POSITIONS } from '../PlayerTokens'
import { renderWithProviders } from '../../test/test-utils'
import { SoundProvider } from '../../audio/SoundContext'
import { gameReducer, createInitialState } from '../../logic/gameReducer'
import { GameActionType, type GameState } from '../../types/game'
import { PLAYER_COLORS } from '../../data/players'
import { DEFAULT_AVATAR, PRESET_AVATARS, PRESET_EMOJI } from '../../data/avatars'

function makeState(): GameState {
  return gameReducer(createInitialState(), {
    type: GameActionType.StartGame,
    playerCount: 1,
    names: ['Host'],
    colors: [PLAYER_COLORS[1]],
    avatars: [DEFAULT_AVATAR],
  })
}

function renderTokens() {
  const { container } = renderWithProviders(
    <SoundProvider>
      <PlayerTokens state={makeState()} />
    </SoundProvider>,
  )
  const token = container.querySelector('[title="Host"]') as HTMLElement
  expect(token).not.toBeNull()
  return token
}

afterEach(cleanup)

describe('PlayerTokens', () => {
  it('renders a token per player with the chosen color as background', () => {
    const token = renderTokens()
    expect(token).toHaveStyle({ backgroundColor: PLAYER_COLORS[1] })
  })

  it('renders the chosen avatar inside the token', () => {
    const token = renderTokens()
    expect(token.textContent).toContain(PRESET_EMOJI[PRESET_AVATARS.Cat])
  })

  it('keeps the token at its current position until the first walk starts', () => {
    const state0 = makeState()
    const moved = gameReducer(state0, { type: GameActionType.DiceAnimated, dice: [3, 3] })
    const { container, rerender } = renderWithProviders(
      <SoundProvider>
        <PlayerTokens state={state0} />
      </SoundProvider>,
    )
    rerender(
      <SoundProvider>
        <PlayerTokens state={moved} />
      </SoundProvider>,
    )
    const token = container.querySelector('[title="Host"]') as HTMLElement
    const percent = token.style.left.match(/([\d.]+)%/)?.[1]
    expect(percent).toBe(String(POSITIONS[0].x))
    expect(percent).not.toBe(String(POSITIONS[6].x))
  })
})

describe('getPath', () => {
  it('walks forward wrapping past GO', () => {
    expect(getPath(7, 5, false)).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 0, 1, 2, 3, 4, 5])
  })
  it('walks backward', () => {
    expect(getPath(20, 17, true)).toEqual([19, 18, 17])
  })
  it('returns empty for no move', () => {
    expect(getPath(10, 10, false)).toEqual([])
  })
})
