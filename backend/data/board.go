package data

import _ "embed"

//go:embed board-data.json
var boardDataJSON []byte

func BoardDataJSON() []byte {
	return boardDataJSON
}
