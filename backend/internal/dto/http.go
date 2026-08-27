package dto

import "monopoly-game-backend/internal/entity"

type ConfigResponse struct {
	SeedEnabled bool `json:"seedEnabled"`
}

type RoomInfoDTO struct {
	Code        string           `json:"code"`
	HostName    *string          `json:"hostName"`
	PlayerCount int              `json:"playerCount"`
	Phase       entity.GamePhase `json:"phase"`
}

type SeedRequest struct {
	Code  string           `json:"code"`
	State entity.GameState `json:"state"`
}

type SeedResponse struct {
	OK bool `json:"ok"`
}
