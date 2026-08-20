import { StorageKey } from '../i18n/constants'

export interface MPSession {
  name: string
  code: string
  savedAt: number
}

export function saveSession(session: { name: string; code: string }): void {
  const value: MPSession = { ...session, savedAt: Date.now() }
  localStorage.setItem(StorageKey.MpSession, JSON.stringify(value))
}

export function loadSession(): { name: string; code: string } | null {
  try {
    const raw = localStorage.getItem(StorageKey.MpSession)
    if (!raw) return null
    const parsed = JSON.parse(raw) as MPSession
    if (!parsed.name || !parsed.code) return null
    return { name: parsed.name, code: parsed.code }
  } catch {
    return null
  }
}

export function clearSession(): void {
  localStorage.removeItem(StorageKey.MpSession)
}
