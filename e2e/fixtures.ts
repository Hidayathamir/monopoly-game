import { test as base, expect } from '@playwright/test'
import { startServer } from './helpers/server'

interface WorkerFixtures {
  serverUrl: string
}

export const test = base.extend<object, WorkerFixtures>({
  serverUrl: [
    async (_fixtures, use, workerInfo) => {
      const server = await startServer(4000 + workerInfo.workerIndex)
      await use(server.url)
      server.close()
    },
    { scope: 'worker' },
  ],
})

export { expect }
