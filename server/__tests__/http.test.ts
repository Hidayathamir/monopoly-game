import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AddressInfo } from 'node:net'
import { WebSocket } from 'ws'
import { createServer } from '../http'
import type { ServerMessage } from '../../src/types/net'

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

function nextMessage(ws: WebSocket): Promise<ServerMessage> {
  return new Promise((resolve) => {
    ws.on('message', (raw) => resolve(JSON.parse(raw.toString()) as ServerMessage))
  })
}

describe('http server', () => {
  it('welcomes a joining client with playerId 0', async () => {
    const ws = await connect()
    const welcome = nextMessage(ws)
    ws.send(JSON.stringify({ type: 'join', name: 'Alice' }))
    const msg = await welcome
    expect(msg.type).toBe('welcome')
    if (msg.type === 'welcome') expect(msg.playerId).toBe(0)
    ws.close()
  })

  it('broadcasts lobby updates to all clients', async () => {
    const a = await connect()
    a.on('message', () => {})
    a.send(JSON.stringify({ type: 'join', name: 'Alice' }))
    await new Promise((r) => setTimeout(r, 50))

    const b = await connect()
    const lobby = new Promise<ServerMessage>((resolve) => {
      a.on('message', (raw) => {
        const msg = JSON.parse(raw.toString()) as ServerMessage
        if (msg.type === 'lobby') resolve(msg)
      })
    })
    b.send(JSON.stringify({ type: 'join', name: 'Bob' }))
    const msg = await lobby
    expect(msg.type).toBe('lobby')
    if (msg.type === 'lobby') expect(msg.players.filter((p) => p.name)).toHaveLength(2)
    a.close()
    b.close()
  })

  it('serves static files and rejects path traversal', async () => {
    const res = await fetch(`http://localhost:${port}/`)
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('hello')

    const traversal = await fetch(`http://localhost:${port}/../../etc/passwd`)
    expect(traversal.status).toBeGreaterThanOrEqual(400)
  })
})
