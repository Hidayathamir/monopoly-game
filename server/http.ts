import { createServer as createHttpServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join, extname, resolve, relative, isAbsolute } from 'node:path'
import { WebSocketServer } from 'ws'
import type { WebSocket } from 'ws'
import { GameServer } from './gameServer'
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

  function broadcast(msg: ServerMessage): void {
    const data = JSON.stringify(msg)
    for (const ws of sockets.values()) ws.send(data)
  }

  const game = new GameServer({
    broadcastState: (state) => broadcast({ type: 'state', state }),
    broadcastLobby: (players) => broadcast({ type: 'lobby', players }),
    send: (clientId, msg) => sockets.get(clientId)?.send(JSON.stringify(msg)),
  })

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
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as ClientMessage
        if (msg.type === 'join') game.join(clientId, msg.name)
        else if (msg.type === 'start') game.start(clientId)
        else if (msg.type === 'action') game.handleAction(clientId, msg.action)
      } catch {
        // ignore malformed messages
      }
    })
    ws.on('close', () => {
      sockets.delete(clientId)
      game.disconnect(clientId)
    })
  })

  return { httpServer, wss, game }
}
