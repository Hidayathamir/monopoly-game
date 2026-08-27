package converter

import (
	"encoding/json"
	"reflect"
	"testing"

	"monopoly-game-backend/internal/dto"
	"monopoly-game-backend/internal/entity"
	"monopoly-game-backend/internal/usecase/gameusecase"
	"monopoly-game-backend/internal/usecase/roomusecase"
)

func TestToRoomInfoDTO(t *testing.T) {
	game := gameusecase.NewGameServer(nil, gameusecase.GameServerOptions{Code: "ignored"})
	name := "Ada"
	if !game.Join("client", name, gameusecase.JoinOptions{}) {
		t.Fatal("Join() = false")
	}

	var server roomusecase.GameServer = game
	got := ToRoomInfoDTO("ABCDE", server)
	if got.Code != "ABCDE" || got.HostName == nil || *got.HostName != name || got.PlayerCount != 1 || got.Phase != entity.GamePhaseSetup {
		t.Fatalf("ToRoomInfoDTO() = %#v", got)
	}
}

func TestToRoomInfoDTONilServer(t *testing.T) {
	got := ToRoomInfoDTO("ABCDE", nil)
	if got.Code != "ABCDE" || got.HostName != nil || got.PlayerCount != 0 || got.Phase != "" {
		t.Fatalf("ToRoomInfoDTO(nil) = %#v", got)
	}
}

func TestToLobbyPlayerDTO(t *testing.T) {
	name := "Ada"
	player := entity.LobbyPlayer{ID: 2, Name: &name, IsBot: true, Connected: false, Color: "#E74C3C", Avatar: entity.NewPresetAvatarData("cat")}
	got := ToLobbyPlayerDTO(player)
	if got.ID != player.ID || got.Name == nil || *got.Name != name || got.Connected || !got.IsBot || got.Color != player.Color || !reflect.DeepEqual(got.Avatar, player.Avatar) {
		t.Fatalf("ToLobbyPlayerDTO() = %#v", got)
	}
}

func TestToLobbyPlayerDTOPreservesNullableNameAndConnection(t *testing.T) {
	player := entity.LobbyPlayer{ID: 3, Name: nil, Connected: true}
	got := ToLobbyPlayerDTO(player)
	if got.Name != nil || !got.Connected {
		t.Fatalf("ToLobbyPlayerDTO() = %#v", got)
	}
}

func TestToServerMessageDTOPreservesTypedPayloads(t *testing.T) {
	state := entity.GameState{Phase: entity.GamePhaseWaiting}
	messages := []struct {
		name string
		msg  entity.ServerMessage
		want dto.ServerMessageDTO
	}{

		{"welcome", entity.ServerMessageWelcome{Type: entity.ServerMessageTypeWelcome, PlayerID: 1, HostPlayerID: 0, State: state, Code: "ABCDE"}, dto.ServerMessageDTO{Type: "welcome", PlayerID: intPointer(1), HostPlayerID: intPointer(0), Players: nil, IncludePlayers: true, State: &state, Code: stringPointer("ABCDE")}},
		{"lobby", entity.ServerMessageLobby{Type: entity.ServerMessageTypeLobby, HostPlayerID: 2}, dto.ServerMessageDTO{Type: "lobby", HostPlayerID: intPointer(2), Players: nil, IncludePlayers: true}},
		{"state", entity.ServerMessageState{Type: entity.ServerMessageTypeState, State: state}, dto.ServerMessageDTO{Type: "state", State: &state}},
		{"left", entity.ServerMessageLeft{Type: entity.ServerMessageTypeLeft}, dto.ServerMessageDTO{Type: "left"}},
		{"error", entity.ServerMessageError{Type: entity.ServerMessageTypeError, Message: "invalid"}, dto.ServerMessageDTO{Type: "error", Message: stringPointer("invalid")}},
		{"emoticon", entity.ServerMessageEmoticon{Type: entity.ServerMessageTypeEmoticon, PlayerID: 3, Emoticon: "happy"}, dto.ServerMessageDTO{Type: "emoticon", PlayerID: intPointer(3), Emoticon: stringPointer("happy")}},
	}
	for _, test := range messages {
		t.Run(test.name, func(t *testing.T) {
			got := ToServerMessageDTO(test.msg)
			if !reflect.DeepEqual(got, test.want) {
				t.Fatalf("ToServerMessageDTO() = %#v, want %#v", got, test.want)
			}
			data, err := json.Marshal(got)
			if err != nil {
				t.Fatal(err)
			}
			var fields map[string]json.RawMessage
			if err := json.Unmarshal(data, &fields); err != nil {
				t.Fatal(err)
			}
			players, present := fields["players"]
			if test.want.IncludePlayers {
				if !present || string(players) != "[]" {
					t.Fatalf("JSON = %s, want players:[]", data)
				}
			} else if present {
				t.Fatalf("JSON = %s, must omit players", data)
			}
		})
	}
}

func TestToServerMessageDTORejectsNil(t *testing.T) {
	defer func() {
		if recover() == nil {
			t.Fatal("ToServerMessageDTO(nil) did not panic")
		}
	}()
	ToServerMessageDTO(nil)
}

func intPointer(value int) *int {
	return &value
}

func stringPointer(value string) *string {
	return &value
}
