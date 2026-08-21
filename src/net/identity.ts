import type { PlayerAvatar } from '../types/game'
import { StorageKey } from '../i18n/constants'

export interface PlayerIdentity {
  color: string
  avatar: PlayerAvatar
}

export function loadIdentity(): PlayerIdentity | null {
  try {
    const raw = localStorage.getItem(StorageKey.PlayerIdentity)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PlayerIdentity
    if (!parsed || typeof parsed.color !== 'string' || !parsed.avatar) return null
    return { color: parsed.color, avatar: parsed.avatar }
  } catch {
    return null
  }
}

export function saveIdentity(identity: PlayerIdentity): void {
  localStorage.setItem(StorageKey.PlayerIdentity, JSON.stringify(identity))
}

export function clearIdentity(): void {
  localStorage.removeItem(StorageKey.PlayerIdentity)
}
