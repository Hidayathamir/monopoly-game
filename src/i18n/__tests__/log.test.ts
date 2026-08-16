import { describe, it, expect } from 'vitest';
import i18n from '../index';
import { resolveLogEntry } from '../log';
import type { LogEntry } from '../../types/game';

function formatMoney(n: number | undefined): string {
  return n == null ? '' : `$${n}`;
}

describe('resolveLogEntry', () => {
  it('appends (bot) to a bot-controlled actor', () => {
    const entry: LogEntry = { key: 'event.rolled', params: { name: 'hp', d1: 6, d2: 5, total: 11, bot: true } };
    expect(resolveLogEntry(entry, i18n.t.bind(i18n), formatMoney)).toBe('hp (bot) rolled 6+5=11');
  });

  it('leaves normal entries unchanged', () => {
    const entry: LogEntry = { key: 'event.rolled', params: { name: 'Hidayat', d1: 4, d2: 3, total: 7 } };
    expect(resolveLogEntry(entry, i18n.t.bind(i18n), formatMoney)).toBe('Hidayat rolled 4+3=7');
  });

  it('renders the offline notice with the player name', () => {
    const entry: LogEntry = { key: 'event.playerOffline', params: { name: 'hp' } };
    expect(resolveLogEntry(entry, i18n.t.bind(i18n), formatMoney)).toBe('hp went offline — a bot will play their turn');
  });
});
