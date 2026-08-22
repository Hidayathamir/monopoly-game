export const PLAYER_COLORS = [
  '#E74C3C',
  '#3498DB',
  '#2ECC71',
  '#F39C12',
  '#9B59B6',
  '#E67E22',
]

const HEX_COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export function isValidColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR_RE.test(value);
}

export function normalizeColor(value: string): string {
  const hex = value.toLowerCase();
  if (hex.length === 4) {
    return '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
  }
  if (hex.length === 9) {
    return '#' + hex[1] + hex[2] + hex[3] + hex[4] + hex[5] + hex[6] + hex[7] + hex[8];
  }
  return hex;
}

export const MAX_PLAYERS = 6

export const PLAYER_OFFSETS: Record<number, { dx: number; dy: number }> = {
  0: { dx: -8, dy: -8 },
  1: { dx: 8, dy: -8 },
  2: { dx: -8, dy: 8 },
  3: { dx: 8, dy: 8 },
  4: { dx: 0, dy: -8 },
  5: { dx: 0, dy: 8 },
}
