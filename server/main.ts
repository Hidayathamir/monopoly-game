import { createServer } from './http'

const port = Number(process.env.PORT ?? 3001)
const distDir = process.env.DIST_DIR ?? 'dist'
const { httpServer } = createServer(distDir)
httpServer.listen(port, '0.0.0.0', () => {
  console.log(`Monopoli server aktif di http://0.0.0.0:${port}`)
})
