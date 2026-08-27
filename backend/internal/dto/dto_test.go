package dto

import (
	"encoding/json"
	"reflect"
	"testing"

	"monopoly-game-backend/internal/entity"
)

func TestHTTPDTOJSON(t *testing.T) {
	name := "Ada"
	request := SeedRequest{Code: "ABCDE", State: entity.GameState{Phase: entity.GamePhaseSetup}}
	data, err := json.Marshal(request)
	if err != nil {
		t.Fatal(err)
	}
	if got, want := string(data), `{"code":"ABCDE","state":{"phase":"setup","players":[],"turnOrder":[],"currentPlayer":0,"board":[],"chanceDeck":[],"communityDeck":[],"freeParkingPot":0,"dice":null,"doublesCount":0,"lastMoveSteps":null,"eventLog":[],"pendingAction":null,"justBoughtSpaceId":null,"builtThisStop":false,"reconnectGrace":null,"pendingTrades":[],"nextTradeId":0,"tradesEnabled":false}}`; got != want {
		t.Fatalf("SeedRequest JSON = %s, want %s", got, want)
	}

	room := RoomInfoDTO{Code: "ABCDE", HostName: &name, PlayerCount: 1, Phase: entity.GamePhaseSetup}
	data, err = json.Marshal(room)
	if err != nil {
		t.Fatal(err)
	}
	var decoded RoomInfoDTO
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(room, decoded) {
		t.Fatalf("RoomInfoDTO round trip = %#v, want %#v", decoded, room)
	}

	config, err := json.Marshal(ConfigResponse{SeedEnabled: true})
	if err != nil {
		t.Fatal(err)
	}
	if got, want := string(config), `{"seedEnabled":true}`; got != want {
		t.Fatalf("ConfigResponse JSON = %s, want %s", got, want)
	}

	response, err := json.Marshal(SeedResponse{OK: true})
	if err != nil {
		t.Fatal(err)
	}
	if got, want := string(response), `{"ok":true}`; got != want {
		t.Fatalf("SeedResponse JSON = %s, want %s", got, want)
	}
}

func TestClientMessageDTOJSON(t *testing.T) {
	name := "Ada"
	code := "ABCDE"
	playerID := 2
	action := json.RawMessage(`{"type":"rollDice","target":7}`)
	message := ClientMessageDTO{Type: "action", Name: &name, Code: &code, PlayerID: &playerID, Action: action, Emoticon: stringPointer("happy")}
	data, err := json.Marshal(message)
	if err != nil {
		t.Fatal(err)
	}
	var decoded ClientMessageDTO
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatal(err)
	}
	if decoded.Type != message.Type || decoded.Name == nil || *decoded.Name != name || decoded.Code == nil || *decoded.Code != code || decoded.PlayerID == nil || *decoded.PlayerID != playerID || decoded.Emoticon == nil || *decoded.Emoticon != "happy" {
		t.Fatalf("ClientMessageDTO decoded = %#v", decoded)
	}
	var routed struct {
		Type   string `json:"type"`
		Target int    `json:"target"`
	}
	if err := json.Unmarshal(decoded.Action, &routed); err != nil {
		t.Fatal(err)
	}
	if routed.Type != "rollDice" || routed.Target != 7 {
		t.Fatalf("routed action = %#v", routed)
	}
}

func TestClientMessageDTOActionAbsentAndEmpty(t *testing.T) {
	var absent ClientMessageDTO
	if err := json.Unmarshal([]byte(`{"type":"start"}`), &absent); err != nil {
		t.Fatal(err)
	}
	if absent.Action != nil {
		t.Fatalf("absent action = %s, want nil", absent.Action)
	}

	var empty ClientMessageDTO
	if err := json.Unmarshal([]byte(`{"type":"action","action":{}}`), &empty); err != nil {
		t.Fatal(err)
	}
	if empty.Action == nil || string(empty.Action) != "{}" {
		t.Fatalf("empty action = %s, want {}", empty.Action)
	}
}

func TestServerMessageDTOJSON(t *testing.T) {
	playerID := 1
	hostPlayerID := 0
	code := "ABCDE"
	message := "invalid action"
	emoticon := "sad"
	dto := ServerMessageDTO{Type: "welcome", PlayerID: &playerID, HostPlayerID: &hostPlayerID, Players: []entity.LobbyPlayer{}, IncludePlayers: true, State: &entity.GameState{Phase: entity.GamePhaseSetup}, Code: &code, Message: &message, Emoticon: &emoticon}
	data, err := json.Marshal(dto)
	if err != nil {
		t.Fatal(err)
	}
	if string(data) == "{}" || !containsJSONField(data, "players", "[]") {
		t.Fatalf("empty Players JSON = %s, want players:[]", data)
	}
	var decoded ServerMessageDTO
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatal(err)
	}
	if decoded.Type != dto.Type || decoded.PlayerID == nil || *decoded.PlayerID != playerID || decoded.HostPlayerID == nil || *decoded.HostPlayerID != hostPlayerID || decoded.Code == nil || *decoded.Code != code || decoded.Message == nil || *decoded.Message != message || decoded.Emoticon == nil || *decoded.Emoticon != emoticon || decoded.State == nil || decoded.State.Phase != entity.GamePhaseSetup {
		t.Fatalf("ServerMessageDTO decoded = %#v", decoded)
	}
}

func TestServerMessageDTOPlayersInclusionAndReceiverBehavior(t *testing.T) {
	players := []entity.LobbyPlayer{{ID: 7}}
	tests := []struct {
		name           string
		dto            ServerMessageDTO
		marshalPointer bool
		wantPlayers    string
		wantPresent    bool
	}{
		{name: "value includes nil players", dto: ServerMessageDTO{Type: "welcome", IncludePlayers: true}, wantPlayers: "[]", wantPresent: true},
		{name: "pointer includes nil players", dto: ServerMessageDTO{Type: "lobby", IncludePlayers: true}, marshalPointer: true, wantPlayers: "[]", wantPresent: true},
		{name: "value includes populated players", dto: ServerMessageDTO{Type: "lobby", Players: players, IncludePlayers: true}, wantPlayers: `[{"id":7,"name":null,"connected":false,"isBot":false,"color":"","avatar":null}]`, wantPresent: true},
		{name: "pointer omits populated players when disabled", dto: ServerMessageDTO{Type: "state", Players: players}, marshalPointer: true, wantPresent: false},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			var data []byte
			var err error
			if test.marshalPointer {
				data, err = json.Marshal(&test.dto)
			} else {
				data, err = json.Marshal(test.dto)
			}
			if err != nil {
				t.Fatal(err)
			}
			var fields map[string]json.RawMessage
			if err := json.Unmarshal(data, &fields); err != nil {
				t.Fatal(err)
			}
			value, present := fields["players"]
			if present != test.wantPresent {
				t.Fatalf("JSON = %s, players present = %t, want %t", data, present, test.wantPresent)
			}
			if present && string(value) != test.wantPlayers {
				t.Fatalf("players = %s, want %s", value, test.wantPlayers)
			}
		})
	}
}

func TestServerMessageDTOAllNonLobbyMessagesOmitPlayers(t *testing.T) {
	for _, messageType := range []string{"state", "left", "error", "emoticon"} {
		data, err := json.Marshal(&ServerMessageDTO{Type: messageType, Players: []entity.LobbyPlayer{{ID: 1}}})
		if err != nil {
			t.Fatal(err)
		}
		var fields map[string]json.RawMessage
		if err := json.Unmarshal(data, &fields); err != nil {
			t.Fatal(err)
		}
		if _, ok := fields["players"]; ok {
			t.Fatalf("%s JSON = %s, must omit players", messageType, data)
		}
	}
}

func containsJSONField(data []byte, key, value string) bool {
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(data, &fields); err != nil {
		return false
	}
	return string(fields[key]) == value
}

func stringPointer(value string) *string {
	return &value
}
