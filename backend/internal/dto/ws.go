package dto

import (
	"encoding/json"

	"monopoly-game-backend/internal/entity"
)

type ClientMessageDTO struct {
	Type     string                   `json:"type"`
	Name     *string                  `json:"name,omitempty"`
	Code     *string                  `json:"code,omitempty"`
	Token    *string                  `json:"token,omitempty"`
	Color    *string                  `json:"color,omitempty"`
	Avatar   *entity.PlayerAvatarData `json:"avatar,omitempty"`
	PlayerID *int                     `json:"playerId,omitempty"`
	Action   json.RawMessage          `json:"action,omitempty"`
	Emoticon *string                  `json:"emoticon,omitempty"`
}

type LobbyPlayerDTO = entity.LobbyPlayer

type ServerMessageDTO struct {
	Type           string               `json:"type"`
	PlayerID       *int                 `json:"playerId,omitempty"`
	HostPlayerID   *int                 `json:"hostPlayerId,omitempty"`
	Players        []entity.LobbyPlayer `json:"-"`
	IncludePlayers bool                 `json:"-"`
	State          *entity.GameState    `json:"state,omitempty"`
	Code           *string              `json:"code,omitempty"`
	Message        *string              `json:"message,omitempty"`
	Emoticon       *string              `json:"emoticon,omitempty"`
}

func (m ServerMessageDTO) MarshalJSON() ([]byte, error) {
	type alias ServerMessageDTO
	if m.IncludePlayers && m.Players == nil {
		m.Players = []entity.LobbyPlayer{}
	}
	if !m.IncludePlayers {
		m.Players = nil
	}
	var players any
	if m.IncludePlayers {
		players = m.Players
	}
	value := struct {
		Type         string            `json:"type"`
		PlayerID     *int              `json:"playerId,omitempty"`
		HostPlayerID *int              `json:"hostPlayerId,omitempty"`
		Players      any               `json:"players,omitempty"`
		State        *entity.GameState `json:"state,omitempty"`
		Code         *string           `json:"code,omitempty"`
		Message      *string           `json:"message,omitempty"`
		Emoticon     *string           `json:"emoticon,omitempty"`
	}{m.Type, m.PlayerID, m.HostPlayerID, players, m.State, m.Code, m.Message, m.Emoticon}
	return json.Marshal(value)
}
