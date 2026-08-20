import { createServer as createHttpServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join, extname, resolve, relative, isAbsolute } from 'node:path'
import { WebSocketServer, WebSocket } from 'ws'
import { RoomManager } from './roomManager'
import { ClientMessageType, HttpPath, ServerMessageType } from '../src/types/net'
import type { ClientMessage, ServerMessage } from '../src/types/net'
import type { GameState } from '../src/types/game'
import { validateStateStructure, validateStateForRoom, ValidationKind } from '../src/logic/seed'

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
}

export function createServer(distDir = 'dist', opts?: { tradesEnabled?: boolean; seedEnabled?: boolean; roomEmptyGraceMs?: number; afkTimeoutMs?: number }) {
  const root = resolve(distDir)
  const sockets = new Map<string, WebSocket>()
  const seedEnabled = opts?.seedEnabled ?? false
  let nextId = 1

  function send(clientId: string, msg: ServerMessage): void {
    const ws = sockets.get(clientId)
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
  }

  const roomManager = new RoomManager(
    { send },
    {
      tradesEnabled: opts?.tradesEnabled ?? false,
      seedEnabled,
      roomEmptyGraceMs: opts?.roomEmptyGraceMs,
      afkTimeoutMs: opts?.afkTimeoutMs,
    },
  )

  const httpServer = createHttpServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')

    if (url.pathname === HttpPath.Config && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ seedEnabled }))
      return
    }

    if (url.pathname === HttpPath.Seed && req.method === 'POST') {
      if (!seedEnabled) {
        res.writeHead(403, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ message: 'seeding disabled' }))
        return
      }
      let body = ''
      for await (const chunk of req) body += chunk
      let parsed: { code?: string; state?: GameState }
      try {
        parsed = JSON.parse(body)
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ message: 'invalid JSON body' }))
        return
      }
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ message: 'invalid JSON body' }))
        return
      }
      const { code, state } = parsed
      if (typeof code !== 'string' || !code || !state) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ message: 'code and state are required' }))
        return
      }
      try {
        const structural = validateStateStructure(state)
        if (structural.kind !== ValidationKind.Ok) throw new Error(structural.message)
        const game = roomManager.get(code)
        if (!game) {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ message: 'room not found' }))
          return
        }
        const roomCheck = validateStateForRoom(state, game.getPlayers().map((p) => ({
          name: p.name, connected: p.connected, isBot: p.isBot,
        })))
        if (roomCheck.kind !== ValidationKind.Ok) throw new Error(roomCheck.message)
        game.seedState(state)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true }))
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ message: e instanceof Error ? e.message : 'invalid seed state' }))
      }
      return
    }

    if (url.pathname === HttpPath.Rooms && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(roomManager.list()))
      return
    }
    const pathname = url.pathname === '/' ? 'index.html' : url.pathname
    const filePath = join(root, pathname)
    const within = relative(root, filePath)
    if (within.startsWith('..') || isAbsolute(within)) {
      res.writeHead(403)
      res.end()
      return
    }
    try {
      const data = await readFile(filePath)
      res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream' })
      res.end(data)
    } catch {
      if (req.headers.accept?.includes('text/html')) {
        try {
          const index = await readFile(join(root, 'index.html'))
          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end(index)
          return
        } catch {
          // fall through to 404
        }
      }
      res.writeHead(404)
      res.end('Not found')
    }
  })

  const wss = new WebSocketServer({ server: httpServer, path: HttpPath.Ws })

  wss.on('connection', (ws) => {
    const clientId = String(nextId++)
    sockets.set(clientId, ws)
    ws.on('error', () => {})
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as ClientMessage
        if (msg.type === ClientMessageType.Create) {
          const { code, game } = roomManager.create()
          if (game.join(clientId, msg.name)) roomManager.addClient(code, clientId)
        } else if (msg.type === ClientMessageType.Join) {
          const game = roomManager.get(msg.code)
          if (!game) {
            send(clientId, { type: ServerMessageType.Error, message: 'Ruangan tidak ditemukan' })
            return
          }
          if (game.join(clientId, msg.name)) roomManager.addClient(msg.code, clientId)
        } else if (msg.type === ClientMessageType.Start) {
          roomManager.gameFor(clientId)?.start(clientId)
        } else if (msg.type === ClientMessageType.Leave) {
          const game = roomManager.gameFor(clientId)
          if (game) game.leave(clientId)
          else send(clientId, { type: ServerMessageType.Left })
          roomManager.removeClient(clientId)
        } else if (msg.type === ClientMessageType.AddBot) {
          roomManager.gameFor(clientId)?.addBot(clientId)
        } else if (msg.type === ClientMessageType.RemoveBot) {
          roomManager.gameFor(clientId)?.removeBot(clientId, msg.playerId)
        } else if (msg.type === ClientMessageType.Action) {
          roomManager.gameFor(clientId)?.handleAction(clientId, msg.action)
        }
      } catch {
        // ignore malformed messages
      }
    })
    ws.on('close', () => {
      sockets.delete(clientId)
      roomManager.gameFor(clientId)?.disconnect(clientId)
      roomManager.removeClient(clientId)
    })
  })

  return { httpServer, wss, roomManager }
}
