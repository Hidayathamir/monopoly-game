export const Language = { En: 'en', Id: 'id' } as const
export type Language = (typeof Language)[keyof typeof Language]

export const DEFAULT_LANGUAGE: Language = Language.En

export const StorageKey = {
  Language: 'monopoly-language',
  Currency: 'monopoly-currency',
  MpSession: 'monopoly-mp-session',
  PlayerName: 'monopoly-player-name',
  PlayerIdentity: 'monopoly-player-identity',
} as const
export type StorageKey = (typeof StorageKey)[keyof typeof StorageKey]
