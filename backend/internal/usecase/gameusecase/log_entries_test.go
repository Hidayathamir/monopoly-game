package gameusecase

import (
	"testing"

	"monopoly-game-backend/internal/entity"
)

func TestActorEntry_Basic(t *testing.T) {
	player := entity.Player{Name: "Alice"}
	entry := ActorEntry(entity.LogEventKeyRolled, player, nil)

	if entry.Key != entity.LogEventKeyRolled {
		t.Errorf("expected key %q, got %q", entity.LogEventKeyRolled, entry.Key)
	}
	if entry.Params["name"] != "Alice" {
		t.Errorf("expected name Alice, got %v", entry.Params["name"])
	}
	if _, ok := entry.Params[entity.LogParamKeyBot]; ok {
		t.Error("bot param should not be set for non-bot player")
	}
}

func TestActorEntry_BotPlayer(t *testing.T) {
	player := entity.Player{Name: "Bot1", BotControlled: true}
	entry := ActorEntry(entity.LogEventKeyPaidRent, player, nil)

	if entry.Params[entity.LogParamKeyBot] != true {
		t.Error("bot param should be true for bot-controlled player")
	}
}

func TestActorEntry_ExtraParams(t *testing.T) {
	player := entity.Player{Name: "Bob"}
	extra := map[string]interface{}{
		entity.LogParamKeyAmount:  50,
		entity.LogParamKeySpaceId: 7,
	}
	entry := ActorEntry(entity.LogEventKeyBuiltHouse, player, extra)

	if entry.Params[entity.LogParamKeyAmount] != 50 {
		t.Errorf("expected amount 50, got %v", entry.Params[entity.LogParamKeyAmount])
	}
	if entry.Params[entity.LogParamKeySpaceId] != 7 {
		t.Errorf("expected spaceId 7, got %v", entry.Params[entity.LogParamKeySpaceId])
	}
}

func TestActorEntry_BotWithExtra(t *testing.T) {
	player := entity.Player{Name: "Bot2", BotControlled: true}
	extra := map[string]interface{}{entity.LogParamKeyAmount: 100}
	entry := ActorEntry(entity.LogEventKeyCardCollect, player, extra)

	if entry.Params[entity.LogParamKeyBot] != true {
		t.Error("bot param should be set")
	}
	if entry.Params[entity.LogParamKeyAmount] != 100 {
		t.Error("extra params should be merged")
	}
}

func TestTurnEntry_NormalPlayer(t *testing.T) {
	players := []entity.Player{
		{Name: "Alice"},
		{Name: "Bob", BotControlled: true},
	}
	entry := TurnEntry(players, 0)

	if entry.Key != entity.LogEventKeyTurn {
		t.Errorf("expected key %q, got %q", entity.LogEventKeyTurn, entry.Key)
	}
	if entry.Params["name"] != "Alice" {
		t.Errorf("expected name Alice, got %v", entry.Params["name"])
	}
	if _, ok := entry.Params[entity.LogParamKeyBot]; ok {
		t.Error("bot param should not be set for non-bot player")
	}
}

func TestTurnEntry_BotPlayer(t *testing.T) {
	players := []entity.Player{
		{Name: "Alice"},
		{Name: "Bot1", BotControlled: true},
	}
	entry := TurnEntry(players, 1)

	if entry.Params["name"] != "Bot1" {
		t.Errorf("expected name Bot1, got %v", entry.Params["name"])
	}
	if entry.Params[entity.LogParamKeyBot] != true {
		t.Error("bot param should be true for bot-controlled player")
	}
}
