import { describe, it, expect } from 'vitest'
import { PLAYER_COLORS, PLAYER_OFFSETS, isValidColor, normalizeColor } from '../players'

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

describe('color validation', () => {
  it('accepts hex colors in 3/6/8 digit forms (case-insensitive)', () => {
    expect(isValidColor('#abc')).toBe(true)
    expect(isValidColor('#ABCDEF')).toBe(true)
    expect(isValidColor('#a1b2c3d4')).toBe(true)
  })
  it('rejects non-hex and non-strings', () => {
    expect(isValidColor('not-a-color')).toBe(false)
    expect(isValidColor('#gggggg')).toBe(false)
    expect(isValidColor(123)).toBe(false)
    expect(isValidColor(null)).toBe(false)
  })
  it('normalizes to lowercase and expands short forms', () => {
    expect(normalizeColor('#ABC')).toBe('#aabbcc')
    expect(normalizeColor('#ABCDEF')).toBe('#abcdef')
    expect(normalizeColor('#A1B2C3D4')).toBe('#a1b2c3d4')
  })
})
