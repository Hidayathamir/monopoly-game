// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { getPath } from '../PlayerTokens'

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
