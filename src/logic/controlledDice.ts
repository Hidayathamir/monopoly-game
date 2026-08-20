export type ControlledDiceResult = { dice: [number, number]; luck: number };

export const DICE_FACES = [1, 2, 3, 4, 5, 6] as const;
export type DieFace = (typeof DICE_FACES)[number];

const TOTALS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

const STANDARD_COUNTS: Record<number, number> = {
  2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1,
};

const PEAK_WEIGHTS: Record<number, number> = { 0: 10, 1: 4, 2: 2, 3: 1 };

function buildPeakWeights(target: number): Record<number, number> {
  const weights: Record<number, number> = {};
  for (const [offset, weight] of Object.entries(PEAK_WEIGHTS)) {
    const o = Number(offset);
    for (const t of new Set([target - o, target + o])) {
      if (t >= 2 && t <= 12) weights[t] = (weights[t] ?? 0) + weight;
    }
  }
  return weights;
}

export function rollControlledDice(target: number, rng: () => number): ControlledDiceResult {
  target = Math.min(12, Math.max(2, Math.floor(target)));
  const luck = Math.min(100, Math.floor(rng() * 101));
  const alpha = luck / 100;
  const peak = buildPeakWeights(target);

  let sum = 0;
  const weights: Record<number, number> = {};
  for (const total of TOTALS) {
    const w = alpha * (peak[total] ?? 0) + (1 - alpha) * STANDARD_COUNTS[total];
    weights[total] = w;
    sum += w;
  }

  let r = rng() * sum;
  let total = TOTALS[TOTALS.length - 1];
  for (const t of TOTALS) {
    r -= weights[t];
    if (r < 0) {
      total = t;
      break;
    }
  }

  const pairs: [number, number][] = [];
  for (const a of DICE_FACES) {
    const b = total - a;
    if (DICE_FACES.includes(b as DieFace)) pairs.push([a, b]);
  }
  const dice = pairs[Math.floor(rng() * pairs.length)];
  return { dice, luck };
}
