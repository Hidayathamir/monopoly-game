package data

import (
	"testing"

	"monopoly-game-backend/internal/entity"
)

func TestPresetAvatars(t *testing.T) {
	if len(PRESET_AVATARS) != 10 {
		t.Fatalf("expected 10 preset avatars, got %d", len(PRESET_AVATARS))
	}
	expectedNames := []string{"Cat", "Dog", "Robot", "Alien", "Ghost", "Penguin", "Fox", "Dino", "Crab", "Octopus"}
	for _, name := range expectedNames {
		if _, ok := PRESET_AVATARS[name]; !ok {
			t.Errorf("missing preset avatar: %s", name)
		}
	}
}

func TestPresetEmoji(t *testing.T) {
	if len(PRESET_EMOJI) != 10 {
		t.Fatalf("expected 10 preset emoji entries, got %d", len(PRESET_EMOJI))
	}
	for _, id := range PRESET_AVATARS {
		if _, ok := PRESET_EMOJI[id]; !ok {
			t.Errorf("missing emoji for preset id: %s", id)
		}
	}
}

func TestDefaultAvatar(t *testing.T) {
	pa, ok := DEFAULT_AVATAR.(entity.PresetAvatar)
	if !ok {
		t.Fatal("DEFAULT_AVATAR should be a PresetAvatar")
	}
	if pa.Kind != entity.AvatarKindPreset {
		t.Errorf("expected kind %q, got %q", entity.AvatarKindPreset, pa.Kind)
	}
	if pa.ID != "cat" {
		t.Errorf("expected id %q, got %q", "cat", pa.ID)
	}
}

func TestIsPresetAvatar(t *testing.T) {
	valid := entity.PresetAvatar{Kind: entity.AvatarKindPreset, ID: "cat"}
	if !IsPresetAvatar(valid) {
		t.Error("IsPresetAvatar should return true for valid preset")
	}

	invalidKind := entity.PresetAvatar{Kind: "wrong", ID: "cat"}
	if IsPresetAvatar(invalidKind) {
		t.Error("IsPresetAvatar should return false for wrong kind")
	}

	unknownID := entity.PresetAvatar{Kind: entity.AvatarKindPreset, ID: "unknown"}
	if IsPresetAvatar(unknownID) {
		t.Error("IsPresetAvatar should return false for unknown id")
	}

	custom := entity.CustomAvatar{Kind: entity.AvatarKindCustom, DataURL: "data:image/png;base64,abc"}
	if IsPresetAvatar(custom) {
		t.Error("IsPresetAvatar should return false for CustomAvatar")
	}
}

func TestIsCustomAvatar(t *testing.T) {
	valid := entity.CustomAvatar{Kind: entity.AvatarKindCustom, DataURL: "data:image/png;base64,abc"}
	if !IsCustomAvatar(valid) {
		t.Error("IsCustomAvatar should return true for valid custom avatar")
	}

	wrongKind := entity.CustomAvatar{Kind: "wrong", DataURL: "data:image/png;base64,abc"}
	if IsCustomAvatar(wrongKind) {
		t.Error("IsCustomAvatar should return false for wrong kind")
	}

	noPrefix := entity.CustomAvatar{Kind: entity.AvatarKindCustom, DataURL: "abc"}
	if IsCustomAvatar(noPrefix) {
		t.Error("IsCustomAvatar should return false without data:image/ prefix")
	}

	longURL := entity.CustomAvatar{Kind: entity.AvatarKindCustom, DataURL: "data:image/png;base64," + string(make([]byte, CUSTOM_AVATAR_MAX_DATA_URL_LENGTH))}
	if IsCustomAvatar(longURL) {
		t.Error("IsCustomAvatar should return false for URL exceeding max length")
	}

	preset := entity.PresetAvatar{Kind: entity.AvatarKindPreset, ID: "cat"}
	if IsCustomAvatar(preset) {
		t.Error("IsCustomAvatar should return false for PresetAvatar")
	}
}

func TestIsValidAvatar(t *testing.T) {
	preset := entity.PresetAvatar{Kind: entity.AvatarKindPreset, ID: "dog"}
	if !IsValidAvatar(preset) {
		t.Error("IsValidAvatar should return true for valid preset")
	}

	custom := entity.CustomAvatar{Kind: entity.AvatarKindCustom, DataURL: "data:image/png;base64,abc"}
	if !IsValidAvatar(custom) {
		t.Error("IsValidAvatar should return true for valid custom")
	}

	invalidPreset := entity.PresetAvatar{Kind: entity.AvatarKindPreset, ID: "invalid"}
	if IsValidAvatar(invalidPreset) {
		t.Error("IsValidAvatar should return false for invalid preset id")
	}
}

func TestIsSameAvatar(t *testing.T) {
	a := entity.PresetAvatar{Kind: entity.AvatarKindPreset, ID: "cat"}
	b := entity.PresetAvatar{Kind: entity.AvatarKindPreset, ID: "cat"}
	if !IsSameAvatar(a, b) {
		t.Error("IsSameAvatar should return true for same preset")
	}

	c := entity.PresetAvatar{Kind: entity.AvatarKindPreset, ID: "dog"}
	if IsSameAvatar(a, c) {
		t.Error("IsSameAvatar should return false for different presets")
	}

	d := entity.CustomAvatar{Kind: entity.AvatarKindCustom, DataURL: "data:image/png;base64,abc"}
	e := entity.CustomAvatar{Kind: entity.AvatarKindCustom, DataURL: "data:image/png;base64,abc"}
	if !IsSameAvatar(d, e) {
		t.Error("IsSameAvatar should return true for same custom")
	}

	f := entity.CustomAvatar{Kind: entity.AvatarKindCustom, DataURL: "data:image/png;base64,xyz"}
	if IsSameAvatar(d, f) {
		t.Error("IsSameAvatar should return false for different custom data URLs")
	}

	if IsSameAvatar(a, d) {
		t.Error("IsSameAvatar should return false for different avatar kinds")
	}
}

func TestCustomAvatarMaxConstants(t *testing.T) {
	if CUSTOM_AVATAR_MAX_DATA_URL_LENGTH != 100_000 {
		t.Errorf("expected CUSTOM_AVATAR_MAX_DATA_URL_LENGTH=100000, got %d", CUSTOM_AVATAR_MAX_DATA_URL_LENGTH)
	}
	if CUSTOM_AVATAR_MAX_DIMENSION != 96 {
		t.Errorf("expected CUSTOM_AVATAR_MAX_DIMENSION=96, got %d", CUSTOM_AVATAR_MAX_DIMENSION)
	}
}
