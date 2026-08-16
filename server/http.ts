import { createServer as createHttpServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join, extname, resolve, relative, isAbsolute } from 'node:path'
import { WebSocketServer, WebSocket } from 'ws'
import { RoomManager } from './roomManager'
import { ClientMessageType, ServerMessageType } from '../src/types/net'
import type { ClientMessage, ServerMessage } from '../src/types/net'

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
}

export function createServer(distDir = 'dist') {
  const root = resolve(distDir)
  const sockets = new Map<string, WebSocket>()
  let nextId = 1

  function send(clientId: string, msg: ServerMessage): void {
    const ws = sockets.get(clientId)
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
  }

  const roomManager = new RoomManager({ send })

  const httpServer = createHttpServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
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

  const wss = new WebSocketServer({ server: httpServer, path: '/ws' })

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
          roomManager.gameFor(clientId)?.leave(clientId)
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
