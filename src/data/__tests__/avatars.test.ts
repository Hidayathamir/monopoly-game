import { describe, it, expect } from 'vitest';
import { isSameAvatar, AvatarKind } from '../avatars'
import type { PlayerAvatar } from '../../types/game'

describe('isSameAvatar', () => {
  const cat: PlayerAvatar = { kind: AvatarKind.Preset, id: 'cat' }
  const dog: PlayerAvatar = { kind: AvatarKind.Preset, id: 'dog' }
  const customA: PlayerAvatar = { kind: AvatarKind.Custom, dataUrl: 'data:image/png;base64,AAA' }
  const customB: PlayerAvatar = { kind: AvatarKind.Custom, dataUrl: 'data:image/png;base64,AAA' }
  const customC: PlayerAvatar = { kind: AvatarKind.Custom, dataUrl: 'data:image/png;base64,BBB' }

  it('treats presets with the same id as equal', () => {
    expect(isSameAvatar(cat, { kind: AvatarKind.Preset, id: 'cat' })).toBe(true)
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
