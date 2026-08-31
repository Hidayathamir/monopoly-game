package data

import (
	"strings"

	"monopoly-game-backend/internal/entity"
)

var PRESET_AVATARS = map[string]string{
	"Cat":     "cat",
	"Dog":     "dog",
	"Robot":   "robot",
	"Alien":   "alien",
	"Ghost":   "ghost",
	"Penguin": "penguin",
	"Fox":     "fox",
	"Dino":    "dino",
	"Crab":    "crab",
	"Octopus": "octopus",
}

var PRESET_EMOJI = map[string]string{
	"cat":     "\U0001F431",
	"dog":     "\U0001F436",
	"robot":   "\U0001F916",
	"alien":   "\U0001F47D",
	"ghost":   "\U0001F47B",
	"penguin": "\U0001F427",
	"fox":     "\U0001F98A",
	"dino":    "\U0001F996",
	"crab":    "\U0001F980",
	"octopus": "\U0001F419",
}

var DEFAULT_AVATAR entity.PlayerAvatar = entity.PresetAvatar{
	Kind: entity.AvatarKindPreset,
	ID:   "cat",
}

const CUSTOM_AVATAR_MAX_DATA_URL_LENGTH = 100_000
const CUSTOM_AVATAR_MAX_DIMENSION = 96

func IsPresetAvatar(value entity.PlayerAvatar) bool {
	pa, ok := value.(entity.PresetAvatar)
	if !ok {
		return false
	}
	if pa.Kind != entity.AvatarKindPreset {
		return false
	}
	_, exists := PRESET_EMOJI[pa.ID]
	return exists
}

func IsCustomAvatar(value entity.PlayerAvatar) bool {
	ca, ok := value.(entity.CustomAvatar)
	if !ok {
		return false
	}
	if ca.Kind != entity.AvatarKindCustom {
		return false
	}
	if len(ca.DataURL) > CUSTOM_AVATAR_MAX_DATA_URL_LENGTH {
		return false
	}
	return strings.HasPrefix(ca.DataURL, "data:image/")
}

func IsValidAvatar(value entity.PlayerAvatar) bool {
	return IsPresetAvatar(value) || IsCustomAvatar(value)
}

func IsSameAvatar(a, b entity.PlayerAvatar) bool {
	aPreset, aOk := a.(entity.PresetAvatar)
	bPreset, bOk := b.(entity.PresetAvatar)
	if aOk && bOk {
		return aPreset.Kind == bPreset.Kind && aPreset.ID == bPreset.ID
	}

	aCustom, aOk := a.(entity.CustomAvatar)
	bCustom, bOk := b.(entity.CustomAvatar)
	if aOk && bOk {
		return aCustom.Kind == bCustom.Kind && aCustom.DataURL == bCustom.DataURL
	}

	return false
}
