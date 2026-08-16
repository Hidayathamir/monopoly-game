import type { LogEntry, Player } from '../types/game';

export function actorEntry(
  key: string,
  player: Player,
  extra: Record<string, string | number> = {},
): LogEntry {
  return {
    key,
    params: { name: player.name, ...(player.botControlled ? { bot: true } : {}), ...extra },
  };
}

export function turnEntry(players: Player[], nextId: number): LogEntry {
  const p = players[nextId];
  return { key: 'event.turn', params: { name: p.name, ...(p.botControlled ? { bot: true } : {}) } };
}