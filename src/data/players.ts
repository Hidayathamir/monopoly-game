export const PLAYER_COLORS = [
  '#E74C3C',
  '#3498DB',
  '#2ECC71',
  '#F39C12',
  '#9B59B6',
  '#E67E22',
]

export const MAX_PLAYERS = 6

export const PLAYER_OFFSETS: Record<number, { dx: number; dy: number }> = {
  0: { dx: -8, dy: -8 },
  1: { dx: 8, dy: -8 },
  2: { dx: -8, dy: 8 },
  3: { dx: 8, dy: 8 },
  4: { dx: 0, dy: -8 },
  5: { dx: 0, dy: 8 },
}
