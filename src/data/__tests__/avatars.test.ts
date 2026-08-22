import { describe, it, expect } from 'vitest';
import {
  PRESET_AVATARS, PRESET_EMOJI, DEFAULT_AVATAR,
  CUSTOM_AVATAR_MAX_DATA_URL_LENGTH,
  isPresetAvatar, isCustomAvatar, isValidAvatar, avatarEmoji, isSameAvatar,
} from '../avatars';
import { AvatarKind } from '../../types/game';
import type { PlayerAvatar } from '../../types/game';

describe('avatars', () => {
  it('defines 10 distinct presets with emoji', () => {
    expect(Object.keys(PRESET_AVATARS)).toHaveLength(10)
    expect(Object.keys(PRESET_EMOJI)).toHaveLength(10)
  })

  it('defaults to the cat preset', () => {
    expect(DEFAULT_AVATAR).toEqual({ kind: AvatarKind.Preset, id: PRESET_AVATARS.Cat })
  })

  it('accepts a valid preset avatar', () => {
    const avatar = { kind: AvatarKind.Preset, id: PRESET_AVATARS.Dog }
    expect(isPresetAvatar(avatar)).toBe(true)
    expect(isValidAvatar(avatar)).toBe(true)
    expect(avatarEmoji(avatar)).toBe('🐶')
  })

  it('rejects an unknown preset id', () => {
    expect(isPresetAvatar({ kind: AvatarKind.Preset, id: 'unicorn' })).toBe(false)
    expect(isValidAvatar({ kind: AvatarKind.Preset, id: 'unicorn' })).toBe(false)
    expect(avatarEmoji({ kind: AvatarKind.Preset, id: 'unicorn' as never })).toBeNull()
  })

  it('rejects prototype-chain keys like toString', () => {
    expect(isPresetAvatar({ kind: AvatarKind.Preset, id: 'toString' })).toBe(false)
    expect(isValidAvatar({ kind: AvatarKind.Preset, id: 'toString' })).toBe(false)
  })

  it('accepts a custom data URL avatar within the cap', () => {
    const dataUrl = `data:image/jpeg;base64,${'a'.repeat(100)}`
    expect(isCustomAvatar({ kind: AvatarKind.Custom, dataUrl })).toBe(true)
    expect(isValidAvatar({ kind: AvatarKind.Custom, dataUrl })).toBe(true)
  })

  it('rejects a custom avatar that is not a data URL', () => {
    expect(isCustomAvatar({ kind: AvatarKind.Custom, dataUrl: 'https://x/y.png' })).toBe(false)
  })

  it('rejects a custom avatar exceeding the size cap', () => {
    const tooBig = `data:image/jpeg;base64,${'a'.repeat(CUSTOM_AVATAR_MAX_DATA_URL_LENGTH + 1)}`
    expect(isCustomAvatar({ kind: AvatarKind.Custom, dataUrl: tooBig })).toBe(false)
    expect(isValidAvatar({ kind: AvatarKind.Custom, dataUrl: tooBig })).toBe(false)
  })

  it('rejects non-object values', () => {
    expect(isValidAvatar(null)).toBe(false)
    expect(isValidAvatar(undefined)).toBe(false)
    expect(isValidAvatar('cat')).toBe(false)
  })

  describe('isSameAvatar', () => {
    const cat: PlayerAvatar = { kind: AvatarKind.Preset, id: PRESET_AVATARS.Cat }
    const dog: PlayerAvatar = { kind: AvatarKind.Preset, id: PRESET_AVATARS.Dog }
    const customA: PlayerAvatar = { kind: AvatarKind.Custom, dataUrl: 'data:image/png;base64,AAA' }
    const customB: PlayerAvatar = { kind: AvatarKind.Custom, dataUrl: 'data:image/png;base64,AAA' }
    const customC: PlayerAvatar = { kind: AvatarKind.Custom, dataUrl: 'data:image/png;base64,BBB' }

    it('treats presets with the same id as equal', () => {
      expect(isSameAvatar(cat, { kind: AvatarKind.Preset, id: PRESET_AVATARS.Cat })).toBe(true)
      expect(isSameAvatar(cat, dog)).toBe(false)
    })
    it('treats customs with the same dataUrl as equal', () => {
      expect(isSameAvatar(customA, customB)).toBe(true)
      expect(isSameAvatar(customA, customC)).toBe(false)
    })
    it('never treats a preset as equal to a custom', () => {
      expect(isSameAvatar(cat, customA)).toBe(false)
    })
  })
})
