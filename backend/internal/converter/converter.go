package converter

import (
	"monopoly-game-backend/internal/dto"
	"monopoly-game-backend/internal/entity"
	"monopoly-game-backend/internal/usecase/roomusecase"
)

func ToRoomInfoDTO(code string, game roomusecase.GameServer) dto.RoomInfoDTO {
	if game == nil {
		return dto.RoomInfoDTO{Code: code}
	}

	players := game.GetPlayers()
	hostPlayerID := game.GetHostPlayerID()
	var hostName *string
	playerCount := 0
	for index, player := range players {
		if player.Name != nil {
			playerCount++
			if index == hostPlayerID {
				name := *player.Name
				hostName = &name
			}
		}
	}

	return dto.RoomInfoDTO{
		Code:        code,
		HostName:    hostName,
		PlayerCount: playerCount,
		Phase:       game.GetState().Phase,
	}
}

func ToLobbyPlayerDTO(p entity.LobbyPlayer) dto.LobbyPlayerDTO {
	return dto.LobbyPlayerDTO{
		ID:        p.ID,
		Name:      cloneString(p.Name),
		Connected: p.Connected,
		IsBot:     p.IsBot,
		Color:     p.Color,
		Avatar:    p.Avatar,
	}
}

func ToServerMessageDTO(msg entity.ServerMessage) dto.ServerMessageDTO {
	switch message := msg.(type) {
	case entity.ServerMessageWelcome:
		playerID := message.PlayerID
		hostPlayerID := message.HostPlayerID
		code := message.Code
		state := message.State
		return dto.ServerMessageDTO{
			Type:           message.Type,
			PlayerID:       &playerID,
			HostPlayerID:   &hostPlayerID,
			Players:        lobbyPlayers(message.Players),
			IncludePlayers: true,
			State:          &state,
			Code:           &code,
		}
	case entity.ServerMessageLobby:
		hostPlayerID := message.HostPlayerID
		return dto.ServerMessageDTO{
			Type:           message.Type,
			HostPlayerID:   &hostPlayerID,
			Players:        lobbyPlayers(message.Players),
			IncludePlayers: true,
		}
	case entity.ServerMessageState:
		state := message.State
		return dto.ServerMessageDTO{Type: message.Type, State: &state}
	case entity.ServerMessageLeft:
		return dto.ServerMessageDTO{Type: message.Type}
	case entity.ServerMessageError:
		text := message.Message
		return dto.ServerMessageDTO{Type: message.Type, Message: &text}
	case entity.ServerMessageEmoticon:
		playerID := message.PlayerID
		emoticon := message.Emoticon
		return dto.ServerMessageDTO{Type: message.Type, PlayerID: &playerID, Emoticon: &emoticon}
	default:
		panic("unsupported or nil server message")
	}
}

func lobbyPlayers(players []entity.LobbyPlayer) []dto.LobbyPlayerDTO {
	if players == nil {
		return nil
	}
	out := make([]dto.LobbyPlayerDTO, len(players))
	copy(out, players)
	return out
}

func cloneString(value *string) *string {
	if value == nil {
		return nil
	}
	copy := *value
	return &copy
}
