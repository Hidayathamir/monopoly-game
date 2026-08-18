import type { GameState } from '../../src/types/game'

export async function seedGame(url: string, code: string, state: GameState): Promise<void> {
  const res = await fetch(`${url}/seed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, state }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null
    throw new Error(`seed failed (HTTP ${res.status})${body?.message ? `: ${body.message}` : ''}`)
  }
}