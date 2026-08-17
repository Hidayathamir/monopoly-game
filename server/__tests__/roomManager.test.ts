import { describe, it, expect } from 'vitest'
import { RoomManager } from '../roomManager'
import { GamePhase } from '../../src/types/game'
import type { ServerMessage } from '../../src/types/net'

function setup() {
  const sent: { clientId: string; message: ServerMessage }[] = []
  const rm = new RoomManager({ send: (clientId, message) => sent.push({ clientId, message }) })
  return { rm, sent }
}

describe('RoomManager', () => {
  it('generates a unique 5-char code', () => {
    const { rm } = setup()
    const a = rm.create()
    const b = rm.create()
    expect(a.code).toMatch(/^[A-Z0-9]{5}$/)
    expect(b.code).not.toBe(a.code)
  })

  it('broadcasts only to members of the room', () => {
    const { rm, sent } = setup()
    const { code: codeA, game: gameA } = rm.create()
    const { code: codeB } = rm.create()
    rm.addClient(codeA, 'c1')
    rm.addClient(codeB, 'c2')
    gameA.join('c1', 'Alice')
    const statesToC1 = sent.filter((s) => s.clientId === 'c1' && s.message.type === 'state')
    const statesToC2 = sent.filter((s) => s.clientId === 'c2' && s.message.type === 'state')
    expect(statesToC1.length).toBeGreaterThan(0)
    expect(statesToC2).toHaveLength(0)
  })

  it('deletes a room when its last member leaves an empty lobby', () => {
    const { rm } = setup()
    const { code, game } = rm.create()
    rm.addClient(code, 'c1')
    game.join('c1', 'Alice')
    game.leave('c1')
    rm.removeClient('c1')
    expect(rm.get(code)).toBeUndefined()
  })

  it('keeps a room when a named slot is reserved by a disconnect', () => {
    const { rm } = setup()
    const { code, game } = rm.create()
    rm.addClient(code, 'c1')
    game.join('c1', 'Alice')
    game.disconnect('c1')
    rm.removeClient('c1')
    expect(rm.get(code)).toBeDefined()
  })

  it('seeds created games with tradesEnabled from config (default false)', () => {
    const { rm } = setup()
    expect(rm.create().game.getState().tradesEnabled).toBe(false)
  })

  it('seeds created games with tradesEnabled true', () => {
    const sent: { clientId: string; message: ServerMessage }[] = []
    const rm = new RoomManager({ send: (clientId, message) => sent.push({ clientId, message }) }, { tradesEnabled: true })
    expect(rm.create().game.getState().tradesEnabled).toBe(true)
  })

  it('lists a lobby room snapshot with host, player count, and phase', () => {
    const { rm } = setup()
    const { code, game } = rm.create()
    rm.addClient(code, 'c1')
    game.join('c1', 'Alice')
    const list = rm.list()
    expect(list).toHaveLength(1)
    expect(list[0]).toEqual({ code, hostName: 'Alice', playerCount: 1, phase: GamePhase.Setup })
  })

  it('reports an in-game room in the list', () => {
    const { rm } = setup()
    const { code, game } = rm.create()
    rm.addClient(code, 'c1')
    rm.addClient(code, 'c2')
    game.join('c1', 'Alice')
    game.join('c2', 'Bob')
    game.start('c1')
    const list = rm.list()
    expect(list[0].phase).not.toBe(GamePhase.Setup)
    expect(list[0].playerCount).toBe(2)
  })
})
