package gameusecase

import (
	"monopoly-game-backend/internal/data"
	"monopoly-game-backend/internal/entity"
)

func CanBuildOnCurrentSpace(state entity.GameState) bool {
	player := state.CurrentPlayer
	if player < 0 || player >= len(state.Players) || state.Dice == nil {
		return false
	}
	position := state.Players[player].Position
	if position < 0 || position >= len(state.Board) {
		return false
	}
	s := &state.Board[position]
	cost := data.GetHouseCost(*s, s.Houses)
	return s.Type == entity.SpaceTypeProperty && s.Owner != nil && *s.Owner == player && s.Houses < data.MaxHouses && !s.Mortgaged && cost > 0 && state.Players[player].Money >= cost && (state.JustBoughtSpaceID == nil || s.ID != *state.JustBoughtSpaceID)
}
