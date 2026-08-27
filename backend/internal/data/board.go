package data

import (
	"encoding/json"
	canonicaldata "monopoly-game-backend/data"
	"monopoly-game-backend/internal/entity"
)

var boardDataJSON = canonicaldata.BoardDataJSON()

var typeMap = map[string]entity.SpaceType{
	"go":          entity.SpaceTypeGo,
	"property":    entity.SpaceTypeProperty,
	"railroad":    entity.SpaceTypeRailroad,
	"utility":     entity.SpaceTypeUtility,
	"chance":      entity.SpaceTypeChance,
	"community":   entity.SpaceTypeCommunity,
	"tax":         entity.SpaceTypeTax,
	"jail":        entity.SpaceTypeJail,
	"goToJail":    entity.SpaceTypeGoToJail,
	"freeParking": entity.SpaceTypeFreeParking,
}

type boardSpaceData struct {
	ID        int     `json:"id"`
	Type      string  `json:"type"`
	Price     *int    `json:"price,omitempty"`
	Rent      []int   `json:"rent,omitempty"`
	HouseCost []int   `json:"houseCost,omitempty"`
	Color     *string `json:"color,omitempty"`
	TaxType   *string `json:"taxType,omitempty"`
}

func CreateInitialBoard() []entity.Space {
	var raw []boardSpaceData
	if err := json.Unmarshal(boardDataJSON, &raw); err != nil {
		panic("failed to unmarshal board-data.json: " + err.Error())
	}

	board := make([]entity.Space, len(raw))
	for i, item := range raw {
		st, ok := typeMap[item.Type]
		if !ok {
			st = entity.SpaceTypeProperty
		}
		board[i] = entity.Space{
			ID:        item.ID,
			Type:      st,
			Price:     item.Price,
			Rent:      item.Rent,
			HouseCost: item.HouseCost,
			Color:     item.Color,
			Owner:     nil,
			Houses:    0,
			Mortgaged: false,
			TaxType:   (*entity.TaxType)(item.TaxType),
		}
	}
	return board
}

func GetHouseCost(space entity.Space, level int) int {
	if space.HouseCost == nil || level < 0 || level >= len(space.HouseCost) {
		return 0
	}
	return space.HouseCost[level]
}

func GetTotalHouseInvestment(space entity.Space) int {
	if space.HouseCost == nil {
		return 0
	}
	total := 0
	for i := 0; i < space.Houses && i < len(space.HouseCost); i++ {
		total += space.HouseCost[i]
	}
	return total
}
