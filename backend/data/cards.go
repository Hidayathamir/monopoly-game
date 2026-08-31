package data

import _ "embed"

//go:embed cards-data.json
var cardsDataJSON []byte

func CardsDataJSON() []byte {
	return cardsDataJSON
}
