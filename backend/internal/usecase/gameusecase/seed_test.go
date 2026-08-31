package gameusecase

import (
	"testing"

	"monopoly-game-backend/internal/entity"
)

func slotsAlphaBravo() []SlotInfo {
	alpha := "Alpha"
	bravo := "Bravo"
	return []SlotInfo{
		{Name: &alpha, Connected: true, IsBot: false},
		{Name: &bravo, Connected: true, IsBot: false},
	}
}

func ownerInt(i int) *int  { return &i }
func housesInt(i int) *int { return &i }

func baseState() entity.GameState {
	return CreateSeededState(SeedSpec{
		Players: []SeedPlayerSpec{
			{ID: 0, Name: "Alpha", Money: 1000},
			{ID: 1, Name: "Bravo", Money: 1},
		},
		Board: map[int]SeedBoardOverride{
			39: {Owner: ownerInt(0), Houses: housesInt(4)},
		},
		CurrentPlayer: 1,
		TurnOrder:     &[]int{1, 0},
	})
}

func TestCreateSeededState_Basic(t *testing.T) {
	s := baseState()
	if s.Phase != entity.GamePhaseWaiting {
		t.Fatalf("phase: got %s, want %s", s.Phase, entity.GamePhaseWaiting)
	}
	if len(s.Board) != 40 {
		t.Fatalf("board length: got %d, want 40", len(s.Board))
	}
	if len(s.Players) != 2 {
		t.Fatalf("player count: got %d, want 2", len(s.Players))
	}
	if s.Players[0].ID != 0 || s.Players[1].ID != 1 {
		t.Fatalf("players sorted by id: got %v %v", s.Players[0].ID, s.Players[1].ID)
	}
	if s.Players[0].Position != 0 {
		t.Fatalf("position: got %d, want 0", s.Players[0].Position)
	}
	if s.Players[0].PassedGo != true {
		t.Fatal("passedGo default should be true")
	}
	if s.Players[0].Bankrupt != false {
		t.Fatal("bankrupt default should be false")
	}
	if len(s.Players[0].Properties) != 1 || s.Players[0].Properties[0] != 39 {
		t.Fatalf("properties: got %v, want [39]", s.Players[0].Properties)
	}
	if s.Board[39].Owner == nil || *s.Board[39].Owner != 0 {
		t.Fatal("board[39].owner should be 0")
	}
	if s.Board[39].Houses != 4 {
		t.Fatalf("board[39].houses: got %d, want 4", s.Board[39].Houses)
	}
	if s.Board[39].Mortgaged != false {
		t.Fatal("board[39].mortgaged default should be false")
	}
	if len(s.TurnOrder) != 2 || s.TurnOrder[0] != 1 || s.TurnOrder[1] != 0 {
		t.Fatalf("turnOrder: got %v, want [1,0]", s.TurnOrder)
	}
	if s.PendingAction != nil {
		t.Fatal("pendingAction should be nil")
	}
	if s.Dice != nil {
		t.Fatal("dice should be nil")
	}
	if len(s.ChanceDeck) == 0 {
		t.Fatal("chanceDeck should not be empty")
	}
	if v := ValidateStateStructure(s); v.Kind != ValidationKindOk {
		t.Fatalf("validation: got error: %s", v.Message)
	}
}

func TestCreateSeededState_WithPendingAction(t *testing.T) {
	var paInner entity.PendingAction = entity.PendingPayRentAction{
		Type:    entity.PendingActionTypePayRent,
		SpaceID: 39,
		Amount:  1700,
	}
	pa := &paInner
	phase := entity.GamePhaseResolving
	s := CreateSeededState(SeedSpec{
		Players: []SeedPlayerSpec{
			{ID: 0, Name: "Alpha", Money: 1000},
			{ID: 1, Name: "Bravo", Money: 1},
		},
		Board: map[int]SeedBoardOverride{
			39: {Owner: ownerInt(0), Houses: housesInt(4)},
		},
		CurrentPlayer: 1,
		Phase:         &phase,
		PendingAction: pa,
	})
	if s.Phase != entity.GamePhaseResolving {
		t.Fatalf("phase: got %s, want %s", s.Phase, entity.GamePhaseResolving)
	}
	if s.PendingAction == nil {
		t.Fatal("pendingAction should not be nil")
	}
	if v := ValidateStateStructure(s); v.Kind != ValidationKindOk {
		t.Fatalf("validation: got error: %s", v.Message)
	}
}

func TestCreateSeededState_Defaults(t *testing.T) {
	s := CreateSeededState(SeedSpec{
		Players: []SeedPlayerSpec{
			{ID: 0, Name: "A", Money: 100},
		},
		CurrentPlayer: 0,
	})
	if s.TurnOrder[0] != 0 {
		t.Fatalf("turnOrder default: got %v, want [0]", s.TurnOrder)
	}
	if s.Players[0].Color != "#E74C3C" {
		t.Fatalf("color default: got %s, want #E74C3C", s.Players[0].Color)
	}
	if s.Players[0].Avatar.Kind != entity.AvatarKindPreset {
		t.Fatalf("avatar kind: got %s, want preset", s.Players[0].Avatar.Kind)
	}
	if s.Players[0].InJail || s.Players[0].IsBot || s.Players[0].Afk {
		t.Fatal("bool defaults should be false")
	}
}

func TestValidateStateStructure_WrongBoardLength(t *testing.T) {
	s := baseState()
	bad := make([]entity.Space, 10)
	copy(bad, s.Board[:10])
	s.Board = bad
	v := ValidateStateStructure(s)
	if v.Kind != ValidationKindError {
		t.Fatalf("expected error, got: %s", v.Kind)
	}
	if len(v.Message) == 0 {
		t.Fatal("error message should not be empty")
	}
}

func TestValidateStateStructure_DuplicateIDs(t *testing.T) {
	s := baseState()
	dup := make([]entity.Player, 2)
	dup[0] = s.Players[0]
	dup[1] = entity.Player{ID: 0, Name: "Bravo", Color: "#3498DB"}
	s.Players = dup
	v := ValidateStateStructure(s)
	if v.Kind != ValidationKindError {
		t.Fatalf("expected error, got: %s", v.Kind)
	}
}

func TestValidateStateStructure_TurnOrderNotPermutation(t *testing.T) {
	s := baseState()
	s.TurnOrder = []int{1, 1}
	v := ValidateStateStructure(s)
	if v.Kind != ValidationKindError {
		t.Fatalf("expected error, got: %s", v.Kind)
	}
}

func TestValidateStateStructure_CurrentPlayerNotInTurnOrder(t *testing.T) {
	s := baseState()
	s.CurrentPlayer = 9
	v := ValidateStateStructure(s)
	if v.Kind != ValidationKindError {
		t.Fatalf("expected error, got: %s", v.Kind)
	}
}

func TestValidateStateStructure_PropertiesMismatch(t *testing.T) {
	s := baseState()
	players := make([]entity.Player, len(s.Players))
	copy(players, s.Players)
	players[0].Properties = []int{}
	s.Players = players
	v := ValidateStateStructure(s)
	if v.Kind != ValidationKindError {
		t.Fatalf("expected error, got: %s", v.Kind)
	}
}

func TestValidateStateStructure_PropertiesClaimedNotOwned(t *testing.T) {
	s := baseState()
	players := make([]entity.Player, len(s.Players))
	copy(players, s.Players)
	players[1].Properties = []int{1}
	s.Players = players
	v := ValidateStateStructure(s)
	if v.Kind != ValidationKindError {
		t.Fatalf("expected error, got: %s", v.Kind)
	}
}

func TestValidateStateStructure_HousesOutOfRange(t *testing.T) {
	s := baseState()
	board := make([]entity.Space, len(s.Board))
	copy(board, s.Board)
	board[39].Houses = 6
	s.Board = board
	v := ValidateStateStructure(s)
	if v.Kind != ValidationKindError {
		t.Fatalf("expected error, got: %s", v.Kind)
	}
}

func TestValidateStateStructure_WaitingWithPendingAction(t *testing.T) {
	s := baseState()
	var paInner entity.PendingAction = entity.PendingPayRentAction{Type: entity.PendingActionTypePayRent, SpaceID: 39, Amount: 1700}
	s.PendingAction = &paInner
	v := ValidateStateStructure(s)
	if v.Kind != ValidationKindError {
		t.Fatalf("expected error, got: %s", v.Kind)
	}
}

func TestValidateStateStructure_ResolvingWithoutPendingAction(t *testing.T) {
	s := baseState()
	s.Phase = entity.GamePhaseResolving
	s.PendingAction = nil
	v := ValidateStateStructure(s)
	if v.Kind != ValidationKindError {
		t.Fatalf("expected error, got: %s", v.Kind)
	}
}

func TestValidateStateStructure_InvalidColor(t *testing.T) {
	s := CreateSeededState(SeedSpec{
		Players:       []SeedPlayerSpec{{ID: 0, Name: "A", Money: 100}},
		CurrentPlayer: 0,
	})
	badColor := "#123456"
	s.Players[0].Color = badColor
	v := ValidateStateStructure(s)
	if v.Kind != ValidationKindError {
		t.Fatalf("expected error, got: %s", v.Kind)
	}
}

func TestValidateStateStructure_InvalidAvatar(t *testing.T) {
	s := CreateSeededState(SeedSpec{
		Players:       []SeedPlayerSpec{{ID: 0, Name: "A", Money: 100}},
		CurrentPlayer: 0,
	})
	s.Players[0].Avatar = entity.PlayerAvatarData{Kind: "custom", Data: entity.CustomAvatar{Kind: "custom", DataURL: "nope"}}
	v := ValidateStateStructure(s)
	if v.Kind != ValidationKindError {
		t.Fatalf("expected error, got: %s", v.Kind)
	}
}

func TestValidateStateStructure_ValidDefaults(t *testing.T) {
	s := CreateSeededState(SeedSpec{
		Players:       []SeedPlayerSpec{{ID: 0, Name: "A", Money: 100}},
		CurrentPlayer: 0,
	})
	v := ValidateStateStructure(s)
	if v.Kind != ValidationKindOk {
		t.Fatalf("expected ok, got: %s - %s", v.Kind, v.Message)
	}
}

func TestValidateStateStructure_RejectsSparsePlayerIDs(t *testing.T) {
	state := CreateSeededState(SeedSpec{
		Players:       []SeedPlayerSpec{{ID: 0, Name: "Alpha", Money: 100}, {ID: 2, Name: "Bravo", Money: 100}},
		CurrentPlayer: 2,
	})
	result := ValidateStateStructure(state)
	if result.Kind != ValidationKindError {
		t.Fatalf("expected sparse player IDs to be rejected, got: %s", result.Kind)
	}
}

func TestValidateStateStructure_AcceptsDensePlayerIDs(t *testing.T) {
	state := CreateSeededState(SeedSpec{
		Players:       []SeedPlayerSpec{{ID: 0, Name: "Alpha", Money: 100}, {ID: 1, Name: "Bravo", Money: 100}},
		CurrentPlayer: 1,
	})
	result := ValidateStateStructure(state)
	if result.Kind != ValidationKindOk {
		t.Fatalf("expected dense player IDs to be accepted, got: %s - %s", result.Kind, result.Message)
	}
	if state.Players[0].ID != 0 || state.Players[1].ID != 1 {
		t.Fatalf("expected dense player indexing, got: %+v", state.Players)
	}
}

func TestValidateStateForRoom_Ok(t *testing.T) {
	s := baseState()
	v := ValidateStateForRoom(s, slotsAlphaBravo())
	if v.Kind != ValidationKindOk {
		t.Fatalf("expected ok, got: %s - %s", v.Kind, v.Message)
	}
}

func TestValidateStateForRoom_PlayerCountMismatch(t *testing.T) {
	one := CreateSeededState(SeedSpec{
		Players:       []SeedPlayerSpec{{ID: 0, Name: "Alpha", Money: 100}},
		CurrentPlayer: 0,
	})
	v := ValidateStateForRoom(one, slotsAlphaBravo())
	if v.Kind != ValidationKindError {
		t.Fatalf("expected error, got: %s", v.Kind)
	}
}

func TestValidateStateForRoom_PlayerIDNoSlot(t *testing.T) {
	alpha := "Alpha"
	slots := []SlotInfo{
		{Name: &alpha, Connected: true, IsBot: false},
	}
	stray := CreateSeededState(SeedSpec{
		Players:       []SeedPlayerSpec{{ID: 2, Name: "Casper", Money: 100}},
		CurrentPlayer: 2,
	})
	v := ValidateStateForRoom(stray, slots)
	if v.Kind != ValidationKindError {
		t.Fatalf("expected error, got: %s", v.Kind)
	}
}

func TestValidateStateForRoom_CurrentPlayerNotConnected(t *testing.T) {
	s := baseState()
	alpha := "Alpha"
	bravo := "Bravo"
	slots := []SlotInfo{
		{Name: &alpha, Connected: true, IsBot: false},
		{Name: &bravo, Connected: false, IsBot: false},
	}
	v := ValidateStateForRoom(s, slots)
	if v.Kind != ValidationKindError {
		t.Fatalf("expected error, got: %s", v.Kind)
	}
}

func TestValidateStateForRoom_CurrentPlayerIsBotSlot(t *testing.T) {
	s := baseState()
	alpha := "Alpha"
	bravo := "Bravo"
	slots := []SlotInfo{
		{Name: &alpha, Connected: true, IsBot: false},
		{Name: &bravo, Connected: false, IsBot: true},
	}
	v := ValidateStateForRoom(s, slots)
	if v.Kind != ValidationKindOk {
		t.Fatalf("expected ok, got: %s - %s", v.Kind, v.Message)
	}
}
