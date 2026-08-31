package entity

import (
	"encoding/json"
	"fmt"
	"testing"
)

func TestLobbyPlayerJSON(t *testing.T) {
	name := "Alice"
	lp := LobbyPlayer{
		ID:        1,
		Name:      &name,
		Connected: true,
		IsBot:     false,
		Color:     "#ff0000",
		Avatar:    NewPresetAvatarData("hat"),
	}

	data, err := json.Marshal(lp)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var got LobbyPlayer
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if got.ID != lp.ID || got.Name == nil || *got.Name != "Alice" || got.Color != "#ff0000" {
		t.Errorf("round-trip mismatch: got %+v", got)
	}
}

func TestLobbyPlayerNullName(t *testing.T) {
	lp := LobbyPlayer{ID: 2, Name: nil, Color: "#00ff00"}

	data, err := json.Marshal(lp)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var got LobbyPlayer
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if got.Name != nil {
		t.Errorf("expected nil name, got %q", *got.Name)
	}
}

func TestRoomInfoJSON(t *testing.T) {
	host := "Bob"
	ri := RoomInfo{
		Code:        "ABC12",
		HostName:    &host,
		PlayerCount: 3,
		Phase:       GamePhaseWaiting,
	}

	data, err := json.Marshal(ri)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var got RoomInfo
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if got.Code != "ABC12" || got.Phase != GamePhaseWaiting || got.PlayerCount != 3 {
		t.Errorf("round-trip mismatch: got %+v", got)
	}
}

// --- ClientMessage round-trip tests ---

func TestClientMessageCreateRoundTrip(t *testing.T) {
	msg := ClientMessageCreate{
		Type:   ClientMessageTypeCreate,
		Name:   "Alice",
		Color:  "#ff0000",
		Avatar: ptrAvatar(NewPresetAvatarData("car")),
	}

	data, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var raw map[string]interface{}
	if err := json.Unmarshal(data, &raw); err != nil {
		t.Fatalf("unmarshal raw: %v", err)
	}
	if raw["type"] != "create" || raw["name"] != "Alice" {
		t.Errorf("json fields wrong: %v", raw)
	}

	var got ClientMessageCreate
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatalf("unmarshal typed: %v", err)
	}
	if got.Name != "Alice" || got.Color != "#ff0000" {
		t.Errorf("round-trip mismatch: %+v", got)
	}
}

func TestClientMessageJoinRoundTrip(t *testing.T) {
	msg := ClientMessageJoin{
		Type:   ClientMessageTypeJoin,
		Code:   "XY789",
		Name:   "Bob",
		Color:  "#0000ff",
		Avatar: ptrAvatar(NewCustomAvatarData("data:image/png;base64,abc")),
	}

	data, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var got ClientMessageJoin
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if got.Code != "XY789" || got.Name != "Bob" {
		t.Errorf("round-trip mismatch: %+v", got)
	}
}

func TestClientMessageStartRoundTrip(t *testing.T) {
	msg := ClientMessageStart{Type: ClientMessageTypeStart}

	data, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var raw map[string]interface{}
	if err := json.Unmarshal(data, &raw); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if raw["type"] != "start" {
		t.Errorf("expected type=start, got %v", raw["type"])
	}
}

func TestClientMessageLeaveRoundTrip(t *testing.T) {
	msg := ClientMessageLeave{Type: ClientMessageTypeLeave}

	data, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	if string(data) != `{"type":"leave"}` {
		t.Errorf("unexpected json: %s", data)
	}
}

func TestClientMessageAddBotRoundTrip(t *testing.T) {
	msg := ClientMessageAddBot{Type: ClientMessageTypeAddBot}

	data, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	if string(data) != `{"type":"addBot"}` {
		t.Errorf("unexpected json: %s", data)
	}
}

func TestClientMessageRemoveBotRoundTrip(t *testing.T) {
	msg := ClientMessageRemoveBot{Type: ClientMessageTypeRemoveBot, PlayerID: 5}

	data, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var got ClientMessageRemoveBot
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if got.PlayerID != 5 {
		t.Errorf("expected playerId=5, got %d", got.PlayerID)
	}
}

func TestClientMessageActionRoundTrip(t *testing.T) {
	action := map[string]interface{}{
		"type":   "ROLL_DICE",
		"aimed":  false,
		"target": 0,
	}
	msg := ClientMessageAction{
		Type:   ClientMessageTypeAction,
		Action: action,
	}

	data, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var raw map[string]interface{}
	if err := json.Unmarshal(data, &raw); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if raw["type"] != "action" {
		t.Errorf("expected type=action, got %v", raw["type"])
	}
	actionMap, ok := raw["action"].(map[string]interface{})
	if !ok || actionMap["type"] != "ROLL_DICE" {
		t.Errorf("action round-trip failed: %v", raw["action"])
	}
}

func TestClientMessageSetIdentityRoundTrip(t *testing.T) {
	msg := ClientMessageSetIdentity{
		Type:   ClientMessageTypeSetIdentity,
		Color:  "#00ff00",
		Avatar: ptrAvatar(NewPresetAvatarData("dog")),
	}

	data, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var got ClientMessageSetIdentity
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if got.Color != "#00ff00" {
		t.Errorf("expected color=#00ff00, got %s", got.Color)
	}
}

func TestClientMessageSetIdentityOmitempty(t *testing.T) {
	msg := ClientMessageSetIdentity{Type: ClientMessageTypeSetIdentity}

	data, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var raw map[string]interface{}
	if err := json.Unmarshal(data, &raw); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if _, hasColor := raw["color"]; hasColor {
		t.Error("expected color to be omitted")
	}
	if _, hasAvatar := raw["avatar"]; hasAvatar {
		t.Error("expected avatar to be omitted")
	}
}

func TestClientMessageManualBotToggleRoundTrip(t *testing.T) {
	msg := ClientMessageManualBotToggle{Type: ClientMessageTypeManualBotToggle}

	data, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	if string(data) != `{"type":"manualBotToggle"}` {
		t.Errorf("unexpected json: %s", data)
	}
}

func TestClientMessageEmoticonRoundTrip(t *testing.T) {
	msg := ClientMessageEmoticon{
		Type:     ClientMessageTypeEmoticon,
		Emoticon: EmoticonHappy,
	}

	data, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var got ClientMessageEmoticon
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if got.Type != "emoticon" {
		t.Errorf("expected type=emoticon, got %v", got.Type)
	}
	if got.Emoticon != EmoticonHappy {
		t.Errorf("expected emoticon=happy, got %v", got.Emoticon)
	}
}

// --- ServerMessage round-trip tests ---

func TestServerMessageWelcomeRoundTrip(t *testing.T) {
	msg := ServerMessageWelcome{
		Type:         ServerMessageTypeWelcome,
		PlayerID:     1,
		HostPlayerID: 1,
		Players: []LobbyPlayer{
			{ID: 1, Name: strPtr("Alice"), Color: "#ff0000", Avatar: NewPresetAvatarData("hat")},
		},
		State: GameState{Phase: GamePhaseSetup},
		Code:  "ABC12",
	}

	data, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var got ServerMessageWelcome
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if got.PlayerID != 1 || got.Code != "ABC12" {
		t.Errorf("round-trip mismatch: %+v", got)
	}
	if len(got.Players) != 1 || got.Players[0].ID != 1 {
		t.Errorf("players mismatch: %+v", got.Players)
	}
}

func TestServerMessageLobbyRoundTrip(t *testing.T) {
	msg := ServerMessageLobby{
		Type: ServerMessageTypeLobby,
		Players: []LobbyPlayer{
			{ID: 1, Color: "#ff0000", Avatar: NewPresetAvatarData("hat")},
			{ID: 2, IsBot: true, Color: "#0000ff", Avatar: NewPresetAvatarData("car")},
		},
		HostPlayerID: 1,
	}

	data, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var got ServerMessageLobby
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if len(got.Players) != 2 || got.HostPlayerID != 1 {
		t.Errorf("round-trip mismatch: %+v", got)
	}
}

func TestServerMessageStateRoundTrip(t *testing.T) {
	msg := ServerMessageState{
		Type:  ServerMessageTypeState,
		State: GameState{Phase: GamePhaseRolling, CurrentPlayer: 2},
	}

	data, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var got ServerMessageState
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if got.State.Phase != GamePhaseRolling || got.State.CurrentPlayer != 2 {
		t.Errorf("round-trip mismatch: %+v", got)
	}
}

func TestPlayerJSONIncludesGetOutOfJailFreeCardsForZeroAndNonzeroValues(t *testing.T) {
	for _, want := range []int{0, 2} {
		t.Run(fmt.Sprintf("%d", want), func(t *testing.T) {
			data, err := json.Marshal(Player{GetOutOfJailFreeCards: want})
			if err != nil {
				t.Fatalf("marshal: %v", err)
			}

			var raw map[string]json.RawMessage
			if err := json.Unmarshal(data, &raw); err != nil {
				t.Fatalf("unmarshal raw: %v", err)
			}
			value, ok := raw["getOutOfJailFreeCards"]
			if !ok {
				t.Fatalf("missing getOutOfJailFreeCards in %s", data)
			}
			if string(value) != fmt.Sprintf("%d", want) {
				t.Fatalf("getOutOfJailFreeCards = %s, want %d", value, want)
			}
		})
	}
}

func TestServerMessageLeftRoundTrip(t *testing.T) {
	msg := ServerMessageLeft{Type: ServerMessageTypeLeft}

	data, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	if string(data) != `{"type":"left"}` {
		t.Errorf("unexpected json: %s", data)
	}
}

func TestServerMessageErrorRoundTrip(t *testing.T) {
	msg := ServerMessageError{
		Type:    ServerMessageTypeError,
		Message: "room not found",
	}

	data, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var got ServerMessageError
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if got.Message != "room not found" {
		t.Errorf("expected 'room not found', got %q", got.Message)
	}
}

func TestServerMessageEmoticonRoundTrip(t *testing.T) {
	msg := ServerMessageEmoticon{
		Type:     ServerMessageTypeEmoticon,
		PlayerID: 3,
		Emoticon: EmoticonSad,
	}

	data, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var got ServerMessageEmoticon
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if got.Type != "emoticon" {
		t.Errorf("expected type=emoticon, got %v", got.Type)
	}
	if got.PlayerID != 3 {
		t.Errorf("expected playerId=3, got %v", got.PlayerID)
	}
	if got.Emoticon != EmoticonSad {
		t.Errorf("expected emoticon=sad, got %v", got.Emoticon)
	}
	var raw map[string]interface{}
	if err := json.Unmarshal(data, &raw); err != nil {
		t.Fatalf("unmarshal raw: %v", err)
	}
	if _, ok := raw["players"]; ok {
		t.Fatal("emoticon message unexpectedly contains players")
	}
}

// --- Constant value tests ---

func TestConnectionStatusConstants(t *testing.T) {
	if ConnectionStatusConnecting != "connecting" {
		t.Errorf("expected 'connecting', got %q", ConnectionStatusConnecting)
	}
	if ConnectionStatusConnected != "connected" {
		t.Errorf("expected 'connected', got %q", ConnectionStatusConnected)
	}
	if ConnectionStatusDisconnected != "disconnected" {
		t.Errorf("expected 'disconnected', got %q", ConnectionStatusDisconnected)
	}
}

func TestClientMessageTypeConstants(t *testing.T) {
	tests := []struct {
		got, want string
	}{
		{ClientMessageTypeCreate, "create"},
		{ClientMessageTypeJoin, "join"},
		{ClientMessageTypeStart, "start"},
		{ClientMessageTypeLeave, "leave"},
		{ClientMessageTypeAddBot, "addBot"},
		{ClientMessageTypeRemoveBot, "removeBot"},
		{ClientMessageTypeAction, "action"},
		{ClientMessageTypeSetIdentity, "setIdentity"},
		{ClientMessageTypeManualBotToggle, "manualBotToggle"},
		{ClientMessageTypeEmoticon, "emoticon"},
	}
	for _, tt := range tests {
		if tt.got != tt.want {
			t.Errorf("expected %q, got %q", tt.want, tt.got)
		}
	}
}

func TestServerMessageTypeConstants(t *testing.T) {
	tests := []struct {
		got, want string
	}{
		{ServerMessageTypeWelcome, "welcome"},
		{ServerMessageTypeLobby, "lobby"},
		{ServerMessageTypeState, "state"},
		{ServerMessageTypeLeft, "left"},
		{ServerMessageTypeError, "error"},
		{ServerMessageTypeEmoticon, "emoticon"},
	}
	for _, tt := range tests {
		if tt.got != tt.want {
			t.Errorf("expected %q, got %q", tt.want, tt.got)
		}
	}
}

func TestHttpPathConstants(t *testing.T) {
	tests := []struct {
		got, want string
	}{
		{HttpPathConfig, "/config"},
		{HttpPathSeed, "/seed"},
		{HttpPathRooms, "/rooms"},
		{HttpPathWs, "/ws"},
	}
	for _, tt := range tests {
		if tt.got != tt.want {
			t.Errorf("expected %q, got %q", tt.want, tt.got)
		}
	}
}

// helper
func strPtr(s string) *string { return &s }

func ptrAvatar(d PlayerAvatarData) *PlayerAvatarData { return &d }
