import { describe, it, expect, vi, afterEach } from 'vitest'
import { GameServer } from '../gameServer'
import { GamePhase } from '../../src/types/game'
import type { ServerMessage } from '../../src/types/net'

function setup(rng?: () => number) {
  const sent: ServerMessage[] = []
  const server = new GameServer(
    {
      broadcastState: () => {},
      broadcastLobby: () => {},
      send: (_id, msg) => sent.push(msg),
    },
    rng ? { rng } : undefined,
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
    expect(sent.some((m) => m.type === 'error' && m.message === 'Kamar penuh (maks 6 pemain)')).toBe(true)
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
    const { server } = setup(rng)
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
    const { server } = setup(rng)
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

  it('auto-advances to roll again after doubles (no explicit end turn)', () => {
    vi.useFakeTimers()
    const rng = () => 0.5 // dice [4,4], doubles
    const { server } = setup(rng)
    server.join('c0', 'Alice')
    server.join('c1', 'Bob')
    server.start('c0')

    server.roll('c0')
    vi.advanceTimersByTime(500) // DICE_ANIMATED
    expect(server.getState().dice).toEqual([4, 4])
    expect(server.getState().doublesCount).toBe(1)

    vi.advanceTimersByTime(500 + 8 * 150) // RESOLVE_SPACE (space 8 = Semarang, unowned)
    expect(server.getState().phase).toBe(GamePhase.Waiting)

    vi.advanceTimersByTime(500) // auto END_TURN
    expect(server.getState().dice).toBeNull()
    expect(server.getState().currentPlayer).toBe(0)
    expect(server.getState().eventLog.some((e) => e.includes('main lagi'))).toBe(true)
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
})
