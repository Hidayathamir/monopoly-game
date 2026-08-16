import { describe, it, expect } from 'vitest'
import { rollControlledDice } from '../controlledDice'

function sequence(...values: number[]): () => number {
  let i = 0
  return () => values[Math.min(i++, values.length - 1)]
}

// LCG producing [0,1); deterministic per run.
function lcgSequence(seed = 1): () => number {
  let x = seed
  return () => ((x = (x * 9301 + 49297) % 233280) / 233280)
}

describe('rollControlledDice', () => {
  it('at luck 0 samples exactly standard 2d6', () => {
    // luck = floor(0 * 101) = 0; r = 0.5 * 36 = 18 → total 7; pair index 0 → (1, 6)
    const { dice, luck } = rollControlledDice(8, sequence(0, 0.5, 0))
    expect(luck).toBe(0)
    expect(dice).toEqual([1, 6])
  })

  it('at luck 100 always stays within the target neighborhood', () => {
    for (const target of [2, 7, 8, 12]) {
      for (let i = 0; i < 500; i++) {
        // Fresh rng per roll: first call forces luck 100, the rest come from the LCG.
        const lcg = lcgSequence(i + 1)
        let first = true
        const rng = () => (first ? ((first = false), 0.999) : lcg())
        const r = rollControlledDice(target, rng)
        const total = r.dice[0] + r.dice[1]
        expect(total).toBeGreaterThanOrEqual(Math.max(2, target - 3))
        expect(total).toBeLessThanOrEqual(Math.min(12, target + 3))
      }
    }
  })

  it('at luck 100 makes the target the most common total', () => {
    const counts = new Map<number, number>()
    for (let i = 0; i < 1000; i++) {
      const lcg = lcgSequence(i + 1)
      let first = true
      const rng = () => (first ? ((first = false), 0.999) : lcg())
      const r = rollControlledDice(8, rng)
      const total = r.dice[0] + r.dice[1]
      counts.set(total, (counts.get(total) ?? 0) + 1)
      expect(r.luck).toBe(100)
    }
    const targetCount = counts.get(8) ?? 0
    for (const [total, count] of counts) {
      if (total !== 8) expect(targetCount).toBeGreaterThan(count)
    }
  })

  it('at mid luck clusters toward the target more than random', () => {
    const counts = new Map<number, number>()
    for (let i = 0; i < 2000; i++) {
      const lcg = lcgSequence(i + 1)
      let first = true
      const rng = () => (first ? ((first = false), 0.5) : lcg()) // luck 50
      const r = rollControlledDice(8, rng)
      const total = r.dice[0] + r.dice[1]
      counts.set(total, (counts.get(total) ?? 0) + 1)
    }
    const middle = [5, 6, 7, 8, 9].reduce((s, t) => s + (counts.get(t) ?? 0), 0)
    const outer = [2, 3, 4, 10, 11, 12].reduce((s, t) => s + (counts.get(t) ?? 0), 0)
    expect(middle).toBeGreaterThan(outer * 2)
  })

  it('deterministically rolls a known mid-luck result', () => {
    // luck 50, total 8, pair index 2 → (4, 4)
    const r = rollControlledDice(8, sequence(0.5, 0.5, 0.5))
    expect(r.luck).toBe(50)
    expect(r.dice).toEqual([4, 4])
  })

  it('always produces valid dice and a luck in 0..100', () => {
    const lcg = lcgSequence()
    for (const target of [2, 5, 7, 12]) {
      for (let i = 0; i < 2000; i++) {
        const r = rollControlledDice(target, lcg)
        expect(r.luck).toBeGreaterThanOrEqual(0)
        expect(r.luck).toBeLessThanOrEqual(100)
        expect(r.dice[0]).toBeGreaterThanOrEqual(1)
        expect(r.dice[0]).toBeLessThanOrEqual(6)
        expect(r.dice[1]).toBeGreaterThanOrEqual(1)
        expect(r.dice[1]).toBeLessThanOrEqual(6)
        expect(r.dice[0] + r.dice[1]).toBeGreaterThanOrEqual(2)
        expect(r.dice[0] + r.dice[1]).toBeLessThanOrEqual(12)
      }
    }
  })

  it('is a pure function of its rng', () => {
    const a = rollControlledDice(9, sequence(0.5, 0.1, 0.7))
    const b = rollControlledDice(9, sequence(0.5, 0.1, 0.7))
    expect(a).toEqual(b)
  })
})
