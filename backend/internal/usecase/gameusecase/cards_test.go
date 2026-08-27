package gameusecase

import (
	"testing"

	"monopoly-game-backend/internal/data"
	"monopoly-game-backend/internal/entity"
)

func cardTestState(opts ...func(*entity.GameState)) entity.GameState {
	state := entity.GameState{
		Phase: entity.GamePhaseWaiting,
		Players: []entity.Player{
			{ID: 0, Name: "Alice", Money: 500, Position: 0, Properties: []int{}},
			{ID: 1, Name: "Bob", Money: 500, Position: 0, Properties: []int{}},
		},
		CurrentPlayer:  0,
		Board:          data.CreateInitialBoard(),
		FreeParkingPot: 0,
		LastMoveSteps:  nil,
	}
	for _, fn := range opts {
		fn(&state)
	}
	return state
}

func TestResolveCardEffect_Collect(t *testing.T) {
	state := cardTestState()
	card := entity.Card{ID: 1, Type: entity.CardTypeChance, Effect: entity.CardEffectCollect{Action: entity.CardActionTypeCollect, Amount: 200}}
	result := ResolveCardEffect(state, card)
	if result.State.Players[0].Money != 700 {
		t.Errorf("expected 700, got %d", result.State.Players[0].Money)
	}
	if len(result.Log) != 1 || result.Log[0].Key != entity.LogEventKeyCardCollect {
		t.Errorf("unexpected log: %v", result.Log)
	}
}

func TestResolveCardEffect_Pay(t *testing.T) {
	state := cardTestState()
	card := entity.Card{ID: 101, Type: entity.CardTypeCommunity, Effect: entity.CardEffectPay{Action: entity.CardActionTypePay, Amount: 100}}
	result := ResolveCardEffect(state, card)
	if result.State.Players[0].Money != 400 {
		t.Errorf("expected 400, got %d", result.State.Players[0].Money)
	}
	if result.State.FreeParkingPot != 100 {
		t.Errorf("expected freeParkingPot 100, got %d", result.State.FreeParkingPot)
	}
	if len(result.Log) != 1 || result.Log[0].Key != entity.LogEventKeyCardPay {
		t.Errorf("unexpected log: %v", result.Log)
	}
}

func TestResolveCardEffect_GoToJail(t *testing.T) {
	state := cardTestState()
	card := entity.Card{ID: 6, Type: entity.CardTypeChance, Effect: entity.CardEffectGoToJail{Action: entity.CardActionTypeGoToJail}}
	result := ResolveCardEffect(state, card)
	if result.State.Players[0].Position != data.JailSpace {
		t.Errorf("expected position %d, got %d", data.JailSpace, result.State.Players[0].Position)
	}
	if !result.State.Players[0].InJail {
		t.Error("expected inJail true")
	}
	if len(result.Log) != 1 || result.Log[0].Key != entity.LogEventKeyCardToJail {
		t.Errorf("unexpected log: %v", result.Log)
	}
}

func TestResolveCardEffect_GetOutOfJailFree(t *testing.T) {
	state := cardTestState()
	card := entity.Card{ID: 7, Type: entity.CardTypeChance, Effect: entity.CardEffectGetOutOfJailFree{Action: entity.CardActionTypeGetOutOfJailFree}}
	result := ResolveCardEffect(state, card)
	if result.State.Players[0].GetOutOfJailFreeCards != 1 {
		t.Errorf("expected 1, got %d", result.State.Players[0].GetOutOfJailFreeCards)
	}
	if len(result.Log) != 1 || result.Log[0].Key != entity.LogEventKeyGotJailCard {
		t.Errorf("unexpected log: %v", result.Log)
	}
}

func TestResolveCardEffect_GetOutOfJailFree_Stacks(t *testing.T) {
	state := cardTestState()
	card := entity.Card{ID: 7, Type: entity.CardTypeChance, Effect: entity.CardEffectGetOutOfJailFree{Action: entity.CardActionTypeGetOutOfJailFree}}
	state = ResolveCardEffect(state, card).State
	state = ResolveCardEffect(state, card).State
	if state.Players[0].GetOutOfJailFreeCards != 2 {
		t.Errorf("expected 2, got %d", state.Players[0].GetOutOfJailFreeCards)
	}
}

func TestResolveCardEffect_GoToSpace_Forward(t *testing.T) {
	state := cardTestState(func(s *entity.GameState) {
		s.Players[0].Position = 35
	})
	card := entity.Card{ID: 2, Type: entity.CardTypeChance, Effect: entity.CardEffectGoToSpace{Action: entity.CardActionTypeGoToSpace, SpaceID: 5}}
	result := ResolveCardEffect(state, card)
	if result.State.Players[0].Position != 5 {
		t.Errorf("expected position 5, got %d", result.State.Players[0].Position)
	}
	if result.State.Players[0].Money != 500+data.GoSalary {
		t.Errorf("expected money %d, got %d", 500+data.GoSalary, result.State.Players[0].Money)
	}
	found := false
	for _, l := range result.Log {
		if l.Key == entity.LogEventKeyMovedForward {
			found = true
		}
	}
	if !found {
		t.Error("expected movedForward log entry")
	}
}

func TestResolveCardEffect_GoToSpace_Backward(t *testing.T) {
	state := cardTestState(func(s *entity.GameState) {
		s.Players[0].Position = 10
	})
	card := entity.Card{ID: 10, Type: entity.CardTypeChance, Effect: entity.CardEffectGoToSpace{Action: entity.CardActionTypeGoToSpace, SpaceID: -3}}
	result := ResolveCardEffect(state, card)
	if result.State.Players[0].Position != 7 {
		t.Errorf("expected position 7, got %d", result.State.Players[0].Position)
	}
	if result.State.Players[0].Money != 500 {
		t.Errorf("expected money 500 (no GO on backward), got %d", result.State.Players[0].Money)
	}
	found := false
	for _, l := range result.Log {
		if l.Key == entity.LogEventKeyMovedBack {
			found = true
		}
	}
	if !found {
		t.Error("expected movedBack log entry")
	}
}

func TestResolveCardEffect_GoToSpace_ForwardPassesGo(t *testing.T) {
	state := cardTestState(func(s *entity.GameState) {
		s.Players[0].Position = 7
		s.Players[0].PassedGo = false
	})
	card := entity.Card{ID: 4, Type: entity.CardTypeChance, Effect: entity.CardEffectGoToSpace{Action: entity.CardActionTypeGoToSpace, SpaceID: 5}}
	result := ResolveCardEffect(state, card)
	if !result.State.Players[0].PassedGo {
		t.Error("expected passedGo true")
	}
	if result.State.Players[0].Money != 500+data.GoSalary {
		t.Errorf("expected money %d, got %d", 500+data.GoSalary, result.State.Players[0].Money)
	}
	expectedSteps := (5 - 7 + data.BoardSize) % data.BoardSize
	if result.State.LastMoveSteps == nil || *result.State.LastMoveSteps != expectedSteps {
		t.Errorf("expected lastMoveSteps %d, got %v", expectedSteps, result.State.LastMoveSteps)
	}
}

func TestResolveCardEffect_GoToSpace_BackwardWraps(t *testing.T) {
	state := cardTestState(func(s *entity.GameState) {
		s.Players[0].Position = 2
		s.Players[0].PassedGo = false
	})
	card := entity.Card{ID: 10, Type: entity.CardTypeChance, Effect: entity.CardEffectGoToSpace{Action: entity.CardActionTypeGoToSpace, SpaceID: -3}}
	result := ResolveCardEffect(state, card)
	expectedPos := (2 + (-3) + data.BoardSize) % data.BoardSize
	if result.State.Players[0].Position != expectedPos {
		t.Errorf("expected position %d, got %d", expectedPos, result.State.Players[0].Position)
	}
	if result.State.LastMoveSteps == nil || *result.State.LastMoveSteps != -3 {
		t.Errorf("expected lastMoveSteps -3, got %v", result.State.LastMoveSteps)
	}
}

func TestResolveCardEffect_CollectFromPlayers(t *testing.T) {
	state := cardTestState()
	card := entity.Card{ID: 9, Type: entity.CardTypeChance, Effect: entity.CardEffectCollectFromPlayers{Action: entity.CardActionTypeCollectFromPlayers, Amount: 10}}
	result := ResolveCardEffect(state, card)
	if result.State.Players[0].Money != 510 {
		t.Errorf("expected 510, got %d", result.State.Players[0].Money)
	}
	if result.State.Players[1].Money != 490 {
		t.Errorf("expected 490, got %d", result.State.Players[1].Money)
	}
	if len(result.Log) != 1 || result.Log[0].Key != entity.LogEventKeyCardCollectPlayers {
		t.Errorf("unexpected log: %v", result.Log)
	}
}

func TestResolveCardEffect_CollectFromPlayers_InDebt(t *testing.T) {
	state := cardTestState(func(s *entity.GameState) {
		s.Players[1].Money = -5
	})
	card := entity.Card{ID: 9, Type: entity.CardTypeChance, Effect: entity.CardEffectCollectFromPlayers{Action: entity.CardActionTypeCollectFromPlayers, Amount: 10}}
	result := ResolveCardEffect(state, card)
	if result.State.Players[0].Money != 500 {
		t.Errorf("expected 500, got %d", result.State.Players[0].Money)
	}
	if result.State.Players[1].Money != -5 {
		t.Errorf("expected -5, got %d", result.State.Players[1].Money)
	}
}

func TestResolveCardEffect_CollectFromPlayers_PartialAfford(t *testing.T) {
	state := cardTestState(func(s *entity.GameState) {
		s.Players[1].Money = 4
	})
	card := entity.Card{ID: 9, Type: entity.CardTypeChance, Effect: entity.CardEffectCollectFromPlayers{Action: entity.CardActionTypeCollectFromPlayers, Amount: 10}}
	result := ResolveCardEffect(state, card)
	if result.State.Players[0].Money != 504 {
		t.Errorf("expected 504, got %d", result.State.Players[0].Money)
	}
	if result.State.Players[1].Money != 0 {
		t.Errorf("expected 0, got %d", result.State.Players[1].Money)
	}
}

func TestResolveCardEffect_PayToPlayers(t *testing.T) {
	state := cardTestState()
	card := entity.Card{ID: 11, Type: entity.CardTypeChance, Effect: entity.CardEffectPayToPlayers{Action: entity.CardActionTypePayToPlayers, Amount: 50}}
	result := ResolveCardEffect(state, card)
	if result.State.Players[0].Money != 450 {
		t.Errorf("expected 450, got %d", result.State.Players[0].Money)
	}
	if result.State.Players[1].Money != 550 {
		t.Errorf("expected 550, got %d", result.State.Players[1].Money)
	}
	if len(result.Log) != 1 || result.Log[0].Key != entity.LogEventKeyCardPayPlayers {
		t.Errorf("unexpected log: %v", result.Log)
	}
}

func TestResolveCardEffect_PayToPlayers_LimitedFunds(t *testing.T) {
	state := cardTestState(func(s *entity.GameState) {
		s.Players[0].Money = 30
	})
	card := entity.Card{ID: 11, Type: entity.CardTypeChance, Effect: entity.CardEffectPayToPlayers{Action: entity.CardActionTypePayToPlayers, Amount: 50}}
	result := ResolveCardEffect(state, card)
	if result.State.Players[0].Money != 0 {
		t.Errorf("expected 0, got %d", result.State.Players[0].Money)
	}
	if result.State.Players[1].Money != 530 {
		t.Errorf("expected 530, got %d", result.State.Players[1].Money)
	}
}

func TestResolveCardEffect_StreetRepairs(t *testing.T) {
	state := cardTestState(func(s *entity.GameState) {
		s.Players[0].Properties = []int{1}
		s.Board[1].Houses = 2
	})
	card := entity.Card{ID: 8, Type: entity.CardTypeChance, Effect: entity.CardEffectStreetRepairs{Action: entity.CardActionTypeStreetRepairs, PerHouse: 25, PerHotel: 100}}
	result := ResolveCardEffect(state, card)
	if result.State.Players[0].Money != 450 {
		t.Errorf("expected 450, got %d", result.State.Players[0].Money)
	}
	if result.State.FreeParkingPot != 50 {
		t.Errorf("expected freeParkingPot 50, got %d", result.State.FreeParkingPot)
	}
	if len(result.Log) != 1 || result.Log[0].Key != entity.LogEventKeyCardStreetRepairs {
		t.Errorf("unexpected log: %v", result.Log)
	}
}

func TestResolveCardEffect_StreetRepairs_WithHotel(t *testing.T) {
	state := cardTestState(func(s *entity.GameState) {
		s.Players[0].Properties = []int{1, 3}
		s.Board[1].Houses = data.MaxHouses
		s.Board[3].Houses = 2
	})
	card := entity.Card{ID: 8, Type: entity.CardTypeChance, Effect: entity.CardEffectStreetRepairs{Action: entity.CardActionTypeStreetRepairs, PerHouse: 25, PerHotel: 100}}
	result := ResolveCardEffect(state, card)
	if result.State.Players[0].Money != 350 {
		t.Errorf("expected 350, got %d", result.State.Players[0].Money)
	}
	if result.State.FreeParkingPot != 150 {
		t.Errorf("expected freeParkingPot 150, got %d", result.State.FreeParkingPot)
	}
}

func TestResolveCardEffect_Pay_MoneyGoesBelowZero(t *testing.T) {
	state := cardTestState(func(s *entity.GameState) {
		s.Players[0].Money = 30
	})
	card := entity.Card{ID: 101, Type: entity.CardTypeCommunity, Effect: entity.CardEffectPay{Action: entity.CardActionTypePay, Amount: 100}}
	result := ResolveCardEffect(state, card)
	if result.State.Players[0].Money != -70 {
		t.Errorf("expected -70, got %d", result.State.Players[0].Money)
	}
}
