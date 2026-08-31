package clock

import "time"

type RealClock struct{}

func (RealClock) Now() time.Time { return time.Now() }

func (RealClock) AfterFunc(d time.Duration, f func()) Timer {
	return realTimer{time.AfterFunc(d, f)}
}

type realTimer struct {
	t *time.Timer
}

func (r realTimer) Stop() bool                 { return r.t.Stop() }
func (r realTimer) Reset(d time.Duration) bool { return r.t.Reset(d) }
