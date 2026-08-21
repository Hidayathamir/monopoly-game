import { describe, it, expect, beforeEach } from 'vitest'
import { loadIdentity, saveIdentity, clearIdentity } from '../identity'
import { DEFAULT_AVATAR } from '../../data/avatars'
import { PLAYER_COLORS } from '../../data/players'

describe('identity persistence', () => {
  beforeEach(() => localStorage.clear())

  it('round-trips a saved identity', () => {
    const identity = { color: PLAYER_COLORS[3], avatar: DEFAULT_AVATAR }
    expect(loadIdentity()).toBeNull()
    saveIdentity(identity)
    expect(loadIdentity()).toEqual(identity)
  })

  it('clears the saved identity', () => {
    saveIdentity({ color: PLAYER_COLORS[0], avatar: DEFAULT_AVATAR })
    clearIdentity()
    expect(loadIdentity()).toBeNull()
  })

  it('returns null for corrupt JSON', () => {
    localStorage.setItem('monopoly-player-identity', 'not json')
    expect(loadIdentity()).toBeNull()
  })
})
