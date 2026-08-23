import { describe, it, expect, vi, afterEach } from 'vitest'
import { GameServer } from '../gameServer'
import { GamePhase, PendingActionType } from '../../src/types/game'
import { ServerMessageType } from '../../src/types/net'
import type { ServerMessage } from '../../src/types/net'
import { Emoticon } from '../../src/types/emotion'
import { createSeededState } from '../../src/logic/seed'

function setup(opts?: { seedEnabled?: boolean; rng?: () => number }) {
  vi.spyOn(Math, 'random').mockReturnValue(0.5)
  const sent: ServerMessage[] = []
  const server = new GameServer(
    {
      broadcastState: (state) => sent.push({ type: ServerMessageType.State, state }),
      broadcastLobby: (players, hostPlayerId) => sent.push({ type: ServerMessageType.Lobby, players, hostPlayerId }),
      broadcastEmoticon: (em) => sent.push({ type: ServerMessageType.Emoticon, playerId: em.playerId, emoticon: em.emoticon }),
      send: (_id, msg) => sent.push(msg),
    },
    opts,
  )
  return { server, sent }
}

function emoticonMessages(sent: ServerMessage[]) {
  return sent.filter((m): m is { type: string; playerId: number; emoticon: Emoticon } => m.type === ServerMessageType.Emoticon)
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('GameServer emoticons', () => {
  it('broadcasts an emoticon from a joined player during the game', () => {
    const { server, sent } = setup()
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    server.start('c0')
    server.emitEmoticon('c0', Emoticon.Happy)
    expect(emoticonMessages(sent)).toEqual([{ type: ServerMessageType.Emoticon, playerId: 0, emoticon: Emoticon.Happy }])
  })

  it('enforces the 1s cooldown per player', () => {
    vi.useFakeTimers()
    vi.setSystemTime(10_000)
    const { server, sent } = setup()
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    server.start('c0')

    server.emitEmoticon('c0', Emoticon.Happy)
    vi.setSystemTime(10_999) // +999ms
    server.emitEmoticon('c0', Emoticon.Angry)
    expect(emoticonMessages(sent)).toHaveLength(1)

    vi.setSystemTime(11_000) // +1000ms
    server.emitEmoticon('c0', Emoticon.Angry)
    expect(emoticonMessages(sent)).toHaveLength(2)
    vi.useRealTimers()
  })

  it('still broadcasts while dice are rolling (Rolling phase)', () => {
    vi.useFakeTimers()
    const { server, sent } = setup()
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    server.start('c0')
    server.roll('c0') // phase -> Rolling
    expect(server.getState().phase).toBe(GamePhase.Rolling)
    server.emitEmoticon('c0', Emoticon.Happy)
    expect(emoticonMessages(sent)).toEqual([{ type: ServerMessageType.Emoticon, playerId: 0, emoticon: Emoticon.Happy }])
    vi.useRealTimers()
  })

  it('does not broadcast before the game starts (Setup phase)', () => {
    const { server, sent } = setup()
    server.join('c0', 'Alice')
    server.emitEmoticon('c0', Emoticon.Happy)
    expect(emoticonMessages(sent)).toHaveLength(0)
  })

  it('drops unknown emoticon values', () => {
    const { server, sent } = setup()
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    server.start('c0')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    server.emitEmoticon('c0', 'lol' as any)
    expect(emoticonMessages(sent)).toHaveLength(0)
  })

  it('emits sad from a bot that declares bankruptcy, respecting the cooldown', () => {
    vi.useFakeTimers()
    // Base time must be > EMOTICON_COOLDOWN_MS: the cooldown map defaults
    // "last emission" to 0, so starting at t=0 would suppress the first emit.
    vi.setSystemTime(5_000)
    const { server, sent } = setup({ seedEnabled: true })
    server.join('c0', 'Alice')
    server.addBot('c0') // slot 1 is the bot

    const bankruptcySeed = createSeededState({
      players: [
        { id: 0, name: 'Alice', money: 1000 },
        { id: 1, name: 'Droid', money: 0, isBot: true },
      ],
      currentPlayer: 1,
      turnOrder: [0, 1],
      phase: GamePhase.Resolving,
      pendingAction: { type: PendingActionType.Bankruptcy, amount: 1000, spaceId: 39 },
    })

    server.seedState(bankruptcySeed)
    vi.advanceTimersByTime(700) // bot declares bankruptcy at t=5700
    expect(emoticonMessages(sent)).toEqual([{ type: ServerMessageType.Emoticon, playerId: 1, emoticon: Emoticon.Sad }])

    // Second bankruptcy inside the cooldown window must be suppressed.
    vi.advanceTimersByTime(100) // t=5800
    server.seedState(bankruptcySeed)
    vi.advanceTimersByTime(700) // bot declares bankruptcy at t=6500, still < 1000 after the first emit at t=5700
    expect(emoticonMessages(sent)).toHaveLength(1)

    // After the cooldown elapses, a new event emits again.
    vi.advanceTimersByTime(5_000) // t=11500
    server.seedState(bankruptcySeed)
    vi.advanceTimersByTime(700) // bot declares bankruptcy at t=12200 (6500 >= 1000 after the first emit at t=5700)
    expect(emoticonMessages(sent)).toHaveLength(2)
    vi.useRealTimers()
  })
})
