import { createServer } from './http'

const port = Number(process.env.PORT ?? 3001)
const distDir = process.env.DIST_DIR ?? 'dist'
const tradesEnabled = process.env.TRADES_ENABLED === 'true'
const seedEnabled = process.env.E2E_SEED_ENABLED === 'true'
const roomEmptyGraceMs = process.env.ROOM_EMPTY_GRACE_MS ? Number(process.env.ROOM_EMPTY_GRACE_MS) : undefined
const afkTimeoutMs = process.env.AFK_TIMEOUT_MS ? Number(process.env.AFK_TIMEOUT_MS) : undefined
const { httpServer } = createServer(distDir, { tradesEnabled, seedEnabled, roomEmptyGraceMs, afkTimeoutMs })
httpServer.listen(port, '0.0.0.0', () => {
  console.log(`Monopoli server aktif di http://0.0.0.0:${port}`)
})
