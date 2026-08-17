import { LogEventKey, type LogEntry, type Player } from '../types/game';

export function actorEntry(
  key: LogEventKey,
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
  return { key: LogEventKey.Turn, params: { name: p.name, ...(p.botControlled ? { bot: true } : {}) } };
}
