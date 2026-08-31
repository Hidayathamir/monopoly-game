package gameusecase

import "math"

// ControlledDiceResult holds the output of a controlled dice roll.
type ControlledDiceResult struct {
	Dice [2]int
	Luck int
}

// DiceFaces is the set of valid die faces.
var DiceFaces = []int{1, 2, 3, 4, 5, 6}

var totals = []int{2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12}

var standardCounts = map[int]int{
	2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1,
}

var peakWeightsTable = map[int]float64{0: 10, 1: 4, 2: 2, 3: 1}

func buildPeakWeights(target int) map[int]float64 {
	weights := make(map[int]float64)
	for offset, weight := range peakWeightsTable {
		// TypeScript uses new Set([target - o, target + o]) — deduplicates when offset=0
		unique := make(map[int]bool)
		unique[target-offset] = true
		unique[target+offset] = true
		for t := range unique {
			if t >= 2 && t <= 12 {
				weights[t] += weight
			}
		}
	}
	return weights
}

// RollControlledDice produces a dice roll biased toward the target total.
// rng must return a float64 in [0, 1).
func RollControlledDice(target int, rng func() float64) ControlledDiceResult {
	target = int(math.Min(12, math.Max(2, math.Floor(float64(target)))))
	luck := int(math.Min(100, math.Floor(rng()*101)))
	alpha := float64(luck) / 100.0

	peak := buildPeakWeights(target)

	sum := 0.0
	weights := make(map[int]float64)
	for _, t := range totals {
		w := alpha*peak[t] + (1-alpha)*float64(standardCounts[t])
		weights[t] = w
		sum += w
	}

	r := rng() * sum
	total := totals[len(totals)-1]
	for _, t := range totals {
		r -= weights[t]
		if r < 0 {
			total = t
			break
		}
	}

	var pairs [][2]int
	for _, a := range DiceFaces {
		b := total - a
		if b >= 1 && b <= 6 {
			pairs = append(pairs, [2]int{a, b})
		}
	}
	dice := pairs[int(math.Floor(rng()*float64(len(pairs))))]

	return ControlledDiceResult{Dice: dice, Luck: luck}
}
