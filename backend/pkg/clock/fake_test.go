package clock_test

import (
	"sync"
	"testing"
	"time"

	"monopoly-game-backend/pkg/clock"
)

func TestAdvanceTime_FiresTimer(t *testing.T) {
	fc := clock.NewFakeClock()
	fired := false
	fc.AfterFunc(5*time.Second, func() { fired = true })

	fc.AdvanceTime(6 * time.Second)
	if !fired {
		t.Fatal("expected timer to fire after AdvanceTime")
	}
}

func TestAdvanceTime_FiresInOrder(t *testing.T) {
	fc := clock.NewFakeClock()
	var order []int

	fc.AfterFunc(2*time.Second, func() { order = append(order, 1) })
	fc.AfterFunc(5*time.Second, func() { order = append(order, 2) })
	fc.AfterFunc(3*time.Second, func() { order = append(order, 3) })

	fc.AdvanceTime(10 * time.Second)

	if len(order) != 3 {
		t.Fatalf("expected 3 firings, got %d", len(order))
	}
	if order[0] != 1 || order[1] != 3 || order[2] != 2 {
		t.Fatalf("unexpected order: %v", order)
	}
}

func TestStop_PreventFiring(t *testing.T) {
	fc := clock.NewFakeClock()
	fired := false
	timer := fc.AfterFunc(5*time.Second, func() { fired = true })

	if !timer.Stop() {
		t.Fatal("Stop should return true for active timer")
	}

	fc.AdvanceTime(10 * time.Second)
	if fired {
		t.Fatal("timer should not fire after Stop")
	}
}

func TestStop_ReturnsFalseAfterFire(t *testing.T) {
	fc := clock.NewFakeClock()
	timer := fc.AfterFunc(1*time.Second, func() {})

	fc.AdvanceTime(2 * time.Second)
	if timer.Stop() {
		t.Fatal("Stop should return false after timer has fired")
	}
}

func TestReset_ChangeInterval(t *testing.T) {
	fc := clock.NewFakeClock()
	fired := false
	timer := fc.AfterFunc(10*time.Second, func() { fired = true })

	fc.AdvanceTime(5 * time.Second)
	if fired {
		t.Fatal("should not have fired yet")
	}

	timer.Reset(3 * time.Second)
	fc.AdvanceTime(3 * time.Second)
	if !fired {
		t.Fatal("expected timer to fire after reset + advance")
	}
}

func TestReset_ReturnsTrueIfActive(t *testing.T) {
	fc := clock.NewFakeClock()
	timer := fc.AfterFunc(5*time.Second, func() {})

	if !timer.Reset(10 * time.Second) {
		t.Fatal("Reset should return true for active timer")
	}
}

func TestConcurrentAdvanceTime(t *testing.T) {
	fc := clock.NewFakeClock()
	var mu sync.Mutex
	var count int

	for i := 0; i < 100; i++ {
		fc.AfterFunc(1*time.Second, func() {
			mu.Lock()
			count++
			mu.Unlock()
		})
	}

	fc.AdvanceTime(2 * time.Second)

	mu.Lock()
	defer mu.Unlock()
	if count != 100 {
		t.Fatalf("expected 100 firings, got %d", count)
	}
}
