package gameusecase

import (
	"monopoly-game-backend/internal/data"
	"monopoly-game-backend/internal/entity"
)

// CalculatePropertyRent returns the rent for a space based on its type and house count.
// For properties, it uses the rent array indexed by houses.
// For railroads and utilities, it dispatches to specialized calculators.
func CalculatePropertyRent(space entity.Space, dice *[2]int) int {
	if space.Rent == nil {
		return 0
	}

	switch space.Type {
	case entity.SpaceTypeUtility:
		return calculateUtilityRent(space, dice)
	case entity.SpaceTypeRailroad:
		return calculateRailroadRent(space)
	}

	houseIndex := space.Houses
	if houseIndex == data.MaxHouses {
		houseIndex = len(space.Rent) - 1
	} else if houseIndex >= len(space.Rent) {
		houseIndex = len(space.Rent) - 1
	}
	if houseIndex < 0 {
		houseIndex = 0
	}
	return space.Rent[houseIndex]
}

func calculateRailroadRent(space entity.Space) int {
	count := GetRailroadCount(space)
	idx := count - 1
	if idx < 0 {
		idx = 0
	}
	if idx >= len(space.Rent) {
		return 25
	}
	return space.Rent[idx]
}

func calculateUtilityRent(space entity.Space, dice *[2]int) int {
	total := 0
	if dice != nil {
		total = dice[0] + dice[1]
	}
	count := GetUtilityCount(space)
	if count == 2 {
		return total * 10
	}
	return total * 4
}

// GetRailroadCount returns the railroad count for a space, defaulting to 1.
func GetRailroadCount(space entity.Space) int {
	if space.RailroadCount <= 0 {
		return 1
	}
	return space.RailroadCount
}

// SetRailroadCount returns a copy of the space with the given railroad count.
func SetRailroadCount(space entity.Space, count int) entity.Space {
	space.RailroadCount = count
	return space
}

// GetUtilityCount returns the utility count for a space, defaulting to 1.
func GetUtilityCount(space entity.Space) int {
	if space.UtilityCount <= 0 {
		return 1
	}
	return space.UtilityCount
}

// SetUtilityCount returns a copy of the space with the given utility count.
func SetUtilityCount(space entity.Space, count int) entity.Space {
	space.UtilityCount = count
	return space
}

// CalculateRailroadRentFromBoard calculates railroad rent by scanning the board
// for railroads owned by the given player.
func CalculateRailroadRentFromBoard(ownerID int, board []entity.Space, spaceID int) int {
	if spaceID < 0 || spaceID >= len(board) {
		return 25
	}
	count := 0
	for _, s := range board {
		if s.Type == entity.SpaceTypeRailroad && s.Owner != nil && *s.Owner == ownerID {
			count++
		}
	}
	idx := count - 1
	if idx < 0 {
		idx = 0
	}
	space := board[spaceID]
	if space.Rent == nil {
		return 25
	}
	if idx >= len(space.Rent) {
		return 25
	}
	return space.Rent[idx]
}

// CalculateUtilityRentFromBoard calculates utility rent by scanning the board
// for utilities owned by the given player.
func CalculateUtilityRentFromBoard(ownerID int, board []entity.Space, _spaceID int, dice [2]int) int {
	count := 0
	for _, s := range board {
		if s.Type == entity.SpaceTypeUtility && s.Owner != nil && *s.Owner == ownerID {
			count++
		}
	}
	total := dice[0] + dice[1]
	if count == 2 {
		return total * 10
	}
	return total * 4
}

// IsMonopoly checks if the given player owns all properties of the same color as the space.
func IsMonopoly(ownerID int, board []entity.Space, space entity.Space) bool {
	if space.Type != entity.SpaceTypeProperty || space.Color == nil {
		return false
	}
	color := *space.Color
	groupSize := 0
	for _, s := range board {
		if s.Type == entity.SpaceTypeProperty && s.Color != nil && *s.Color == color {
			groupSize++
			if s.Owner == nil || *s.Owner != ownerID {
				return false
			}
		}
	}
	return groupSize > 0
}

// CalculatePlayerTotalAssets returns the total assets (money + half property prices + house investments).
func CalculatePlayerTotalAssets(player entity.Player, board []entity.Space) int {
	total := player.Money
	for _, pid := range player.Properties {
		if pid < 0 || pid >= len(board) {
			continue
		}
		space := board[pid]
		if space.Mortgaged {
			continue
		}
		if space.Price != nil {
			total += *space.Price / 2
		}
		switch space.Type {
		case entity.SpaceTypeProperty, entity.SpaceTypeRailroad, entity.SpaceTypeUtility:
			total += data.GetTotalHouseInvestment(space)
		}
	}
	return total
}

// CalculatePlayerNetWorth returns the net worth (money + full property prices + house investments).
func CalculatePlayerNetWorth(player entity.Player, board []entity.Space) int {
	total := player.Money
	for _, pid := range player.Properties {
		if pid < 0 || pid >= len(board) {
			continue
		}
		space := board[pid]
		if space.Price != nil {
			total += *space.Price
		}
		total += data.GetTotalHouseInvestment(space)
	}
	return total
}
