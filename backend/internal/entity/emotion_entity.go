package entity

// Emoticon string constants and type
type Emoticon = string

const (
	EmoticonSad   Emoticon = "sad"
	EmoticonHappy Emoticon = "happy"
	EmoticonAngry Emoticon = "angry"
	EmoticonProud Emoticon = "proud"
)

// EMOTICON_LIST contains all valid emoticon values.
var EMOTICON_LIST = []Emoticon{
	EmoticonSad,
	EmoticonHappy,
	EmoticonAngry,
	EmoticonProud,
}

// EMOTICON_GLYPHS maps each emoticon to its emoji glyph.
var EMOTICON_GLYPHS = map[Emoticon]string{
	EmoticonSad:   "\U0001f622",
	EmoticonHappy: "\U0001f602",
	EmoticonAngry: "\U0001f620",
	EmoticonProud: "\U0001f60e",
}

const (
	EMOTICON_COOLDOWN_MS     = 1000
	EMOTICON_LIFETIME_MS     = 3000
	EXPENSIVE_RENT_THRESHOLD = 300
)

// IsEmoticon checks whether value is a valid Emoticon.
func IsEmoticon(value string) bool {
	for _, e := range EMOTICON_LIST {
		if e == value {
			return true
		}
	}
	return false
}

// ActiveEmotion represents an in-flight emoticon reaction.
type ActiveEmotion struct {
	ID       int      `json:"id"`
	PlayerID int      `json:"playerId"`
	Emoticon Emoticon `json:"emoticon"`
}
