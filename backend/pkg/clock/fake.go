package clock

import (
	"sort"
	"sync"
	"time"
)

type FakeClock struct {
	mu     sync.Mutex
	now    time.Time
	timers []*fakeTimer
}

type fakeTimer struct {
	clock    *FakeClock
	fireAt   time.Time
	interval time.Duration
	f        func()
	stopped  bool
	fired    bool
}

func (ft *fakeTimer) Stop() bool {
	ft.clock.mu.Lock()
	defer ft.clock.mu.Unlock()
	if ft.fired || ft.stopped {
		return false
	}
	ft.stopped = true
	return true
}

func (ft *fakeTimer) Reset(d time.Duration) bool {
	ft.clock.mu.Lock()
	defer ft.clock.mu.Unlock()
	wasActive := !ft.fired && !ft.stopped
	ft.interval = d
	ft.fireAt = ft.clock.now.Add(d)
	ft.stopped = false
	ft.fired = false
	return wasActive
}

func NewFakeClock() *FakeClock {
	return &FakeClock{
		now: time.Unix(0, 0),
	}
}

func (fc *FakeClock) Now() time.Time {
	fc.mu.Lock()
	defer fc.mu.Unlock()
	return fc.now
}

func (fc *FakeClock) AfterFunc(d time.Duration, f func()) Timer {
	fc.mu.Lock()
	defer fc.mu.Unlock()
	ft := &fakeTimer{
		clock:    fc,
		fireAt:   fc.now.Add(d),
		interval: d,
		f:        f,
	}
	fc.timers = append(fc.timers, ft)
	return ft
}

func (fc *FakeClock) AdvanceTime(d time.Duration) {
	fc.mu.Lock()
	fc.now = fc.now.Add(d)

	type fireEntry struct {
		fireAt time.Time
		f      func()
	}
	var due []fireEntry

	for _, ft := range fc.timers {
		if !ft.stopped && !ft.fired && !fc.now.Before(ft.fireAt) {
			ft.fired = true
			due = append(due, fireEntry{fireAt: ft.fireAt, f: ft.f})
		}
	}
	fc.mu.Unlock()

	sort.Slice(due, func(i, j int) bool {
		return due[i].fireAt.Before(due[j].fireAt)
	})

	for _, entry := range due {
		entry.f()
	}
}
