import { describe, it, expect } from 'vitest';
import { isValidColor, normalizeColor } from '../players'

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
