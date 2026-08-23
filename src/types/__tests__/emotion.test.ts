import { describe, it, expect } from 'vitest'
import {
  Emoticon, EMOTICON_GLYPHS, EMOTICON_LIST, EMOTICON_COOLDOWN_MS,
  EMOTICON_LIFETIME_MS, EXPENSIVE_RENT_THRESHOLD, isEmoticon,
} from '../emotion'

describe('emotion constants', () => {
  it('defines exactly the four required emoticons', () => {
    expect(EMOTICON_LIST).toEqual(['sad', 'happy', 'angry', 'proud'])
  })

  it('maps every emoticon to its glyph', () => {
    expect(EMOTICON_GLYPHS[Emoticon.Sad]).toBe('😢')
    expect(EMOTICON_GLYPHS[Emoticon.Happy]).toBe('😂')
    expect(EMOTICON_GLYPHS[Emoticon.Angry]).toBe('😠')
    expect(EMOTICON_GLYPHS[Emoticon.Proud]).toBe('😎')
  })

  it('uses a 5s cooldown, 3s lifetime, and a $300 expensive-rent threshold', () => {
    expect(EMOTICON_COOLDOWN_MS).toBe(5000)
    expect(EMOTICON_LIFETIME_MS).toBe(3000)
    expect(EXPENSIVE_RENT_THRESHOLD).toBe(300)
  })

  it('isEmoticon accepts only the four known values', () => {
    expect(EMOTICON_LIST.every((e) => isEmoticon(e))).toBe(true)
    expect(isEmoticon('lol')).toBe(false)
    expect(isEmoticon(42)).toBe(false)
  })
})
