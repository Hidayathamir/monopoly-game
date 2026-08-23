import { STARTING_MONEY } from '../data/board'

export const Emoticon = {
  Sad: 'sad',
  Happy: 'happy',
  Angry: 'angry',
  Proud: 'proud',
} as const
export type Emoticon = (typeof Emoticon)[keyof typeof Emoticon]

export const EMOTICON_LIST: Emoticon[] = [
  Emoticon.Sad,
  Emoticon.Happy,
  Emoticon.Angry,
  Emoticon.Proud,
]

export const EMOTICON_GLYPHS: Record<Emoticon, string> = {
  [Emoticon.Sad]: '😢',
  [Emoticon.Happy]: '😂',
  [Emoticon.Angry]: '😠',
  [Emoticon.Proud]: '😎',
}

export const EMOTICON_COOLDOWN_MS = 1_000
export const EMOTICON_LIFETIME_MS = 3_000
export const EXPENSIVE_RENT_THRESHOLD = Math.floor(STARTING_MONEY * 0.2)

export function isEmoticon(value: unknown): value is Emoticon {
  return typeof value === 'string' && EMOTICON_LIST.includes(value as Emoticon)
}

export type ActiveEmotion = {
  id: number
  playerId: number
  emoticon: Emoticon
}
