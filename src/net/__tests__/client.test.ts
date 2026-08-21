// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { GameClient } from '../client'
import type { ServerMessage } from '../../types/net'

class FakeWebSocket {
  sent: string[] = []
  readyState = 1
  onopen: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  send(data: string) {
    this.sent.push(data)
  }
  close() {}
  emitMessage(obj: ServerMessage) {
    this.onmessage?.({ data: JSON.stringify(obj) })
  }
}

function setup() {
  const sockets: FakeWebSocket[] = []
  const received: ServerMessage[] = []
  const client = new GameClient(
    { onMessage: (m) => received.push(m) },
    {
      WebSocketImpl: (class extends FakeWebSocket {
        constructor() {
          super()
          sockets.push(this)
        }
      }) as unknown as typeof WebSocket,
    },
  )
  return { client, received, getInstance: () => sockets[0] ?? null }
}

describe('GameClient', () => {
  it('buffers messages until open and flushes after', () => {
    const { client, getInstance } = setup()
    // readyState CONNECTING → messages queued
    client.connect()
    const ws = getInstance()!
    ws.readyState = 0
    client.send({ type: 'create', name: 'Alice' })
    expect(ws.sent).toHaveLength(0)
    ws.readyState = 1
    ws.onopen?.()
    expect(ws.sent).toHaveLength(1)
    expect(JSON.parse(ws.sent[0])).toEqual({ type: 'create', name: 'Alice' })
  })

  it('serializes leave messages', () => {
    const { client, getInstance } = setup()
    client.connect()
    getInstance()!.readyState = 1
    client.send({ type: 'leave' })
    expect(JSON.parse(getInstance()!.sent[0])).toEqual({ type: 'leave' })
  })

  it('serializes setIdentity messages', () => {
    const { client, getInstance } = setup()
    client.connect()
    getInstance()!.readyState = 1
    client.send({ type: 'setIdentity', color: '#fff' })
    expect(JSON.parse(getInstance()!.sent[0])).toEqual({ type: 'setIdentity', color: '#fff' })
  })

  it('parses and forwards server messages', () => {
    const { client, received, getInstance } = setup()
    client.connect()
    getInstance()!.emitMessage({ type: 'error', message: 'boom' })
    expect(received).toEqual([{ type: 'error', message: 'boom' }])
  })
})
