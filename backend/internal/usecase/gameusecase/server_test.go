package gameusecase

import (
	"encoding/json"
	"testing"
	"time"

	"monopoly-game-backend/internal/data"
	"monopoly-game-backend/internal/entity"
	"monopoly-game-backend/pkg/clock"
)

type serverEvents struct {
	states   []entity.GameState
	lobbies  []entity.LobbyPlayer
	sent     []entity.ServerMessage
	emotions []int
}

func (e *serverEvents) BroadcastEmoticon(playerID int, _ entity.Emoticon) {
	e.emotions = append(e.emotions, playerID)
}

func (e *serverEvents) BroadcastState(state entity.GameState) { e.states = append(e.states, state) }
func (e *serverEvents) BroadcastLobby(players []entity.LobbyPlayer, _ int) {
	e.lobbies = append(e.lobbies, players...)
}
func (e *serverEvents) Send(_ ClientId, message entity.ServerMessage) {
	e.sent = append(e.sent, message)
}

func newTestServer(fc *clock.FakeClock) (*GameServer, *serverEvents) {
	events := &serverEvents{}
	return NewGameServer(events, GameServerOptions{Clock: fc, RNG: func() float64 { return 0.5 }, Code: "ABC12", AFKTimeout: time.Second}), events
}

func TestGameServerLobbyDefaultsUseSlotIndexedColorsAndCatAvatars(t *testing.T) {
	server, _ := newTestServer(clock.NewFakeClock())
	players := server.GetPlayers()
	if len(players) != 6 || players[0].Color != data.PLAYER_COLORS[0] || players[1].Color != data.PLAYER_COLORS[1] || players[0].Avatar.Kind != entity.AvatarKindPreset || players[0].Avatar.Data.(entity.PresetAvatar).ID != "cat" {
		t.Fatalf("unexpected lobby defaults: %+v", players)
	}
}

func TestGameServerLobbyDefaultsPreserveExplicitIdentityAndSparseSlots(t *testing.T) {
	server, _ := newTestServer(clock.NewFakeClock())
	explicitAvatar := entity.NewPresetAvatarData("dog")
	if !server.Join("c0", "Alice", JoinOptions{Color: "#123456", Avatar: &explicitAvatar}) {
		t.Fatal("explicit identity join failed")
	}
	if !server.Join("c1", "Bob", JoinOptions{}) {
		t.Fatal("second join failed")
	}
	players := server.GetPlayers()
	if players[0].Color != "#123456" || players[0].Avatar.Data.(entity.PresetAvatar).ID != "dog" {
		t.Fatalf("explicit identity was not preserved: %+v", players[0])
	}
	if players[1].Color != data.PLAYER_COLORS[0] || players[2].Color != data.PLAYER_COLORS[2] {
		t.Fatalf("sparse lobby defaults incorrect: %+v", players)
	}
}

func TestGameServerStartupSerializationUsesSlotIndexedIdentities(t *testing.T) {
	server, events := newTestServer(clock.NewFakeClock())
	server.Join("c0", "Alice", JoinOptions{})
	server.Join("c1", "Bob", JoinOptions{})
	server.Start("c0")
	state := server.GetState()
	if len(state.Players) != 2 || state.Players[0].Color != data.PLAYER_COLORS[0] || state.Players[1].Color != data.PLAYER_COLORS[1] {
		t.Fatalf("startup identities incorrect: %+v", state.Players)
	}
	if len(events.lobbies) < 6 || events.lobbies[0].Color != data.PLAYER_COLORS[0] || events.lobbies[1].Color != data.PLAYER_COLORS[1] {
		t.Fatalf("startup lobby serialization incorrect: %+v", events.lobbies)
	}
}

func TestGameServerStartPreservesSparseSlotIdentityForActionsAndOwnership(t *testing.T) {
	server, _ := newTestServer(clock.NewFakeClock())
	if !server.Join("c0", "Alice", JoinOptions{Token: "token-0"}) || !server.Join("c1", "Bob", JoinOptions{Token: "token-1"}) || !server.Join("c2", "Carol", JoinOptions{Token: "token-2"}) {
		t.Fatal("expected all players to join")
	}
	server.Leave("c0")
	server.Start("c1")

	state := server.GetState()
	if len(state.Players) <= 2 || state.Players[1].ID != 1 || state.Players[1].Name != "Bob" || state.Players[2].ID != 2 || state.Players[2].Name != "Carol" {
		t.Fatalf("sparse slot identity was compacted: %+v", state.Players)
	}

	server.mu.Lock()
	state.CurrentPlayer = 1
	server.state = state
	server.mu.Unlock()
	server.HandleAction("c1", entity.EndTurnAction{Type: entity.GameActionTypeEndTurn})
	if got := server.GetState().CurrentPlayer; got == 1 {
		t.Fatalf("authorized action from slot 1 was rejected: current player %d", got)
	}
}

func TestGameServerJoinStartAndHostRules(t *testing.T) {
	server, events := newTestServer(clock.NewFakeClock())
	if !server.Join("c0", " Alice ", JoinOptions{}) || !server.Join("c1", "Bob", JoinOptions{}) {
		t.Fatal("expected both players to join")
	}
	server.Start("c1")
	if server.GetState().Phase != entity.GamePhaseSetup {
		t.Fatal("non-host started the game")
	}
	server.Start("c0")
	if server.GetState().Phase != entity.GamePhaseWaiting || len(server.GetState().Players) != 2 {
		t.Fatalf("unexpected started state: %+v", server.GetState())
	}
	if len(events.sent) < 2 {
		t.Fatal("expected welcome messages")
	}
}

func TestGameServerJoinReplacesDisconnectedClientIdentity(t *testing.T) {
	server, _ := newTestServer(clock.NewFakeClock())
	if !server.Join("c0", "Alice", JoinOptions{Token: "token-1"}) {
		t.Fatal("initial join failed")
	}
	server.Disconnect("c0")
	if !server.Join("c1", "Alice", JoinOptions{Token: "token-1"}) {
		t.Fatal("rejoin failed")
	}
	if id := server.findClient("c1"); id != 0 {
		t.Fatalf("rejoined player id = %d, want 0", id)
	}
	if server.findClient("c0") >= 0 {
		t.Fatal("old client remained attached")
	}
}

func TestGameServerJoinRejectsActiveIdentityWithoutToken(t *testing.T) {
	server, _ := newTestServer(clock.NewFakeClock())
	if !server.Join("c0", "Alice", JoinOptions{Token: "token-1"}) {
		t.Fatal("initial join failed")
	}
	if server.Join("c1", "Alice", JoinOptions{}) {
		t.Fatal("same-name takeover succeeded")
	}
	if id := server.findClient("c0"); id != 0 {
		t.Fatalf("original player id = %d, want 0", id)
	}
}

func TestGameServerJoinReplacesConnectedClientWithToken(t *testing.T) {
	server, _ := newTestServer(clock.NewFakeClock())
	if !server.Join("c0", "Alice", JoinOptions{Token: "token-1"}) {
		t.Fatal("initial join failed")
	}
	if !server.Join("c1", "Alice", JoinOptions{Token: "token-1"}) {
		t.Fatal("same-name replacement failed")
	}
	if id := server.findClient("c1"); id != 0 {
		t.Fatalf("replaced player id = %d, want 0", id)
	}
	if server.findClient("c0") >= 0 {
		t.Fatal("old client remained attached")
	}
}

func TestGameServerRollUsesClockAndReducer(t *testing.T) {
	fc := clock.NewFakeClock()
	server, _ := newTestServer(fc)
	server.Join("c0", "Alice", JoinOptions{})
	server.Join("c1", "Bob", JoinOptions{})
	server.Start("c0")
	currentPlayer := server.GetState().CurrentPlayer
	clientID := "c0"
	if currentPlayer == 1 {
		clientID = "c1"
	}
	server.Roll(clientID, nil)
	if server.GetState().Phase != entity.GamePhaseRolling {
		t.Fatal("roll did not enter rolling phase")
	}
	fc.AdvanceTime(500 * time.Millisecond)
	if server.GetState().Dice == nil || server.GetState().Dice[0] != 4 || server.GetState().Dice[1] != 4 {
		t.Fatalf("unexpected dice: %+v", server.GetState().Dice)
	}
	fc.AdvanceTime(500*time.Millisecond + 8*150*time.Millisecond)
	if server.GetState().Phase != entity.GamePhaseWaiting {
		t.Fatalf("unexpected post-roll phase: %s", server.GetState().Phase)
	}
}

func TestGameServerAfkAndStopUseClockTimers(t *testing.T) {
	fc := clock.NewFakeClock()
	server, _ := newTestServer(fc)
	server.Join("c0", "Alice", JoinOptions{})
	server.AddBot("c0")
	server.Start("c0")
	server.mu.Lock()
	server.state.CurrentPlayer = 0
	server.driveBotLocked()
	server.mu.Unlock()
	fc.AdvanceTime(time.Second)
	if !server.GetState().Players[0].BotControlled {
		t.Fatal("AFK timer did not transfer control")
	}
	server.Stop()
	controlled := server.GetState().Players[0].BotControlled
	fc.AdvanceTime(10 * time.Second)
	if server.GetState().Players[0].BotControlled != controlled {
		t.Fatal("stopped server changed state")
	}
}

func TestGameServerSeedBroadcastUsesCollectionArrays(t *testing.T) {
	fc := clock.NewFakeClock()
	events := &serverEvents{}
	server := NewGameServer(events, GameServerOptions{Clock: fc, SeedEnabled: true})
	server.Join("c0", "Alice", JoinOptions{})
	state := CreateSeededState(SeedSpec{
		Players:       []SeedPlayerSpec{{ID: 0, Name: "Alice", Money: 1500}},
		CurrentPlayer: 0,
	})
	state.EventLog = nil
	state.PendingTrades = nil
	stateCount := len(events.states)
	if err := server.SeedState(state); err != nil {
		t.Fatalf("seed state: %v", err)
	}
	if len(events.states) != stateCount+1 {
		t.Fatalf("broadcast state count: got %d, want %d", len(events.states), stateCount+1)
	}
	data, err := json.Marshal(entity.ServerMessageState{Type: entity.ServerMessageTypeState, State: events.states[stateCount]})
	if err != nil {
		t.Fatalf("marshal state message: %v", err)
	}
	var raw struct {
		State map[string]json.RawMessage `json:"state"`
	}
	if err := json.Unmarshal(data, &raw); err != nil {
		t.Fatalf("unmarshal state message: %v", err)
	}
	for _, field := range []string{"players", "turnOrder", "board", "chanceDeck", "communityDeck", "eventLog", "pendingTrades"} {
		if string(raw.State[field]) == "null" {
			t.Errorf("%s: got null, want collection", field)
		}
	}
	for _, field := range []string{"eventLog", "pendingTrades"} {
		if string(raw.State[field]) != "[]" {
			t.Errorf("%s: got %s, want []", field, raw.State[field])
		}
	}
}

func TestGameServerBuyAndBuildRestoreWaitingPhaseAndAutoAdvance(t *testing.T) {
	fc := clock.NewFakeClock()
	server, _ := newTestServer(fc)
	server.seedEnabled = true
	if !server.Join("c0", "Alice", JoinOptions{}) {
		t.Fatal("join failed")
	}

	buying := entity.GamePhaseBuying
	buyState := CreateSeededState(SeedSpec{
		Players:       []SeedPlayerSpec{{ID: 0, Name: "Alice", Money: 1500}},
		CurrentPlayer: 0,
		Phase:         &buying,
	})
	buyState.Players[0].Position = 1
	buyState.Players[0].PassedGo = true
	buyState.PendingAction = pending(entity.PendingBuyPropertyAction{Type: entity.PendingActionTypeBuyProperty, SpaceID: 1})
	buyState.Dice = &[2]int{1, 2}
	if err := server.SeedState(buyState); err != nil {
		t.Fatalf("seed buying state: %v", err)
	}

	server.HandleAction("c0", entity.BuyPropertyAction{Type: entity.GameActionTypeBuyProperty})
	got := server.GetState()
	if got.Phase != entity.GamePhaseWaiting || got.CurrentPlayer != 0 || got.Board[1].Owner == nil || *got.Board[1].Owner != 0 || got.JustBoughtSpaceID == nil || *got.JustBoughtSpaceID != 1 {
		t.Fatalf("buy action failed: phase=%s currentPlayer=%d owner=%v justBought=%v", got.Phase, got.CurrentPlayer, got.Board[1].Owner, got.JustBoughtSpaceID)
	}
	fc.AdvanceTime(time.Second)
	got = server.GetState()
	if got.CurrentPlayer != 0 || got.Dice != nil {
		t.Fatalf("buy action did not auto-advance: phase=%s currentPlayer=%d dice=%v", got.Phase, got.CurrentPlayer, got.Dice)
	}

	building := entity.GamePhaseBuilding
	buildState := CreateSeededState(SeedSpec{
		Players:       []SeedPlayerSpec{{ID: 0, Name: "Alice", Money: 1500}},
		CurrentPlayer: 0,
		Phase:         &building,
	})
	buildState.Players[0].Position = 1
	buildState.Players[0].PassedGo = true
	buildState.Players[0].Properties = []int{1}
	buildState.Dice = &[2]int{1, 2}
	owner := 0
	buildState.Board[1].Owner = &owner
	if err := server.SeedState(buildState); err != nil {
		t.Fatalf("seed building state: %v", err)
	}

	server.HandleAction("c0", entity.BuildHouseAction{Type: entity.GameActionTypeBuildHouse, SpaceID: 1})
	fc.AdvanceTime(time.Second)
	got = server.GetState()
	if got.Phase != entity.GamePhaseWaiting || got.CurrentPlayer != 0 || got.Board[1].Houses != 1 || !got.BuiltThisStop {
		t.Fatalf("build action auto-advanced or failed: phase=%s currentPlayer=%d houses=%d builtThisStop=%t", got.Phase, got.CurrentPlayer, got.Board[1].Houses, got.BuiltThisStop)
	}
}

func TestGameServerSeedPreservesExplicitBuildingPhase(t *testing.T) {
	fc := clock.NewFakeClock()
	server, _ := newTestServer(fc)
	server.seedEnabled = true
	server.Join("c0", "Alice", JoinOptions{})
	phase := entity.GamePhaseBuilding
	state := CreateSeededState(SeedSpec{
		Players:       []SeedPlayerSpec{{ID: 0, Name: "Alice", Money: 1500}},
		CurrentPlayer: 0,
		Phase:         &phase,
	})
	state.Dice = &[2]int{1, 1}
	owner := 0
	state.Board[1].Owner = &owner
	state.Players[0].Properties = []int{1}
	if err := server.SeedState(state); err != nil {
		t.Fatalf("seed state: %v", err)
	}
	fc.AdvanceTime(10 * time.Second)
	got := server.GetState()
	if got.Phase != entity.GamePhaseBuilding || got.CurrentPlayer != 0 {
		t.Fatalf("seeded building state auto-advanced: phase=%s currentPlayer=%d", got.Phase, got.CurrentPlayer)
	}
}

func TestGameServerSeedCopiesCallerState(t *testing.T) {
	fc := clock.NewFakeClock()
	server, _ := newTestServer(fc)
	server.seedEnabled = true
	server.Join("c0", "Alice", JoinOptions{})
	state := CreateSeededState(SeedSpec{
		Players:       []SeedPlayerSpec{{ID: 0, Name: "Alice", Money: 1500}},
		CurrentPlayer: 0,
	})
	owner := 0
	state.Board[1].Owner = &owner
	state.Players[0].Properties = []int{1}
	state.EventLog = []entity.LogEntry{{Key: entity.LogEventKeyRolled, Params: map[string]interface{}{"amount": 10}}}
	state.PendingTrades = []entity.PendingTrade{{TradeOffer: entity.TradeOffer{OfferProperties: []int{1}, RequestProperties: []int{2}}}}
	if err := server.SeedState(state); err != nil {
		t.Fatalf("seed state: %v", err)
	}
	state.Players[0].Properties = append(state.Players[0].Properties, 9)
	state.TurnOrder[0] = 9
	state.Board[1].Houses = 4
	*state.Board[1].Owner = 1
	state.EventLog[0].Params["amount"] = 99
	state.PendingTrades[0].OfferProperties[0] = 9
	state.PendingTrades[0].RequestProperties = append(state.PendingTrades[0].RequestProperties, 8)
	got := server.GetState()
	if len(got.Players[0].Properties) != 1 || got.TurnOrder[0] != 0 || got.Board[1].Houses != 0 || *got.Board[1].Owner != 0 {
		t.Fatalf("stored state aliases caller collections: %+v", got)
	}
	if got.EventLog[0].Params["amount"] != float64(10) && got.EventLog[0].Params["amount"] != 10 {
		t.Fatalf("stored state aliases event params: %+v", got.EventLog[0].Params)
	}
	if len(got.PendingTrades[0].OfferProperties) != 1 || got.PendingTrades[0].OfferProperties[0] != 1 || len(got.PendingTrades[0].RequestProperties) != 1 {
		t.Fatalf("stored state aliases pending trade collections: %+v", got.PendingTrades[0])
	}
}

func TestGameServerSeedRoomValidationReturnsDirectMessage(t *testing.T) {
	server := NewGameServer(&serverEvents{}, GameServerOptions{SeedEnabled: true})
	state := CreateSeededState(SeedSpec{Players: []SeedPlayerSpec{{ID: 0, Name: "Alice", Money: 1500}}, CurrentPlayer: 0})
	if err := server.SeedState(state); err == nil || err.Error() != "seed has 1 players but the room has 0 joined slots" {
		t.Fatalf("room validation error = %v", err)
	}
}

func TestGameServerGappedRoomSeedPreservesSlotsAndActions(t *testing.T) {
	fc := clock.NewFakeClock()
	server, _ := newTestServer(fc)
	server.seedEnabled = true
	if !server.Join("c0", "Alice", JoinOptions{}) || !server.Join("c1", "Unused", JoinOptions{}) || !server.Join("c2", "Carol", JoinOptions{}) {
		t.Fatal("expected three players to join")
	}
	server.Leave("c1")
	server.Start("c0")

	state := server.GetState()
	if len(state.Players) != 3 || state.Players[0].Name != "Alice" || state.Players[1].Name != "" || state.Players[2].Name != "Carol" {
		t.Fatalf("start did not preserve gapped slots: %+v", state.Players)
	}
	state.CurrentPlayer = 2
	state.TurnOrder = []int{0, 2}
	if err := server.SeedState(state); err != nil {
		t.Fatalf("valid gapped seed rejected: %v", err)
	}
	if got := server.GetState(); got.Players[1].Name != "" || got.CurrentPlayer != 2 {
		t.Fatalf("seed changed slot mapping: %+v", got.Players)
	}

	server.Roll("c2", nil)
	if got := server.GetState(); got.Phase != entity.GamePhaseRolling {
		t.Fatalf("current player roll rejected: phase=%s", got.Phase)
	}
	server.HandleAction("c0", entity.EndTurnAction{Type: entity.GameActionTypeEndTurn})
	if got := server.GetState(); got.CurrentPlayer != 2 {
		t.Fatalf("non-current player action changed turn: %d", got.CurrentPlayer)
	}

	bad := server.GetState()
	bad.Players[1].Name = "Bogus"
	if err := server.SeedState(bad); err == nil {
		t.Fatal("malformed gap seed was accepted")
	}
}

func TestGameServerSeedRequiresFlagAndRoomShape(t *testing.T) {
	fc := clock.NewFakeClock()
	server, _ := newTestServer(fc)
	if err := server.SeedState(entity.GameState{}); err == nil {
		t.Fatal("seeding should be disabled")
	}
	server = NewGameServer(&serverEvents{}, GameServerOptions{Clock: fc, SeedEnabled: true})
	server.Join("c0", "Alice", JoinOptions{})
	if err := server.SeedState(entity.GameState{}); err == nil {
		t.Fatal("invalid seed should fail")
	}
}

func TestGameServerEmoticonCooldownAndSnapshotIsolation(t *testing.T) {
	fc := clock.NewFakeClock()
	server, events := newTestServer(fc)
	server.Join("c0", "Alice", JoinOptions{})
	server.Join("c1", "Bob", JoinOptions{})
	server.Start("c0")
	server.EmitEmoticon("c0", entity.EmoticonHappy)
	server.EmitEmoticon("c0", entity.EmoticonSad)
	if len(events.emotions) != 1 {
		t.Fatalf("expected cooldown to suppress second emoticon, got %d", len(events.emotions))
	}
	state := server.GetState()
	state.TurnOrder[0] = 99
	state.Board[0].Houses = 4
	if server.GetState().TurnOrder[0] == 99 || server.GetState().Board[0].Houses == 4 {
		t.Fatal("GetState returned mutable internal state")
	}
}

func TestGameServerDisconnectGraceDelaysBotAction(t *testing.T) {
	fc := clock.NewFakeClock()
	server, _ := newTestServer(fc)
	server.Join("c0", "Alice", JoinOptions{})
	server.Join("c1", "Bob", JoinOptions{})
	server.Start("c0")
	server.mu.Lock()
	server.state.CurrentPlayer = 0
	server.mu.Unlock()
	server.Disconnect("c0")
	if server.GetState().ReconnectGrace == nil || !server.GetState().Players[0].BotControlled {
		t.Fatal("disconnect did not establish reconnect grace")
	}
	fc.AdvanceTime(BOT_GRACE_MS - time.Millisecond)
	if server.GetState().Phase != entity.GamePhaseWaiting || server.GetState().Dice != nil {
		t.Fatal("bot acted before reconnect grace elapsed")
	}
	fc.AdvanceTime(time.Millisecond)
	if server.GetState().Phase != entity.GamePhaseRolling {
		t.Fatal("bot did not act after reconnect grace elapsed")
	}
}

func TestGameServerBotStepBudgetResetsAtTurnBoundary(t *testing.T) {
	fc := clock.NewFakeClock()
	server, _ := newTestServer(fc)
	server.Join("c0", "Alice", JoinOptions{})
	server.Join("c1", "Bob", JoinOptions{})
	server.Start("c0")

	server.mu.Lock()
	server.clearBotTimerLocked()
	for i := range server.slots[:2] {
		server.slots[i].IsBot = true
		server.state.Players[i].IsBot = true
	}
	server.state.Phase = entity.GamePhaseWaiting
	server.state.CurrentPlayer = 0
	server.state.Dice = &[2]int{3, 4}
	server.botSteps = 100
	server.dispatchLocked(entity.EndTurnAction{Type: entity.GameActionTypeEndTurn})
	server.mu.Unlock()

	if server.GetState().CurrentPlayer != 1 {
		t.Fatalf("turn did not advance: %d", server.GetState().CurrentPlayer)
	}
	server.mu.Lock()
	defer server.mu.Unlock()
	if server.botSteps != 1 {
		t.Fatalf("bot step budget = %d, want 1 after scheduling next turn", server.botSteps)
	}
	if server.botTimer == nil {
		t.Fatal("next bot action was not scheduled")
	}
}

func TestGameServerStopSatisfiesRoomManagerBoundary(t *testing.T) {
	var game interface {
		GetState() entity.GameState
		GetPlayers() []entity.LobbyPlayer
		GetHostPlayerID() int
		Stop()
	} = NewGameServer(&serverEvents{}, GameServerOptions{})
	if game.GetState().Phase != entity.GamePhaseSetup || len(game.GetPlayers()) != 6 || game.GetHostPlayerID() != 0 {
		t.Fatal("unexpected room manager boundary")
	}
	game.Stop()
}
