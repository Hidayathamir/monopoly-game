import { spawn, type ChildProcess } from 'node:child_process'

export interface TestServer {
  url: string
  close: () => void
}

export async function startServer(port: number, env?: Record<string, string>): Promise<TestServer> {
  // Requires `npm run build` first so `dist/` exists (served by the server).
  const proc: ChildProcess = spawn('npx', ['tsx', 'server/main.ts'], {
    env: { ...process.env, PORT: String(port), E2E_SEED_ENABLED: 'true', ...env },
    cwd: process.cwd(),
    stdio: ['ignore', 'ignore', 'pipe'],
    detached: true,
  })
  let stderr = ''
  let spawnError: Error | undefined
  proc.stderr?.on('data', (chunk: Buffer) => {
    stderr += chunk.toString()
  })
  proc.on('error', (err) => {
    spawnError = err
  })
  const url = `http://localhost:${port}`
  const startedAt = Date.now()
  while (Date.now() - startedAt < 10000) {
    if (spawnError) break
    try {
      const res = await fetch(`${url}/`)
      if (res.ok) {
        return {
          url,
          close: () => {
            if (proc.pid) {
              try {
                process.kill(-proc.pid, 'SIGTERM')
              } catch {
                proc.kill()
              }
            }
          },
        }
      }
    } catch {
      // server not up yet, poll again
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  try {
    if (proc.pid) process.kill(-proc.pid, 'SIGTERM')
  } catch {
    proc.kill()
  }
  if (spawnError) {
    throw new Error(`server on port ${port} failed to start: ${spawnError.message}`)
  }
  throw new Error(`server on port ${port} did not start${stderr ? `\nstderr:\n${stderr}` : ''}`)
}
