export function formatMoney(amount: number | undefined): string {
  if (amount === undefined || amount === 0) return 'Rp 0'
  const abs = Math.abs(amount)
  const sign = amount < 0 ? '-' : ''
  const fmt = (n: number) => (n % 1 === 0 ? n : n.toFixed(1).replace('.', ','))

  if (abs >= 1_000_000_000_000) return `${sign}Rp ${fmt(abs / 1_000_000_000_000)} T`
  if (abs >= 1_000_000_000) return `${sign}Rp ${fmt(abs / 1_000_000_000)} M`
  if (abs >= 1_000_000) return `${sign}Rp ${fmt(abs / 1_000_000)} Juta`
  if (abs >= 1_000) return `${sign}Rp ${fmt(abs / 1_000)} Ribu`
  return `${sign}Rp ${abs}`
}
