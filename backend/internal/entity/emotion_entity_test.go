package entity

import (
	"encoding/json"
	"testing"
)

func TestEmoticonConstants(t *testing.T) {
	tests := []struct {
		got, want string
	}{
		{EmoticonSad, "sad"},
		{EmoticonHappy, "happy"},
		{EmoticonAngry, "angry"},
		{EmoticonProud, "proud"},
	}
	for _, tt := range tests {
		if tt.got != tt.want {
			t.Errorf("expected %q, got %q", tt.want, tt.got)
		}
	}
}

func TestEmoticonListContainsAll(t *testing.T) {
	expected := []Emoticon{EmoticonSad, EmoticonHappy, EmoticonAngry, EmoticonProud}
	if len(EMOTICON_LIST) != len(expected) {
		t.Fatalf("EMOTICON_LIST length: got %d, want %d", len(EMOTICON_LIST), len(expected))
	}
	for i, e := range expected {
		if EMOTICON_LIST[i] != e {
			t.Errorf("EMOTICON_LIST[%d]: got %q, want %q", i, EMOTICON_LIST[i], e)
		}
	}
}

func TestEmoticonGlyphsAllPresent(t *testing.T) {
	for _, e := range EMOTICON_LIST {
		if _, ok := EMOTICON_GLYPHS[e]; !ok {
			t.Errorf("missing glyph for emoticon %q", e)
		}
	}
	if len(EMOTICON_GLYPHS) != 4 {
		t.Errorf("EMOTICON_GLYPHS length: got %d, want 4", len(EMOTICON_GLYPHS))
	}
}

func TestEmoticonConstantsValues(t *testing.T) {
	if EMOTICON_COOLDOWN_MS != 1000 {
		t.Errorf("EMOTICON_COOLDOWN_MS: got %d, want 1000", EMOTICON_COOLDOWN_MS)
	}
	if EMOTICON_LIFETIME_MS != 3000 {
		t.Errorf("EMOTICON_LIFETIME_MS: got %d, want 3000", EMOTICON_LIFETIME_MS)
	}
	if EXPENSIVE_RENT_THRESHOLD != 300 {
		t.Errorf("EXPENSIVE_RENT_THRESHOLD: got %d, want 300", EXPENSIVE_RENT_THRESHOLD)
	}
}

func TestIsEmoticonValid(t *testing.T) {
	for _, e := range EMOTICON_LIST {
		if !IsEmoticon(e) {
			t.Errorf("IsEmoticon(%q) = false, want true", e)
		}
	}
}

func TestIsEmoticonInvalid(t *testing.T) {
	invalids := []string{"", "sad2", "invalid", "SAD", "Angry"}
	for _, v := range invalids {
		if IsEmoticon(v) {
			t.Errorf("IsEmoticon(%q) = true, want false", v)
		}
	}
}

func TestActiveEmotionJSONRoundTrip(t *testing.T) {
	ae := ActiveEmotion{
		ID:       42,
		PlayerID: 1,
		Emoticon: EmoticonHappy,
	}

	data, err := json.Marshal(ae)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var got ActiveEmotion
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if got.ID != 42 {
		t.Errorf("ID: got %d, want 42", got.ID)
	}
	if got.PlayerID != 1 {
		t.Errorf("PlayerID: got %d, want 1", got.PlayerID)
	}
	if got.Emoticon != EmoticonHappy {
		t.Errorf("Emoticon: got %q, want %q", got.Emoticon, EmoticonHappy)
	}
}

func TestActiveEmotionJSONKeys(t *testing.T) {
	ae := ActiveEmotion{ID: 1, PlayerID: 2, Emoticon: EmoticonAngry}
	data, err := json.Marshal(ae)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var raw map[string]interface{}
	if err := json.Unmarshal(data, &raw); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if raw["id"].(float64) != 1 {
		t.Errorf("id: got %v, want 1", raw["id"])
	}
	if raw["playerId"].(float64) != 2 {
		t.Errorf("playerId: got %v, want 2", raw["playerId"])
	}
	if raw["emoticon"] != "angry" {
		t.Errorf("emoticon: got %v, want angry", raw["emoticon"])
	}
}
