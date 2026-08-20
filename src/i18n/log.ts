import type { TFunction } from 'i18next'
import { CardType, LogParamKey, type LogEntry } from '../types/game'

const MONEY_PARAM_KEYS = new Set<string>([LogParamKey.Amount, LogParamKey.Money, LogParamKey.PerHouse, LogParamKey.PerHotel, LogParamKey.PerPlayer])

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
    if (key === LogParamKey.Bot) continue
    if (key === LogParamKey.SpaceId) {
      params[key] = t(`board.space.${value}`)
    } else if (key === LogParamKey.CardId) {
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
