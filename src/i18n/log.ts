import type { TFunction } from 'i18next'
import { CardType, type LogEntry } from '../types/game'

const MONEY_PARAM_KEYS = new Set(['amount', 'money', 'perHouse', 'perHotel', 'perPlayer'])

export function cardKeyForId(id: number): string {
  return id >= 100 ? `card.${CardType.Community}.${id}` : `card.${CardType.Chance}.${id}`
}

export function resolveLogEntry(
  entry: LogEntry,
  t: TFunction,
  formatMoney: (amount: number | undefined) => string,
): string {
  const params: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(entry.params ?? {})) {
    if (key === 'bot') continue
    if (key === 'spaceId') {
      params[key] = t(`board.space.${value}`)
    } else if (key === 'cardId') {
      params[key] = t(cardKeyForId(Number(value)))
    } else if (MONEY_PARAM_KEYS.has(key)) {
      params[key] = formatMoney(typeof value === 'number' ? value : Number(value))
    } else {
      params[key] = value as string | number
    }
  }
  if (entry.params?.bot && params.name !== undefined) {
    params.name = t('log.botName', { name: params.name })
  }
  return t(entry.key, params)
}
