package env

import (
	"os"
	"testing"
)

func TestParseEnvFlag(t *testing.T) {
	tests := []struct {
		input string
		want  bool
	}{
		{"true", true},
		{"false", false},
		{"", false},
		{"TRUE", false},
		{"1", false},
	}
	for _, tc := range tests {
		if got := ParseEnvFlag(tc.input); got != tc.want {
			t.Errorf("ParseEnvFlag(%q) = %v, want %v", tc.input, got, tc.want)
		}
	}
}

func TestGetEnvInt(t *testing.T) {
	t.Run("missing key returns fallback", func(t *testing.T) {
		if got := GetEnvInt("MISSING_KEY_INT_42", 99); got != 99 {
			t.Errorf("got %d, want 99", got)
		}
	})

	t.Run("valid int", func(t *testing.T) {
		t.Setenv("TEST_ENV_INT", "42")
		if got := GetEnvInt("TEST_ENV_INT", 0); got != 42 {
			t.Errorf("got %d, want 42", got)
		}
	})

	t.Run("non-numeric returns fallback", func(t *testing.T) {
		t.Setenv("TEST_ENV_INT_BAD", "abc")
		if got := GetEnvInt("TEST_ENV_INT_BAD", 7); got != 7 {
			t.Errorf("got %d, want 7", got)
		}
	})

	t.Run("empty string returns fallback", func(t *testing.T) {
		os.Unsetenv("TEST_ENV_INT_EMPTY")
		if got := GetEnvInt("TEST_ENV_INT_EMPTY", 5); got != 5 {
			t.Errorf("got %d, want 5", got)
		}
	})
}

func TestGetEnvString(t *testing.T) {
	t.Run("missing key returns fallback", func(t *testing.T) {
		if got := GetEnvString("MISSING_KEY_STR_X", "default"); got != "default" {
			t.Errorf("got %q, want %q", got, "default")
		}
	})

	t.Run("present key returns value", func(t *testing.T) {
		t.Setenv("TEST_ENV_STR", "hello")
		if got := GetEnvString("TEST_ENV_STR", ""); got != "hello" {
			t.Errorf("got %q, want %q", got, "hello")
		}
	})

	t.Run("empty string returns fallback", func(t *testing.T) {
		os.Unsetenv("TEST_ENV_STR_EMPTY")
		if got := GetEnvString("TEST_ENV_STR_EMPTY", "fallback"); got != "fallback" {
			t.Errorf("got %q, want %q", got, "fallback")
		}
	})
}
