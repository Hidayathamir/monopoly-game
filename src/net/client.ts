import type { ClientMessage, ServerMessage } from '../types/net'
import { HttpPath } from '../types/net'

export interface ClientHandlers {
  onMessage: (message: ServerMessage) => void
  onOpen?: () => void
  onClose?: () => void
}

export class GameClient {
  private ws: WebSocket | null = null
  private queue: string[] = []
  private handlers: ClientHandlers
  private opts: { wsUrl?: string; WebSocketImpl?: typeof WebSocket }

  constructor(
    handlers: ClientHandlers,
    opts: { wsUrl?: string; WebSocketImpl?: typeof WebSocket } = {},
  ) {
    this.handlers = handlers
    this.opts = opts
  }

  connect(): void {
    const url =
      this.opts.wsUrl ??
      `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${HttpPath.Ws}`
    const WS = this.opts.WebSocketImpl ?? WebSocket
    this.ws = new WS(url)
    this.ws.onopen = () => {
      this.handlers.onOpen?.()
      this.flush()
    }
    this.ws.onmessage = (event) => {
      try {
        this.handlers.onMessage(JSON.parse(event.data as string) as ServerMessage)
      } catch {
        // ignore malformed
      }
    }
    this.ws.onclose = () => this.handlers.onClose?.()
    this.ws.onerror = () => this.handlers.onClose?.()
  }

  send(message: ClientMessage): void {
    const data = JSON.stringify(message)
    if (this.ws?.readyState === 1) this.ws.send(data)
    else this.queue.push(data)
  }

  close(): void {
    this.ws?.close()
  }

  private flush(): void {
    const queued = this.queue
    this.queue = []
    for (const message of queued) this.ws?.send(message)
  }
}
