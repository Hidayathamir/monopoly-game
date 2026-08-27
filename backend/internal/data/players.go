package data

import (
	"regexp"
	"strings"
)

var PLAYER_COLORS = []string{
	"#E74C3C",
	"#3498DB",
	"#2ECC71",
	"#F39C12",
	"#9B59B6",
	"#795548",
}

const MAX_PLAYERS = 6

type PlayerOffset struct {
	Dx int `json:"dx"`
	Dy int `json:"dy"`
}

var PLAYER_OFFSETS = map[int]PlayerOffset{
	0: {Dx: -8, Dy: -8},
	1: {Dx: 8, Dy: -8},
	2: {Dx: -8, Dy: 8},
	3: {Dx: 8, Dy: 8},
	4: {Dx: 0, Dy: -8},
	5: {Dx: 0, Dy: 8},
}

var hexColorRe = regexp.MustCompile(`^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$`)

func IsValidColor(value string) bool {
	return hexColorRe.MatchString(value)
}

func NormalizeColor(value string) string {
	hex := strings.ToLower(value)
	if len(hex) == 4 {
		return "#" + string(hex[1]) + string(hex[1]) + string(hex[2]) + string(hex[2]) + string(hex[3]) + string(hex[3])
	}
	return hex
}
