// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { saveSession, loadSession, clearSession } from '../session'

describe('mp session', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('saves and loads a session', () => {
    saveSession({ name: 'Alice', code: 'ABC12' })
    expect(loadSession()).toMatchObject({ name: 'Alice', code: 'ABC12' })
  })

  it('returns null when nothing is saved', () => {
    expect(loadSession()).toBeNull()
  })

  it('returns null for corrupt data', () => {
    localStorage.setItem('monopoly-mp-session', 'not json')
    expect(loadSession()).toBeNull()
  })

  it('clears the session', () => {
    saveSession({ name: 'Alice', code: 'ABC12' })
    clearSession()
    expect(loadSession()).toBeNull()
  })
})
