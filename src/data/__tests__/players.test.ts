import { describe, it, expect } from 'vitest'
import { PLAYER_COLORS, PLAYER_OFFSETS } from '../players'

describe('players', () => {
  it('defines 6 distinct colors', () => {
    expect(PLAYER_COLORS).toHaveLength(6)
    expect(new Set(PLAYER_COLORS).size).toBe(6)
  })

  it('defines token offsets for player ids 0 through 5', () => {
    for (let i = 0; i < 6; i++) {
      expect(PLAYER_OFFSETS[i]).toBeDefined()
      expect(typeof PLAYER_OFFSETS[i].dx).toBe('number')
      expect(typeof PLAYER_OFFSETS[i].dy).toBe('number')
    }
  })
})
