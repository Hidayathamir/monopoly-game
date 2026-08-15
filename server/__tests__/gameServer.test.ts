import { describe, it, expect, vi, afterEach } from 'vitest'
import { GameServer } from '../gameServer'
import { GamePhase } from '../../src/types/game'
import type { ServerMessage } from '../../src/types/net'

function setup(opts?: { rng?: () => number; code?: string }) {
  const sent: ServerMessage[] = []
  const server = new GameServer(
    {
      broadcastState: () => {},
      broadcastLobby: () => {},
      send: (_id, msg) => sent.push(msg),
    },
    opts,
  )
  return { server, sent }
}

describe('GameServer', () => {
  afterEach(() => vi.useRealTimers())

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

  it('reclaims a disconnected slot on rejoin with the same name', () => {
    const { server } = setup()
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    server.disconnect('c1')
    server.join('c2', 'Bob')
    expect(server.getPlayers().find((p) => p.id === 1)?.connected).toBe(true)
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

  it('skips the turn of a player who leaves mid-game', () => {
    const { server } = setup()
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    server.start('c0')
    expect(server.getState().currentPlayer).toBe(0)
    server.leave('c0')
    expect(server.getState().currentPlayer).toBe(1)
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
})
