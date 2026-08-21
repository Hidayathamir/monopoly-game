import { describe, it, expect, vi, afterEach } from 'vitest'
import { GameServer } from '../gameServer'
import { GamePhase, PendingActionType, AvatarKind } from '../../src/types/game'
import { createSeededState } from '../../src/logic/seed'
import { ServerMessageType } from '../../src/types/net'
import type { ServerMessage } from '../../src/types/net'
import { PLAYER_COLORS } from '../../src/data/players'
import { DEFAULT_AVATAR, PRESET_AVATARS } from '../../src/data/avatars'

function setup(opts?: { rng?: () => number; code?: string; tradesEnabled?: boolean; seedEnabled?: boolean; afkTimeoutMs?: number }) {
  vi.spyOn(Math, 'random').mockReturnValue(0.5)
  const sent: ServerMessage[] = []
  const server = new GameServer(
    {
      broadcastState: (state) => sent.push({ type: ServerMessageType.State, state }),
      broadcastLobby: (players, hostPlayerId) => sent.push({ type: ServerMessageType.Lobby, players, hostPlayerId }),
      send: (_id, msg) => sent.push(msg),
    },
    opts,
  )
  return { server, sent }
}

describe('GameServer', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('assigns slot 0 to the first joiner and slot 1 to the second', () => {
    const { server, sent } = setup()
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    expect(sent.find((m) => m.type === 'welcome' && m.playerId === 0)).toBeDefined()
    expect(sent.find((m) => m.type === 'welcome' && m.playerId === 1)).toBeDefined()
    expect(server.getPlayers().filter((p) => p.name)).toHaveLength(2)
  })

  it('rejects a duplicate active name', () => {
    const { server, sent } = setup()
    server.join('c0', 'Alice')
    server.join('c1', 'Alice')
    expect(sent.some((m) => m.type === 'error' && m.message === 'Nama sudah dipakai')).toBe(true)
  })

  it('rejects joining when the room is full', () => {
    const { server, sent } = setup()
    for (let i = 0; i < 6; i++) server.join(`c${i}`, `P${i}`)
    server.join('c6', 'Extra')
    expect(sent.some((m) => m.type === 'error' && m.message === 'Ruangan penuh (maks 6 pemain)')).toBe(true)
  })

  it('only the host (slot 0) can start the game', () => {
    const { server } = setup()
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    server.start('c1')
    expect(server.getState().phase).toBe(GamePhase.Setup)
    server.start('c0')
    expect(server.getState().phase).toBe(GamePhase.Waiting)
    expect(server.getState().players.map((p) => p.name)).toEqual(['Alice', 'Bob'])
  })

  it('rejects out-of-turn actions', () => {
    const { server } = setup()
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    server.start('c0')
    // It is player 0's turn; player 1 tries to roll.
    server.handleAction('c1', { type: 'ROLL_DICE' })
    expect(server.getState().phase).toBe(GamePhase.Waiting)
  })

  it('rolls authoritative dice and advances the turn flow', () => {
    vi.useFakeTimers()
    let n = 0
    const rng = () => ([0, 0.5][n++] ?? 0) // dice [1, 4], sum 5
    const { server } = setup({ rng })
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    server.start('c0')

    server.roll('c0')
    expect(server.getState().phase).toBe(GamePhase.Rolling)

    vi.advanceTimersByTime(500)
    expect(server.getState().dice).toEqual([1, 4])
    expect(server.getState().players[0].position).toBe(5)

    vi.advanceTimersByTime(500 + 5 * 150)
    // Landed on railroad (space 5), unowned, not yet passed Go → back to waiting.
    expect(server.getState().phase).toBe(GamePhase.Waiting)
  })

  it('rolls controlled dice toward the client target', () => {
    vi.useFakeTimers()
    let n = 0
    const rng = () => ([0.5, 0.5, 0.5][n++] ?? 0.5) // luck 50, total 8, pair (4,4)
    const { server } = setup({ rng })
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    server.start('c0')

    server.roll('c0', 8)
    expect(server.getState().phase).toBe(GamePhase.Rolling)

    vi.advanceTimersByTime(500)
    expect(server.getState().dice).toEqual([4, 4])
    const entry = server.getState().eventLog[server.getState().eventLog.length - 1]
    expect(entry.key).toBe('event.rolledAimed')
    expect(entry.params).toEqual(expect.objectContaining({ target: 8, luck: 50 }))
  })

  it('reclaims a disconnected slot on rejoin with the same name', () => {
    const { server } = setup()
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    server.disconnect('c1')
    server.join('c2', 'Bob')
    expect(server.getPlayers().find((p) => p.id === 1)?.connected).toBe(true)
  })

  it('marks a connected human AFK after the timeout and the bot plays their turn', () => {
    vi.useFakeTimers()
    let n = 0
    const rng = () => ([0, 0.5][n++] ?? 0) // dice [1,4]
    const { server } = setup({ rng, afkTimeoutMs: 1_000 })
    server.join('c0', 'Alice')
    server.addBot('c0')
    server.start('c0')
    expect(server.getState().currentPlayer).toBe(0)

    // The human decides for the whole AFK window without acting.
    vi.advanceTimersByTime(999)
    expect(server.getState().players[0].botControlled).toBe(false)

    vi.advanceTimersByTime(1) // AFK fires → bot-controlled + afk log
    expect(server.getState().players[0].botControlled).toBe(true)
    expect(server.getState().eventLog.some((e) => e.key === 'event.playerAfk')).toBe(true)

    // The bot plays the turn at normal bot speed (no reconnect grace).
    vi.advanceTimersByTime(700) // bot rolls
    expect(server.getState().phase).toBe(GamePhase.Rolling)
    vi.advanceTimersByTime(500) // DICE_ANIMATED
    expect(server.getState().dice).toEqual([1, 4])
    vi.advanceTimersByTime(500 + 5 * 150) // RESOLVE_SPACE (space 5 unowned → Waiting)
    expect(server.getState().phase).toBe(GamePhase.Waiting)
    vi.advanceTimersByTime(700) // END_TURN → bot's turn
    expect(server.getState().currentPlayer).toBe(1)
    vi.useRealTimers()
  })

  it('a connected AFK human who acts takes back control immediately', () => {
    vi.useFakeTimers()
    let n = 0
    const rng = () => ([0, 0.5][n++] ?? 0) // dice [1,4]
    const { server } = setup({ rng, afkTimeoutMs: 1_000 })
    server.join('c0', 'Alice')
    server.addBot('c0')
    server.start('c0')

    vi.advanceTimersByTime(1_000) // AFK fires
    expect(server.getState().players[0].botControlled).toBe(true)

    server.roll('c0') // human acts anyway
    expect(server.getState().players[0].botControlled).toBe(false)
    expect(server.getState().eventLog.some((e) => e.key === 'event.playerBack')).toBe(true)
    expect(server.getState().phase).toBe(GamePhase.Rolling)

    // A stale bot timer must not play their turn afterwards.
    vi.advanceTimersByTime(700)
    expect(server.getState().players[0].botControlled).toBe(false)
    vi.useRealTimers()
  })

  it('stop() clears pending bot and afk timers', () => {
    vi.useFakeTimers()
    const { server } = setup({ afkTimeoutMs: 1_000 })
    server.join('c0', 'Alice')
    server.addBot('c0')
    server.start('c0')

    server.stop()
    vi.advanceTimersByTime(5_000)
    expect(server.getState().players[0].botControlled).toBe(false)
    vi.useRealTimers()
  })

  it('ends the turn and advances to the next player', () => {
    vi.useFakeTimers()
    let n = 0
    const rng = () => ([0, 0.5][n++] ?? 0) // dice [1, 4], sum 5
    const { server } = setup({ rng })
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    server.start('c0')

    server.roll('c0')
    vi.advanceTimersByTime(500)
    vi.advanceTimersByTime(500 + 5 * 150)
    expect(server.getState().phase).toBe(GamePhase.Waiting)

    server.handleAction('c0', { type: 'END_TURN' })
    expect(server.getState().currentPlayer).toBe(1)
    expect(server.getState().dice).toBeNull()
  })

  it('does not auto-advance after doubles until an explicit END_TURN', () => {
    vi.useFakeTimers()
    const rng = () => 0.5 // dice [4,4], doubles
    const { server } = setup({ rng })
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    server.start('c0')

    server.roll('c0')
    vi.advanceTimersByTime(500) // DICE_ANIMATED
    expect(server.getState().dice).toEqual([4, 4])
    expect(server.getState().doublesCount).toBe(1)

    vi.advanceTimersByTime(500 + 8 * 150) // RESOLVE_SPACE (space 8 unowned → mustCircleBoard → Waiting)
    expect(server.getState().phase).toBe(GamePhase.Waiting)

    vi.advanceTimersByTime(500) // previously auto END_TURN
    expect(server.getState().dice).toEqual([4, 4])
    expect(server.getState().currentPlayer).toBe(0)
    expect(server.getState().eventLog.some((e) => e.key === 'event.doublesAgain')).toBe(false)
    vi.useRealTimers()
  })

  it('does not start with only one connected player after a disconnect', () => {
    const { server } = setup()
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    server.disconnect('c1')
    server.start('c0')
    expect(server.getState().phase).toBe(GamePhase.Setup)
  })

  it('includes the room code and hostPlayerId in welcome', () => {
    const { server, sent } = setup({ code: 'ABC12' })
    server.join('c0', 'Alice')
    const welcome = sent.find((m) => m.type === 'welcome')
    expect(welcome).toBeDefined()
    if (welcome && welcome.type === 'welcome') {
      expect(welcome.code).toBe('ABC12')
      expect(welcome.hostPlayerId).toBe(0)
    }
  })

  it('transfers host to the next player when the host leaves the lobby', () => {
    const { server } = setup()
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    server.join('c2', 'Charlie')
    server.leave('c0')
    expect(server.getHostPlayerId()).toBe(1)
    server.start('c1')
    expect(server.getState().phase).toBe(GamePhase.Waiting)
  })

  it('transfers host when the host disconnects in the lobby', () => {
    const { server } = setup()
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    server.join('c2', 'Charlie')
    server.disconnect('c0')
    expect(server.getHostPlayerId()).toBe(1)
    server.start('c1')
    expect(server.getState().phase).toBe(GamePhase.Waiting)
  })

  it('frees the seat when a player leaves the lobby', () => {
    const { server } = setup()
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    server.leave('c0')
    expect(server.getPlayers()[0].name).toBeNull()
    server.join('c2', 'Charlie')
    expect(server.getPlayers()[0].name).toBe('Charlie')
  })

  it('hands an offline player to the bot after a 3s grace period', () => {
    vi.useFakeTimers()
    let n = 0
    const rng = () => ([0, 0.5][n++] ?? 0) // dice [1,4]
    const { server } = setup({ rng })
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    server.start('c0')
    expect(server.getState().currentPlayer).toBe(0)

    server.leave('c0')
    expect(server.getState().currentPlayer).toBe(0) // no auto-skip anymore
    expect(server.getState().players[0].botControlled).toBe(true)
    expect(server.getState().eventLog.some((e) => e.key === 'event.playerOffline')).toBe(true)
    expect(server.getState().reconnectGrace?.playerId).toBe(0)

    vi.advanceTimersByTime(2_000)
    expect(server.getState().phase).toBe(GamePhase.Waiting) // still inside the grace window
    expect(server.getState().reconnectGrace?.playerId).toBe(0)

    vi.advanceTimersByTime(1_000) // grace elapsed → bot rolls
    expect(server.getState().phase).toBe(GamePhase.Rolling)
    expect(server.getState().reconnectGrace).toBeNull()

    vi.advanceTimersByTime(500) // DICE_ANIMATED
    expect(server.getState().dice).toEqual([1, 4])
    const roll = server.getState().eventLog.filter((e) => e.key === 'event.rolled').at(-1)
    expect(roll?.params?.bot).toBe(true)

    vi.advanceTimersByTime(500 + 5 * 150) // RESOLVE_SPACE (space 5 unowned, not passed Go → Waiting)
    expect(server.getState().phase).toBe(GamePhase.Waiting)

    vi.advanceTimersByTime(700) // next bot step → END_TURN
    expect(server.getState().currentPlayer).toBe(1)
    vi.useRealTimers()
  })

  it('reconnect within the grace period hands control back to the human', () => {
    vi.useFakeTimers()
    const { server } = setup()
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    server.start('c0')
    expect(server.getState().currentPlayer).toBe(0)

    server.leave('c0')
    expect(server.getState().players[0].botControlled).toBe(true)
    expect(server.getState().reconnectGrace?.playerId).toBe(0)

    server.join('c9', 'Alice') // rejoins within the 3s grace
    expect(server.getState().players[0].botControlled).toBe(false)
    expect(server.getState().currentPlayer).toBe(0)
    expect(server.getState().eventLog.some((e) => e.key === 'event.playerBack')).toBe(true)
    expect(server.getState().reconnectGrace).toBeNull()

    vi.advanceTimersByTime(3_000) // stale grace timer fires but the slot is connected → no roll
    expect(server.getState().phase).toBe(GamePhase.Waiting)
    expect(server.getState().dice).toBeNull()
    vi.useRealTimers()
  })

  it('does not let a concurrent action cancel the offline player grace period', () => {
    vi.useFakeTimers()
    let n = 0
    const rng = () => ([0, 0.5][n++] ?? 0) // dice [1,4]
    const { server } = setup({ rng })
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    server.start('c0')
    expect(server.getState().currentPlayer).toBe(0)

    server.leave('c0') // Alice offline; grace timer scheduled (3s)
    expect(server.getState().players[0].botControlled).toBe(true)

    // A different player disconnects and reconnects during Alice's grace window — each
    // dispatches an action (SetBotControl), which previously rescheduled the bot to 700ms.
    server.disconnect('c1')
    server.join('c9', 'Bob')
    expect(server.getState().players[1].botControlled).toBe(false)

    vi.advanceTimersByTime(700) // the old buggy behavior would roll here
    expect(server.getState().phase).toBe(GamePhase.Waiting) // still inside the grace window
    expect(server.getState().dice).toBeNull()

    vi.advanceTimersByTime(2_300) // grace elapsed → bot rolls
    expect(server.getState().phase).toBe(GamePhase.Rolling)
    vi.useRealTimers()
  })

  it('ignores SET_BOT_CONTROL sent by a client', () => {
    vi.useFakeTimers()
    const { server } = setup()
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    server.start('c0')

    server.disconnect('c1') // server legitimately bot-controls player 1
    expect(server.getState().players[1].botControlled).toBe(true)

    server.handleAction('c0', { type: 'SET_BOT_CONTROL', playerId: 1, controlled: false }) // a client tries to clear it
    expect(server.getState().players[1].botControlled).toBe(true) // guard blocks it
    expect(server.getState().eventLog.filter((e) => e.key === 'event.playerBack')).toHaveLength(0)
    vi.useRealTimers()
  })

  it('applies the reconnect grace only on the first turn after a disconnect', () => {
    vi.useFakeTimers()
    let n = 0
    const rng = () => ([0, 0.5][n++] ?? 0) // dice [1,4]
    const { server } = setup({ rng })
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    server.start('c0')

    server.leave('c0') // Alice offline → grace pending
    expect(server.getState().reconnectGrace?.playerId).toBe(0)
    expect(server.getState().eventLog.filter((e) => e.key === 'event.reconnectWait')).toHaveLength(1)

    // First turn: grace then the bot plays it out.
    vi.advanceTimersByTime(3_000) // grace elapsed → bot rolls
    vi.advanceTimersByTime(500) // DICE_ANIMATED
    vi.advanceTimersByTime(500 + 5 * 150) // RESOLVE_SPACE (space 5 → must circle → Waiting)
    vi.advanceTimersByTime(700) // END_TURN → Bob's turn
    expect(server.getState().currentPlayer).toBe(1)
    expect(server.getState().reconnectGrace).toBeNull()

    // Bob ends his turn without rolling.
    server.handleAction('c1', { type: 'END_TURN' })
    expect(server.getState().currentPlayer).toBe(0)

    // Second turn: no grace — the bot steps at 700ms.
    expect(server.getState().reconnectGrace).toBeNull()
    expect(server.getState().eventLog.filter((e) => e.key === 'event.reconnectWait')).toHaveLength(1)
    vi.advanceTimersByTime(700) // bot rolls immediately (no 3s grace)
    expect(server.getState().phase).toBe(GamePhase.Rolling)
    vi.useRealTimers()
  })

  it('ignores SET_RECONNECT_GRACE sent by a client', () => {
    vi.useFakeTimers()
    const { server } = setup()
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    server.start('c0')

    server.handleAction('c0', { type: 'SET_RECONNECT_GRACE', playerId: 0, until: 999999999 })
    expect(server.getState().reconnectGrace).toBeNull()
    vi.useRealTimers()
  })

  it('lets a mid-game leaver reclaim their slot by name', () => {
    const { server } = setup()
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    server.start('c0')
    server.leave('c0')
    server.join('c9', 'Alice')
    expect(server.getPlayers()[0].connected).toBe(true)
  })

  it('host adds a bot to an empty seat', () => {
    const { server } = setup()
    server.join('c0', 'Alice')
    server.addBot('c0')
    const players = server.getPlayers()
    expect(players[1].isBot).toBe(true)
    expect(players[1].connected).toBe(true)
    expect(players[1].name).toBeTruthy()
  })

  it('addBot does not overwrite a disconnected human seat', () => {
    const { server } = setup()
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    server.disconnect('c1')
    server.addBot('c0')
    const players = server.getPlayers()
    expect(players[1].name).toBe('Bob')
    expect(players[1].isBot).toBe(false)
    expect(players[2].isBot).toBe(true)
    expect(players.filter((p) => p.isBot)).toHaveLength(1)
  })

  it('rejects addBot from a non-host', () => {
    const { server, sent } = setup()
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    server.addBot('c1')
    expect(sent.some((m) => m.type === 'error')).toBe(true)
    expect(server.getPlayers().filter((p) => p.isBot)).toHaveLength(0)
  })

  it('rejects addBot when the game has started', () => {
    const { server } = setup()
    server.join('c0', 'Alice')
    server.addBot('c0')
    server.start('c0')
    server.addBot('c0')
    expect(server.getPlayers().filter((p) => p.isBot)).toHaveLength(1)
  })

  it('removes a bot seat', () => {
    const { server } = setup()
    server.join('c0', 'Alice')
    server.addBot('c0')
    server.removeBot('c0', 1)
    expect(server.getPlayers()[1].isBot).toBe(false)
    expect(server.getPlayers()[1].name).toBeNull()
  })

  it('a joining human replaces the newest bot when all seats are bots', () => {
    const { server } = setup()
    server.join('c0', 'Alice')
    server.addBot('c0')
    server.addBot('c0')
    server.addBot('c0')
    server.addBot('c0')
    server.addBot('c0')
    server.join('c1', 'Bob')
    const players = server.getPlayers()
    expect(players[5].name).toBe('Bob')
    expect(players[5].isBot).toBe(false)
    expect(players.filter((p) => p.isBot)).toHaveLength(4)
  })

  it('starts the game including bot players with isBot stamped', () => {
    const { server } = setup()
    server.join('c0', 'Alice')
    server.addBot('c0')
    server.start('c0')
    expect(server.getState().players.map((p) => p.isBot)).toEqual([false, true])
    expect(server.getState().players.map((p) => p.name)).toEqual(['Alice', expect.any(String)])
  })

  it('auto-plays a full bot turn', () => {
    vi.useFakeTimers()
    let n = 0
    const rng = () => ([0, 0.5][n++] ?? 0) // dice [1,4]
    const { server } = setup({ rng })
    server.join('c0', 'Alice')
    server.addBot('c0')
    server.start('c0')

    server.handleAction('c0', { type: 'END_TURN' })
    expect(server.getState().currentPlayer).toBe(1)

    vi.advanceTimersByTime(700) // bot roll triggered by driveBots
    expect(server.getState().phase).toBe(GamePhase.Rolling)

    vi.advanceTimersByTime(500) // DICE_ANIMATED
    expect(server.getState().dice).toEqual([1, 4])

    vi.advanceTimersByTime(500 + 5 * 150) // RESOLVE_SPACE (space 5, unowned, not passed Go → Waiting)
    expect(server.getState().phase).toBe(GamePhase.Waiting)

    vi.advanceTimersByTime(700) // bot END_TURN
    expect(server.getState().currentPlayer).toBe(0)
    expect(server.getState().dice).toBeNull()
    vi.useRealTimers()
  })

  it('lets the recipient accept a trade even when it is not their turn', () => {
    const { server } = setup({ tradesEnabled: true })
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    server.start('c0')

    server.handleAction('c0', { type: 'PROPOSE_TRADE', offer: {
      fromId: 0, toId: 1, offerProperties: [], offerCash: 0, requestProperties: [], requestCash: 0,
    } })
    const tradeId = server.getState().pendingTrades[0].id
    // c0 is current player; c1 is NOT. The accept must bypass the turn gate.
    server.handleAction('c1', { type: 'ACCEPT_TRADE', tradeId })
    expect(server.getState().pendingTrades).toHaveLength(0)
    expect(server.getState().currentPlayer).toBe(0)
  })

  it('rejects a PROPOSE_TRADE whose fromId is not the sender', () => {
    const { server, sent } = setup({ tradesEnabled: true })
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    server.start('c0')
    server.handleAction('c0', { type: 'PROPOSE_TRADE', offer: {
      fromId: 1, toId: 0, offerProperties: [], offerCash: 0, requestProperties: [], requestCash: 0,
    } })
    expect(sent.some((m) => m.type === 'error')).toBe(true)
    expect(server.getState().pendingTrades).toHaveLength(0)
  })

  it('lets the recipient reject a trade even when it is not their turn', () => {
    const { server } = setup({ tradesEnabled: true })
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    server.start('c0')

    server.handleAction('c0', { type: 'PROPOSE_TRADE', offer: {
      fromId: 0, toId: 1, offerProperties: [], offerCash: 0, requestProperties: [], requestCash: 0,
    } })
    const tradeId = server.getState().pendingTrades[0].id
    // c0 is current player; c1 is NOT. The reject must bypass the turn gate.
    server.handleAction('c1', { type: 'REJECT_TRADE', tradeId })
    expect(server.getState().pendingTrades).toHaveLength(0)
    expect(server.getState().currentPlayer).toBe(0)
  })

  it('rejects a trade response from a player who is not a party', () => {
    const { server, sent } = setup({ tradesEnabled: true })
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    server.join('c2', 'Charlie')
    server.start('c0')
    server.handleAction('c0', { type: 'PROPOSE_TRADE', offer: {
      fromId: 0, toId: 1, offerProperties: [], offerCash: 0, requestProperties: [], requestCash: 0,
    } })
    const tradeId = server.getState().pendingTrades[0].id
    server.handleAction('c2', { type: 'ACCEPT_TRADE', tradeId })
    expect(sent.some((m) => m.type === 'error')).toBe(true)
    expect(server.getState().pendingTrades).toHaveLength(1)
  })

  it('rejects trade actions when trades are disabled', () => {
    const { server, sent } = setup()
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    server.start('c0')
    server.handleAction('c0', { type: 'PROPOSE_TRADE', offer: {
      fromId: 0, toId: 1, offerProperties: [], offerCash: 0, requestProperties: [], requestCash: 0,
    } })
    expect(sent.some((m) => m.type === 'error' && m.message === 'Fitur pertukaran tidak tersedia')).toBe(true)
    expect(server.getState().pendingTrades).toHaveLength(0)
  })

  it('seedState replaces state and broadcasts state + lobby when enabled', () => {
    const { server, sent } = setup({ seedEnabled: true })
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    const seeded = createSeededState({
      players: [
        { id: 0, name: 'Alice', money: 1000 },
        { id: 1, name: 'Bob', money: 1 },
      ],
      board: { 39: { owner: 0, houses: 4 } },
      currentPlayer: 1,
      phase: GamePhase.Resolving,
      pendingAction: { type: PendingActionType.PayRent, spaceId: 39, amount: 1700 },
      tradesEnabled: false,
    })
    server.seedState(seeded)
    expect(server.getState().phase).toBe(GamePhase.Resolving)
    expect(server.getState().players[1].money).toBe(1)
    expect(sent.some((m) => m.type === 'state' && m.state.phase === GamePhase.Resolving)).toBe(true)
    expect(sent.some((m) => m.type === 'lobby')).toBe(true)
  })

  it('seedState throws when seeding is disabled', () => {
    const { server } = setup()
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    const seeded = createSeededState({ players: [{ id: 0, name: 'Alice', money: 100 }], currentPlayer: 0 })
    expect(() => server.seedState(seeded)).toThrow(/disabled/)
  })

  it('seedState throws on an invalid seed (player count mismatch)', () => {
    const { server } = setup({ seedEnabled: true })
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    const seeded = createSeededState({ players: [{ id: 0, name: 'Alice', money: 100 }], currentPlayer: 0 })
    expect(() => server.seedState(seeded)).toThrow(/Invalid seed state/)
  })

  it('seedState cancels a pending bot timer on re-seed', () => {
    vi.useFakeTimers()
    const { server } = setup({ seedEnabled: true })
    server.join('c0', 'Alice')
    server.addBot('c0') // slot 1 is a bot (name Droid)

    const seeded = createSeededState({
      players: [
        { id: 0, name: 'Alice', money: 1000 },
        { id: 1, name: 'Droid', money: 100, isBot: true },
      ],
      currentPlayer: 1,
      turnOrder: [1, 0],
    })
    server.seedState(seeded) // bot turn → driveBots schedules a timer that fires at t=700
    vi.advanceTimersByTime(100)

    server.seedState(seeded) // must cancel the stale timer and re-schedule from now (fires at t=800)
    vi.advanceTimersByTime(600) // t=700 — a surviving pre-seed timer would have fired by now
    expect(server.getState().phase).toBe(GamePhase.Waiting)

    vi.advanceTimersByTime(100) // t=800 — the fresh timer fires and the bot rolls
    expect(server.getState().phase).toBe(GamePhase.Rolling)
  })

  it('seedState resumes bot driving when the seeded current player is a bot', () => {
    vi.useFakeTimers()
    const { server } = setup({ seedEnabled: true })
    server.join('c0', 'Alice')
    server.addBot('c0') // slot 1 is a bot (name Droid)

    const seeded = createSeededState({
      players: [
        { id: 0, name: 'Alice', money: 1000 },
        { id: 1, name: 'Droid', money: 100, isBot: true },
      ],
      currentPlayer: 1,
      turnOrder: [1, 0],
    })
    server.seedState(seeded)
    expect(server.getState().phase).toBe(GamePhase.Waiting)

    vi.advanceTimersByTime(700) // BOT_STEP_MS — the bot's timer fires and it rolls
    expect(server.getState().phase).toBe(GamePhase.Rolling)
  })

  it('auto-assigns the first free color on join and keeps uniqueness', () => {
    const { server } = setup()
    server.join('c0', 'Alice', { color: PLAYER_COLORS[0] })
    server.join('c1', 'Bob', { color: PLAYER_COLORS[0] }) // taken -> first free
    const players = server.getPlayers()
    expect(players[0].color).toBe(PLAYER_COLORS[0])
    expect(players[1].color).toBe(PLAYER_COLORS[1])
  })

  it('stores the requested avatar on the slot and surfaces it via getPlayers', () => {
    const { server } = setup()
    server.join('c0', 'Alice', { avatar: { kind: AvatarKind.Preset, id: PRESET_AVATARS.Dog } })
    expect(server.getPlayers()[0].avatar).toEqual({ kind: AvatarKind.Preset, id: PRESET_AVATARS.Dog })
  })

  it('setIdentity updates color and avatar and broadcasts the lobby', () => {
    const { server, sent } = setup()
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    const before = sent.length
    server.setIdentity('c0', { color: PLAYER_COLORS[4], avatar: { kind: AvatarKind.Preset, id: PRESET_AVATARS.Fox } })
    expect(server.getPlayers()[0].color).toBe(PLAYER_COLORS[4])
    const lobbyMsg = sent.slice(before).find((m) => m.type === 'lobby') as { type: string; players: { color: string }[] } | undefined
    expect(lobbyMsg?.players[0].color).toBe(PLAYER_COLORS[4])
  })

  it('rejects setIdentity onto a color another player holds', () => {
    const { server, sent } = setup()
    server.join('c0', 'Alice', { color: PLAYER_COLORS[0] })
    server.join('c1', 'Bob', { color: PLAYER_COLORS[1] })
    server.setIdentity('c1', { color: PLAYER_COLORS[0] })
    expect(sent.some((m) => m.type === 'error' && m.message === 'Warna sudah dipakai')).toBe(true)
    expect(server.getPlayers()[1].color).toBe(PLAYER_COLORS[1])
  })

  it('rejects setIdentity after the game has started', () => {
    const { server, sent } = setup()
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    server.start('c0')
    server.setIdentity('c0', { color: PLAYER_COLORS[2] })
    expect(sent.some((m) => m.type === 'error')).toBe(true)
    expect(server.getState().players[0].color).not.toBe(PLAYER_COLORS[2])
  })

  it('treats a non-palette color on join as unspecified and auto-assigns the first free', () => {
    const { server } = setup()
    server.join('c0', 'Alice', { color: 'not-a-color' })
    expect(server.getPlayers()[0].color).toBe(PLAYER_COLORS[0])
  })

  it('rejects setIdentity with a non-palette color and leaves the slot color unchanged', () => {
    const { server, sent } = setup()
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    const before = sent.length
    server.setIdentity('c0', { color: 'not-a-color' })
    expect(sent.slice(before).some((m) => m.type === 'error' && m.message === 'Warna tidak valid')).toBe(true)
    expect(server.getPlayers()[0].color).toBe(PLAYER_COLORS[0])
  })

  it('validates everything before mutating: an invalid avatar blocks a valid color with no broadcast', () => {
    const { server, sent } = setup()
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    const before = sent.length
    server.setIdentity('c0', { color: PLAYER_COLORS[4], avatar: { kind: AvatarKind.Custom, dataUrl: 'https://x/y.png' } })
    expect(sent.slice(before).some((m) => m.type === 'error' && m.message === 'Avatar tidak valid')).toBe(true)
    expect(server.getPlayers()[0].color).toBe(PLAYER_COLORS[0])
    expect(sent.slice(before).some((m) => m.type === 'lobby')).toBe(false)
  })

  it('rejects an invalid or oversized custom avatar', () => {
    const { server, sent } = setup()
    server.join('c0', 'Alice')
    server.setIdentity('c0', { avatar: { kind: AvatarKind.Custom, dataUrl: 'https://x/y.png' } })
    expect(sent.some((m) => m.type === 'error')).toBe(true)
  })

  it('assigns bots the next free color and the default avatar', () => {
    const { server } = setup()
    server.join('c0', 'Alice', { color: PLAYER_COLORS[0] })
    server.addBot('c0')
    const players = server.getPlayers()
    expect(players[1].isBot).toBe(true)
    expect(players[1].color).toBe(PLAYER_COLORS[1])
    expect(players[1].avatar).toEqual(DEFAULT_AVATAR)
  })

  it('passes colors and avatars into the StartGame action at start', () => {
    const { server } = setup()
    server.join('c0', 'Alice', { color: PLAYER_COLORS[2], avatar: { kind: AvatarKind.Preset, id: PRESET_AVATARS.Robot } })
    server.join('c1', 'Bob', { color: PLAYER_COLORS[3], avatar: { kind: AvatarKind.Preset, id: PRESET_AVATARS.Ghost } })
    server.start('c0')
    const players = server.getState().players
    expect(players[0].color).toBe(PLAYER_COLORS[2])
    expect(players[1].color).toBe(PLAYER_COLORS[3])
    expect(players[0].avatar).toEqual({ kind: AvatarKind.Preset, id: PRESET_AVATARS.Robot })
    expect(players[1].avatar).toEqual({ kind: AvatarKind.Preset, id: PRESET_AVATARS.Ghost })
  })

  it('preserves identity when a disconnected player rejoins', () => {
    const { server } = setup()
    server.join('c0', 'Alice', { color: PLAYER_COLORS[4] })
    server.join('c1', 'Bob')
    server.start('c0')
    server.disconnect('c0')
    server.join('c9', 'Alice', { color: PLAYER_COLORS[5] }) // in-game reconnect path keeps the slot's identity
    const players = server.getState().players
    expect(players[0].color).toBe(PLAYER_COLORS[4])
    expect(server.getPlayers()[0].color).toBe(PLAYER_COLORS[4])
  })
})
