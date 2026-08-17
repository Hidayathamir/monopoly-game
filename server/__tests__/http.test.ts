import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AddressInfo } from 'node:net'
import { WebSocket } from 'ws'
import { createServer } from '../http'
import type { ServerMessage } from '../../src/types/net'
import { createSeededState } from '../../src/logic/seed'

let httpServer: ReturnType<typeof createServer>['httpServer']
let port: number
let dir: string

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'monopoly-'))
  writeFileSync(join(dir, 'index.html'), '<html>hello</html>')
  const created = createServer(dir)
  httpServer = created.httpServer
  await new Promise<void>((resolve) => httpServer.listen(0, resolve))
  port = (httpServer.address() as AddressInfo).port
})

afterAll(() => {
  httpServer.close()
})

function connect(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}/ws`)
    ws.on('open', () => resolve(ws))
    ws.on('error', reject)
  })
}

function waitFor(ws: WebSocket, type: ServerMessage['type']): Promise<ServerMessage> {
  return new Promise((resolve) => {
    const handler = (raw: unknown) => {
      const msg = JSON.parse((raw as Buffer).toString()) as ServerMessage
      if (msg.type === type) {
        ws.off('message', handler)
        resolve(msg)
      }
    }
    ws.on('message', handler)
  })
}

describe('http server', () => {
  it('creates a room and welcomes the host with a code', async () => {
    const ws = await connect()
    const welcome = waitFor(ws, 'welcome')
    ws.send(JSON.stringify({ type: 'create', name: 'Alice' }))
    const msg = await welcome
    expect(msg.type).toBe('welcome')
    if (msg.type === 'welcome') {
      expect(msg.playerId).toBe(0)
      expect(msg.hostPlayerId).toBe(0)
      expect(msg.code).toMatch(/^[A-Z0-9]{5}$/)
    }
    ws.close()
  })

  it('lets a second client join by code and broadcasts the lobby', async () => {
    const a = await connect()
    const welcomeA = waitFor(a, 'welcome')
    a.send(JSON.stringify({ type: 'create', name: 'Alice' }))
    const wA = await welcomeA
    const code = wA.type === 'welcome' ? wA.code : ''

    const b = await connect()
    const lobbyA = waitFor(a, 'lobby')
    b.send(JSON.stringify({ type: 'join', code, name: 'Bob' }))
    const msg = await lobbyA
    expect(msg.type).toBe('lobby')
    if (msg.type === 'lobby') expect(msg.players.filter((p) => p.name)).toHaveLength(2)
    a.close()
    b.close()
  })

  it('rejects joining a nonexistent room', async () => {
    const ws = await connect()
    const err = waitFor(ws, 'error')
    ws.send(JSON.stringify({ type: 'join', code: 'ZZZZZ', name: 'Bob' }))
    const msg = await err
    expect(msg.type).toBe('error')
    if (msg.type === 'error') expect(msg.message).toBe('Ruangan tidak ditemukan')
    ws.close()
  })

  it('lets a client who failed to join leave and receive Left', async () => {
    const ws = await connect()
    const err = waitFor(ws, 'error')
    ws.send(JSON.stringify({ type: 'join', code: 'ZZZZZ', name: 'Bob' }))
    await err
    const left = waitFor(ws, 'left')
    ws.send(JSON.stringify({ type: 'leave' }))
    const msg = await left
    expect(msg.type).toBe('left')
    ws.close()
  })

  it('serves static files and rejects path traversal', async () => {
    const res = await fetch(`http://localhost:${port}/`)
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('hello')

    const traversal = await fetch(`http://localhost:${port}/../../etc/passwd`)
    expect(traversal.status).toBeGreaterThanOrEqual(400)
  })

  it('GET /rooms returns the room list as JSON', async () => {
    const ws = await connect()
    const welcome = waitFor(ws, 'welcome')
    ws.send(JSON.stringify({ type: 'create', name: 'Alice' }))
    const msg = await welcome
    const code = msg.type === 'welcome' ? msg.code : ''

    const res = await fetch(`http://localhost:${port}/rooms`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/json')
    const rooms = (await res.json()) as Array<{ code: string; hostName: string; playerCount: number; phase: string }>
    const mine = rooms.find((r) => r.code === code)
    expect(mine).toBeDefined()
    expect(mine?.hostName).toBe('Alice')
    expect(mine?.playerCount).toBe(1)
    expect(mine?.phase).toBe('setup')
    ws.close()
  })

  it('seeds rooms with the configured tradesEnabled flag', () => {
    const enabled = createServer(dir, { tradesEnabled: true })
    expect(enabled.roomManager.create().game.getState().tradesEnabled).toBe(true)
    const disabled = createServer(dir)
    expect(disabled.roomManager.create().game.getState().tradesEnabled).toBe(false)
  })

  it('GET /config reflects the seedEnabled flag', async () => {
    const res = await fetch(`http://localhost:${port}/config`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ seedEnabled: false })
  })

  it('POST /seed returns 403 when seeding is disabled', async () => {
    const res = await fetch(`http://localhost:${port}/seed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'ABC12', state: {} }),
    })
    expect(res.status).toBe(403)
  })

  it('POST /seed rejects a null JSON body with 400', async () => {
    const created = createServer(dir, { seedEnabled: true })
    const server = created.httpServer
    await new Promise<void>((resolve) => server.listen(0, resolve))
    const seedPort = (server.address() as AddressInfo).port

    const res = await fetch(`http://localhost:${seedPort}/seed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(null),
    })
    expect(res.status).toBe(400)
    server.close()
  })

  it('POST /seed seeds a room and broadcasts the state when enabled', async () => {
    const created = createServer(dir, { seedEnabled: true })
    const server = created.httpServer
    await new Promise<void>((resolve) => server.listen(0, resolve))
    const seedPort = (server.address() as AddressInfo).port

    const ws = await new Promise<WebSocket>((resolve, reject) => {
      const s = new WebSocket(`ws://localhost:${seedPort}/ws`)
      s.on('open', () => resolve(s))
      s.on('error', reject)
    })
    const welcome = waitFor(ws, 'welcome')
    ws.send(JSON.stringify({ type: 'create', name: 'Alice' }))
    const w = (await welcome) as Extract<ServerMessage, { type: 'welcome' }>
    const state = createSeededState({ players: [{ id: 0, name: 'Alice', money: 100 }], currentPlayer: 0 })

    const stateMsg = waitFor(ws, 'state')
    const res = await fetch(`http://localhost:${seedPort}/seed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: w.code, state }),
    })
    expect(res.status).toBe(200)
    const msg = (await stateMsg) as Extract<ServerMessage, { type: 'state' }>
    expect(msg.state.phase).toBe('waiting')
    expect(msg.state.players[0].money).toBe(100)
    ws.close()
    server.close()
  })

  it('POST /seed returns 404 for an unknown room and 400 for an invalid state', async () => {
    const created = createServer(dir, { seedEnabled: true })
    const server = created.httpServer
    await new Promise<void>((resolve) => server.listen(0, resolve))
    const seedPort = (server.address() as AddressInfo).port

    const state = createSeededState({ players: [{ id: 0, name: 'Alice', money: 100 }], currentPlayer: 0 })
    const missing = await fetch(`http://localhost:${seedPort}/seed`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'ZZZZZ', state }),
    })
    expect(missing.status).toBe(404)

    const bad = await fetch(`http://localhost:${seedPort}/seed`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'ABC12', state: { ...state, board: state.board.slice(0, 10) } }),
    })
    expect(bad.status).toBe(400)
    server.close()
  })
})
