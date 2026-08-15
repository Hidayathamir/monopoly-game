import type { TFunction } from 'i18next'
import type { LogEntry } from '../types/game'

const MONEY_PARAM_KEYS = new Set(['amount', 'money'])

export function cardKeyForId(id: number): string {
  return id >= 100 ? `card.community.${id}` : `card.chance.${id}`
}

export function resolveLogEntry(
  entry: LogEntry,
  t: TFunction,
  formatMoney: (amount: number | undefined) => string,
): string {
  const params: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(entry.params ?? {})) {
    if (key === 'spaceId') {
      params[key] = t(`board.space.${value}`)
    } else if (key === 'cardId') {
      params[key] = t(cardKeyForId(Number(value)))
    } else if (MONEY_PARAM_KEYS.has(key)) {
      params[key] = formatMoney(typeof value === 'number' ? value : Number(value))
    } else {
      params[key] = value
    }
  }
  return t(entry.key, params)
}
