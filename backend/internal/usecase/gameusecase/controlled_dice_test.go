package gameusecase

import (
	"fmt"
	"testing"
)

// sequence returns an rng that cycles through the given values,
// capping at the last value.
func sequence(values ...float64) func() float64 {
	i := 0
	return func() float64 {
		v := values[i]
		if i < len(values)-1 {
			i++
		}
		return v
	}
}

// lcgSequence returns a deterministic LCG-based rng.
func lcgSequence(seed int) func() float64 {
	x := seed
	return func() float64 {
		x = (x*9301 + 49297) % 233280
		return float64(x) / 233280
	}
}

func TestRollControlledDice_LuckZero_StandardDice(t *testing.T) {
	// luck = floor(0 * 101) = 0; r = 0.5 * 36 = 18 → total 7; pair index 0 → (1, 6)
	r := RollControlledDice(8, sequence(0, 0.5, 0))
	if r.Luck != 0 {
		t.Fatalf("expected luck 0, got %d", r.Luck)
	}
	if r.Dice != [2]int{1, 6} {
		t.Fatalf("expected dice [1 6], got %v", r.Dice)
	}
}

func TestRollControlledDice_Luck100_ClustersTarget(t *testing.T) {
	for _, target := range []int{2, 7, 8, 12} {
		for i := 0; i < 500; i++ {
			lcg := lcgSequence(i + 1)
			first := true
			rng := func() float64 {
				if first {
					first = false
					return 0.999
				}
				return lcg()
			}
			r := RollControlledDice(target, rng)
			total := r.Dice[0] + r.Dice[1]
			lo := 2
			if target-3 > lo {
				lo = target - 3
			}
			hi := 12
			if target+3 < hi {
				hi = target + 3
			}
			if total < lo || total > hi {
				t.Fatalf("target=%d i=%d: total %d out of range [%d, %d]", target, i, total, lo, hi)
			}
		}
	}
}

func TestRollControlledDice_Luck100_TargetMostCommon(t *testing.T) {
	counts := make(map[int]int)
	for i := 0; i < 1000; i++ {
		lcg := lcgSequence(i + 1)
		first := true
		rng := func() float64 {
			if first {
				first = false
				return 0.999
			}
			return lcg()
		}
		r := RollControlledDice(8, rng)
		total := r.Dice[0] + r.Dice[1]
		counts[total]++
		if r.Luck != 100 {
			t.Fatalf("expected luck 100, got %d", r.Luck)
		}
	}
	targetCount := counts[8]
	for total, count := range counts {
		if total != 8 && targetCount <= count {
			t.Fatalf("target 8 count %d not greater than total %d count %d", targetCount, total, count)
		}
	}
}

func TestRollControlledDice_MidLuck_ClustersMore(t *testing.T) {
	counts := make(map[int]int)
	for i := 0; i < 2000; i++ {
		lcg := lcgSequence(i + 1)
		first := true
		rng := func() float64 {
			if first {
				first = false
				return 0.5
			}
			return lcg()
		}
		r := RollControlledDice(8, rng)
		total := r.Dice[0] + r.Dice[1]
		counts[total]++
	}
	middle := 0
	for _, t := range []int{5, 6, 7, 8, 9} {
		middle += counts[t]
	}
	outer := 0
	for _, t := range []int{2, 3, 4, 10, 11, 12} {
		outer += counts[t]
	}
	if middle <= outer*2 {
		t.Fatalf("expected middle (%d) > outer*2 (%d)", middle, outer*2)
	}
}

func TestRollControlledDice_Deterministic(t *testing.T) {
	r := RollControlledDice(8, sequence(0.5, 0.5, 0.5))
	if r.Luck != 50 {
		t.Fatalf("expected luck 50, got %d", r.Luck)
	}
	if r.Dice != [2]int{4, 4} {
		t.Fatalf("expected dice [4 4], got %v", r.Dice)
	}
}

func TestRollControlledDice_ValidDiceAndLuck(t *testing.T) {
	lcg := lcgSequence(1)
	for _, target := range []int{2, 5, 7, 12} {
		for i := 0; i < 2000; i++ {
			r := RollControlledDice(target, lcg)
			if r.Luck < 0 || r.Luck > 100 {
				t.Fatalf("target=%d i=%d: luck %d out of range", target, i, r.Luck)
			}
			if r.Dice[0] < 1 || r.Dice[0] > 6 || r.Dice[1] < 1 || r.Dice[1] > 6 {
				t.Fatalf("target=%d i=%d: dice %v out of range", target, i, r.Dice)
			}
			sum := r.Dice[0] + r.Dice[1]
			if sum < 2 || sum > 12 {
				t.Fatalf("target=%d i=%d: sum %d out of range", target, i, sum)
			}
		}
	}
}

func TestRollControlledDice_ClampHighTarget(t *testing.T) {
	counts := make(map[int]int)
	for i := 0; i < 500; i++ {
		lcg := lcgSequence(i + 1)
		first := true
		rng := func() float64 {
			if first {
				first = false
				return 0.999
			}
			return lcg()
		}
		r := RollControlledDice(999, rng)
		total := r.Dice[0] + r.Dice[1]
		if r.Luck != 100 {
			t.Fatalf("expected luck 100, got %d", r.Luck)
		}
		if total < 9 || total > 12 {
			t.Fatalf("i=%d: total %d out of range [9, 12]", i, total)
		}
		counts[total]++
	}
	if len(counts) <= 1 {
		t.Fatalf("expected multiple distinct totals, got %v", counts)
	}
}

func TestRollControlledDice_ClampLowTarget(t *testing.T) {
	counts := make(map[int]int)
	for i := 0; i < 500; i++ {
		lcg := lcgSequence(i + 1)
		first := true
		rng := func() float64 {
			if first {
				first = false
				return 0.999
			}
			return lcg()
		}
		r := RollControlledDice(1, rng)
		total := r.Dice[0] + r.Dice[1]
		if r.Luck != 100 {
			t.Fatalf("expected luck 100, got %d", r.Luck)
		}
		if total < 2 || total > 5 {
			t.Fatalf("i=%d: total %d out of range [2, 5]", i, total)
		}
		counts[total]++
	}
	if len(counts) <= 1 {
		t.Fatalf("expected multiple distinct totals, got %v", counts)
	}
}

func TestRollControlledDice_SameInputsSameOutput(t *testing.T) {
	a := RollControlledDice(8, sequence(0.5, 0.5, 0.5))
	b := RollControlledDice(8, sequence(0.5, 0.5, 0.5))
	if a != b {
		t.Fatalf("same inputs should produce same output, got %v vs %v", a, b)
	}
	_ = fmt.Sprint(a, b)
}

func TestRollControlledDice_PureFunction(t *testing.T) {
	a := RollControlledDice(9, sequence(0.5, 0.1, 0.7))
	b := RollControlledDice(9, sequence(0.5, 0.1, 0.7))
	if a != b {
		t.Fatalf("expected identical results for same inputs, got %v vs %v", a, b)
	}
}

func TestBuildPeakWeights_Target7(t *testing.T) {
	w := buildPeakWeights(7)
	expected := map[int]float64{4: 1, 5: 2, 6: 4, 7: 10, 8: 4, 9: 2, 10: 1}
	for k, v := range expected {
		if w[k] != v {
			t.Fatalf("weight[%d] = %f, want %f", k, w[k], v)
		}
	}
}

func TestBuildPeakWeights_Target2(t *testing.T) {
	w := buildPeakWeights(2)
	expected := map[int]float64{2: 10, 3: 4, 4: 2, 5: 1}
	if len(w) != len(expected) {
		t.Fatalf("expected %d weights, got %d", len(expected), len(w))
	}
	for k, v := range expected {
		if w[k] != v {
			t.Fatalf("weight[%d] = %f, want %f", k, w[k], v)
		}
	}
}

func TestBuildPeakWeights_Target12(t *testing.T) {
	w := buildPeakWeights(12)
	expected := map[int]float64{9: 1, 10: 2, 11: 4, 12: 10}
	if len(w) != len(expected) {
		t.Fatalf("expected %d weights, got %d", len(expected), len(w))
	}
	for k, v := range expected {
		if w[k] != v {
			t.Fatalf("weight[%d] = %f, want %f", k, w[k], v)
		}
	}
}
