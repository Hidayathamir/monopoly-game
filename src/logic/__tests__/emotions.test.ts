import { describe, it, expect } from 'vitest'
import { detectBotEmotions } from '../emotions'
import { Emoticon } from '../../types/emotion'
import { createInitialState, gameReducer } from '../gameReducer'
import { GameActionType, LogEventKey, type GameState } from '../../types/game'
import { actorEntry } from '../logEntries'

function makePlayersState(emitterIndex: number, emitterIsBot: boolean): GameState {
  const base = gameReducer(createInitialState(), {
    type: GameActionType.StartGame,
    playerCount: 2,
    names: ['Alice', 'Bob'],
    isBot: [false, true],
  })
  const next = { ...base, eventLog: [] }
  const p = next.players[emitterIndex]
  if (emitterIndex === 0 && !emitterIsBot) return next
  if (emitterIsBot) {
    next.players = next.players.map((pl, i) => (i === emitterIndex ? { ...pl, isBot: true } : pl))
  }
  void p
  return next
}

function withEvent(state: GameState, entries: ReturnType<typeof actorEntry>[]): GameState {
  return { ...state, eventLog: entries }
}

describe('detectBotEmotions', () => {
  it('maps a bot bankruptcy to sad', () => {
    const prev = makePlayersState(1, true)
    const bot = prev.players[1]
    const next = withEvent(prev, [actorEntry(LogEventKey.Bankruptcy, bot)])
    expect(detectBotEmotions(prev, next)).toEqual([{ playerId: 1, emoticon: Emoticon.Sad }])
  })

  it('does not emit for a human bankruptcy', () => {
    const prev = makePlayersState(0, false)
    const human = prev.players[0]
    const next = withEvent(prev, [actorEntry(LogEventKey.Bankruptcy, human)])
    expect(detectBotEmotions(prev, next)).toEqual([])
  })

  it('maps expensive rent (>= threshold) paid by a bot to angry', () => {
    const prev = makePlayersState(1, true)
    const bot = prev.players[1]
    const next = withEvent(prev, [
      { key: LogEventKey.PaidRent, params: { name: bot.name, amount: 300, owner: 'Alice' } },
    ])
    expect(detectBotEmotions(prev, next)).toEqual([{ playerId: 1, emoticon: Emoticon.Angry }])
  })

  it('ignores cheap rent below the threshold', () => {
    const prev = makePlayersState(1, true)
    const bot = prev.players[1]
    const next = withEvent(prev, [
      { key: LogEventKey.PaidRent, params: { name: bot.name, amount: 299, owner: 'Alice' } },
    ])
    expect(detectBotEmotions(prev, next)).toEqual([])
  })

  it('maps a monopoly rent to proud for the owner bot', () => {
    const prev = makePlayersState(1, true)
    const bot = prev.players[1]
    const next = withEvent(prev, [
      { key: LogEventKey.MonopolyRent, params: { owner: bot.name, name: 'Alice' } },
    ])
    expect(detectBotEmotions(prev, next)).toEqual([{ playerId: 1, emoticon: Emoticon.Proud }])
  })

  it('maps a completed trade to happy for each bot party', () => {
    const prev = makePlayersState(1, true)
    const bot = prev.players[1]
    const next = withEvent(prev, [
      { key: LogEventKey.TradeAccepted, params: { from: bot.name, to: 'Alice' } },
    ])
    expect(detectBotEmotions(prev, next)).toEqual([{ playerId: 1, emoticon: Emoticon.Happy }])
  })

  it('maps doubles to happy for the rolling bot', () => {
    const prev = makePlayersState(1, true)
    const bot = prev.players[1]
    const next = withEvent(prev, [actorEntry(LogEventKey.DoublesAgain, bot)])
    expect(detectBotEmotions(prev, next)).toEqual([{ playerId: 1, emoticon: Emoticon.Happy }])
  })

  it('ignores unrelated event-log entries', () => {
    const prev = makePlayersState(1, true)
    const bot = prev.players[1]
    const next = withEvent(prev, [
      { key: LogEventKey.Rolled, params: { name: bot.name, d1: 2, d2: 3, total: 5 } },
      { key: LogEventKey.Turn, params: { name: 'Alice' } },
    ])
    expect(detectBotEmotions(prev, next)).toEqual([])
  })
})
