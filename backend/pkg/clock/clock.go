package clock

import "time"

type Clock interface {
	Now() time.Time
	AfterFunc(d time.Duration, f func()) Timer
}

type Timer interface {
	Stop() bool
	Reset(d time.Duration) bool
}
