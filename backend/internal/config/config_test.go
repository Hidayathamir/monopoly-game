package config

import (
	"testing"
)

func TestLoadDefaults(t *testing.T) {
	c := Load()

	if c.Port != 3001 {
		t.Errorf("Port: got %d, want 3001", c.Port)
	}
	if c.DistDir != "dist" {
		t.Errorf("DistDir: got %q, want %q", c.DistDir, "dist")
	}
	if !c.TradesEnabled {
		t.Error("TradesEnabled: got false, want true")
	}
	if c.SeedEnabled {
		t.Error("SeedEnabled: got true, want false")
	}
	if c.AFKTimeoutMs != 30000 {
		t.Errorf("AFKTimeoutMs: got %d, want 30000", c.AFKTimeoutMs)
	}
	if c.RoomEmptyGraceMs != 30000 {
		t.Errorf("RoomEmptyGraceMs: got %d, want 30000", c.RoomEmptyGraceMs)
	}
}

func TestLoadEnvOverrides(t *testing.T) {
	t.Setenv("PORT", "8080")
	t.Setenv("DIST_DIR", "/var/www")
	t.Setenv("TRADES_ENABLED", "false")
	t.Setenv("E2E_SEED_ENABLED", "true")
	t.Setenv("AFK_TIMEOUT_MS", "60000")
	t.Setenv("ROOM_EMPTY_GRACE_MS", "10000")

	c := Load()

	if c.Port != 8080 {
		t.Errorf("Port: got %d, want 8080", c.Port)
	}
	if c.DistDir != "/var/www" {
		t.Errorf("DistDir: got %q, want %q", c.DistDir, "/var/www")
	}
	if c.TradesEnabled {
		t.Error("TradesEnabled: got true, want false")
	}
	if !c.SeedEnabled {
		t.Error("SeedEnabled: got false, want true")
	}
	if c.AFKTimeoutMs != 60000 {
		t.Errorf("AFKTimeoutMs: got %d, want 60000", c.AFKTimeoutMs)
	}
	if c.RoomEmptyGraceMs != 10000 {
		t.Errorf("RoomEmptyGraceMs: got %d, want 10000", c.RoomEmptyGraceMs)
	}
}

func TestLoadBoolCaseInsensitive(t *testing.T) {
	tests := []struct {
		name string
		val  string
		want bool
	}{
		{"TRUE", "TRUE", true},
		{"True", "True", true},
		{"FALSE", "FALSE", false},
		{"False", "False", false},
		{"empty_uses_default", "", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("TRADES_ENABLED", tt.val)
			c := Load()
			if c.TradesEnabled != tt.want {
				t.Errorf("TRADES_ENABLED=%q: TradesEnabled = %v, want %v", tt.val, c.TradesEnabled, tt.want)
			}
		})
	}
}
