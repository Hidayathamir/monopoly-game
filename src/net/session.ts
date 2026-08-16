export interface MPSession {
  name: string
  code: string
  savedAt: number
}

const KEY = 'monopoly-mp-session'

export function saveSession(session: { name: string; code: string }): void {
  const value: MPSession = { ...session, savedAt: Date.now() }
  localStorage.setItem(KEY, JSON.stringify(value))
}

export function loadSession(): { name: string; code: string } | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as MPSession
    if (!parsed.name || !parsed.code) return null
    return { name: parsed.name, code: parsed.code }
  } catch {
    return null
  }
}

export function clearSession(): void {
  localStorage.removeItem(KEY)
}
