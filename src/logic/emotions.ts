import { Emoticon, EXPENSIVE_RENT_THRESHOLD, type Emoticon as EmoticonType } from '../types/emotion'
import { LogEventKey, type GameState } from '../types/game'

export type BotEmotion = {
  playerId: number
  emoticon: EmoticonType
}

function isBotControlled(state: GameState, playerId: number): boolean {
  const p = state.players[playerId]
  return !!p && (p.isBot || p.botControlled)
}

function playerIdByName(state: GameState, name: unknown): number | null {
  if (typeof name !== 'string') return null
  const idx = state.players.findIndex((p) => p.name === name)
  return idx === -1 ? null : idx
}

export function detectBotEmotions(prev: GameState, next: GameState): BotEmotion[] {
  const newEntries = next.eventLog.slice(prev.eventLog.length)
  const emotions: BotEmotion[] = []

  for (const entry of newEntries) {
    const params = entry.params ?? {}
    switch (entry.key) {
      case LogEventKey.Bankruptcy: {
        const id = playerIdByName(next, params.name)
        if (id !== null && isBotControlled(next, id)) {
          emotions.push({ playerId: id, emoticon: Emoticon.Sad })
        }
        break
      }
      case LogEventKey.PaidRent: {
        const id = playerIdByName(next, params.name)
        if (
          id !== null &&
          isBotControlled(next, id) &&
          typeof params.amount === 'number' &&
          params.amount >= EXPENSIVE_RENT_THRESHOLD
        ) {
          emotions.push({ playerId: id, emoticon: Emoticon.Angry })
        }
        break
      }
      case LogEventKey.MonopolyRent: {
        const id = playerIdByName(next, params.owner)
        if (id !== null && isBotControlled(next, id)) {
          emotions.push({ playerId: id, emoticon: Emoticon.Proud })
        }
        break
      }
      case LogEventKey.TradeAccepted: {
        for (const name of [params.from, params.to]) {
          const id = playerIdByName(next, name)
          if (id !== null && isBotControlled(next, id)) {
            emotions.push({ playerId: id, emoticon: Emoticon.Happy })
          }
        }
        break
      }
      case LogEventKey.DoublesAgain: {
        const id = playerIdByName(next, params.name)
        if (id !== null && isBotControlled(next, id)) {
          emotions.push({ playerId: id, emoticon: Emoticon.Happy })
        }
        break
      }
      default:
        break
    }
  }
  return emotions
}
