import { createServer } from './http'
import { parseEnvFlag } from '../src/utils/env'

const port = Number(process.env.PORT ?? 3001)
const distDir = process.env.DIST_DIR ?? 'dist'
const tradesEnabled = parseEnvFlag(process.env.TRADES_ENABLED)
const seedEnabled = parseEnvFlag(process.env.E2E_SEED_ENABLED)
const roomEmptyGraceMs = process.env.ROOM_EMPTY_GRACE_MS ? Number(process.env.ROOM_EMPTY_GRACE_MS) : undefined
const afkTimeoutMs = process.env.AFK_TIMEOUT_MS ? Number(process.env.AFK_TIMEOUT_MS) : undefined
const { httpServer } = createServer(distDir, { tradesEnabled, seedEnabled, roomEmptyGraceMs, afkTimeoutMs })
httpServer.listen(port, '0.0.0.0', () => {
  console.log(`Monopoli server aktif di http://0.0.0.0:${port}`)
})
