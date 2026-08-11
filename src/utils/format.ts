export function formatMoney(amount: number | undefined): string {
  if (amount === undefined || amount === 0) return 'Rp0';
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    return `${sign}Rp${m % 1 === 0 ? m : m.toFixed(1).replace('.', ',')}M`;
  }
  if (abs >= 1_000) {
    const k = abs / 1_000;
    return `${sign}Rp${k % 1 === 0 ? k : k.toFixed(1).replace('.', ',')}K`;
  }
  return `${sign}Rp${abs}`;
}
