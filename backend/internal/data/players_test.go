package data

import "testing"

func TestPlayerColors(t *testing.T) {
	if len(PLAYER_COLORS) != 6 {
		t.Fatalf("expected 6 player colors, got %d", len(PLAYER_COLORS))
	}
	for i, c := range PLAYER_COLORS {
		if !IsValidColor(c) {
			t.Errorf("PLAYER_COLORS[%d] = %q is not a valid hex color", i, c)
		}
	}
}

func TestMaxPlayers(t *testing.T) {
	if MAX_PLAYERS != 6 {
		t.Errorf("expected MAX_PLAYERS=6, got %d", MAX_PLAYERS)
	}
}

func TestPlayerOffsets(t *testing.T) {
	if len(PLAYER_OFFSETS) != 6 {
		t.Fatalf("expected 6 player offsets, got %d", len(PLAYER_OFFSETS))
	}
	for i := 0; i < 6; i++ {
		if _, ok := PLAYER_OFFSETS[i]; !ok {
			t.Errorf("missing offset for player %d", i)
		}
	}
}

func TestIsValidColor(t *testing.T) {
	tests := []struct {
		input string
		valid bool
	}{
		{"#E74C3C", true},
		{"#3498db", true},
		{"#ABC", true},
		{"#abc", true},
		{"#AABBCCDD", true},
		{"#aabbccdd", true},
		{"#GGHHII", false},
		{"", false},
		{"E74C3C", false},
		{"#12", false},
		{"#1234", false},
		{"#12345", false},
		{"#1234567", false},
		{"#123456789", false},
	}
	for _, tt := range tests {
		if got := IsValidColor(tt.input); got != tt.valid {
			t.Errorf("IsValidColor(%q) = %v, want %v", tt.input, got, tt.valid)
		}
	}
}

func TestNormalizeColor(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"#ABC", "#aabbcc"},
		{"#abc", "#aabbcc"},
		{"#E74C3C", "#e74c3c"},
		{"#aabbccdd", "#aabbccdd"},
		{"#AABBCCDD", "#aabbccdd"},
	}
	for _, tt := range tests {
		if got := NormalizeColor(tt.input); got != tt.expected {
			t.Errorf("NormalizeColor(%q) = %q, want %q", tt.input, got, tt.expected)
		}
	}
}

func TestNormalizeColorLength(t *testing.T) {
	result := NormalizeColor("#ABC")
	if len(result) != 7 {
		t.Errorf("NormalizeColor(\"#ABC\") should return 7-char string, got %d chars: %q", len(result), result)
	}
}
