package data

import (
	"os"
	"testing"

	canonicaldata "monopoly-game-backend/data"
	"monopoly-game-backend/internal/entity"
)

func TestLoaderUsesCanonicalCardsData(t *testing.T) {
	if string(cardsDataJSON) != string(canonicaldata.CardsDataJSON()) {
		t.Fatal("card loader is not using canonical card data")
	}
	if _, err := os.Stat("cards-data.json"); !os.IsNotExist(err) {
		t.Fatalf("legacy internal cards data asset still exists: %v", err)
	}
}

func TestChanceCardCount(t *testing.T) {
	if len(CHANCE_CARDS) != 16 {
		t.Fatalf("expected 16 chance cards, got %d", len(CHANCE_CARDS))
	}
}

func TestCommunityCardCount(t *testing.T) {
	if len(COMMUNITY_CARDS) != 16 {
		t.Fatalf("expected 16 community cards, got %d", len(COMMUNITY_CARDS))
	}
}

func TestChanceCardTypes(t *testing.T) {
	for _, card := range CHANCE_CARDS {
		if card.Type != entity.CardTypeChance {
			t.Errorf("card %d: expected type %q, got %q", card.ID, entity.CardTypeChance, card.Type)
		}
	}
}

func TestCommunityCardTypes(t *testing.T) {
	for _, card := range COMMUNITY_CARDS {
		if card.Type != entity.CardTypeCommunity {
			t.Errorf("card %d: expected type %q, got %q", card.ID, entity.CardTypeCommunity, card.Type)
		}
	}
}

func TestChanceCardIDs(t *testing.T) {
	expected := []int{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16}
	for i, card := range CHANCE_CARDS {
		if card.ID != expected[i] {
			t.Errorf("chance card index %d: expected ID %d, got %d", i, expected[i], card.ID)
		}
	}
}

func TestCommunityCardIDs(t *testing.T) {
	expected := []int{101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116}
	for i, card := range COMMUNITY_CARDS {
		if card.ID != expected[i] {
			t.Errorf("community card index %d: expected ID %d, got %d", i, expected[i], card.ID)
		}
	}
}

func TestChanceCardEffects(t *testing.T) {
	tests := []struct {
		index  int
		action string
	}{
		{0, "goToSpace"},
		{1, "goToSpace"},
		{2, "goToSpace"},
		{3, "goToSpace"},
		{4, "collect"},
		{5, "goToJail"},
		{6, "getOutOfJailFree"},
		{7, "streetRepairs"},
		{8, "collectFromPlayers"},
		{9, "goToSpace"},
		{10, "pay"},
		{11, "collect"},
		{12, "goToSpace"},
		{13, "goToSpace"},
		{14, "collect"},
		{15, "payToPlayers"},
	}
	for _, tt := range tests {
		eff := getAction(CHANCE_CARDS[tt.index].Effect)
		if eff != tt.action {
			t.Errorf("chance card %d: expected action %q, got %q", CHANCE_CARDS[tt.index].ID, tt.action, eff)
		}
	}
}

func TestCommunityCardEffects(t *testing.T) {
	tests := []struct {
		index  int
		action string
	}{
		{0, "collect"},
		{1, "pay"},
		{2, "pay"},
		{3, "getOutOfJailFree"},
		{4, "goToJail"},
		{5, "collect"},
		{6, "collect"},
		{7, "collect"},
		{8, "pay"},
		{9, "pay"},
		{10, "goToSpace"},
		{11, "collect"},
		{12, "collectFromPlayers"},
		{13, "collect"},
		{14, "collect"},
		{15, "streetRepairs"},
	}
	for _, tt := range tests {
		eff := getAction(COMMUNITY_CARDS[tt.index].Effect)
		if eff != tt.action {
			t.Errorf("community card %d: expected action %q, got %q", COMMUNITY_CARDS[tt.index].ID, tt.action, eff)
		}
	}
}

func getAction(e entity.CardEffect) string {
	switch v := e.(type) {
	case entity.CardEffectCollect:
		return v.Action
	case entity.CardEffectPay:
		return v.Action
	case entity.CardEffectGoToJail:
		return v.Action
	case entity.CardEffectGetOutOfJailFree:
		return v.Action
	case entity.CardEffectGoToSpace:
		return v.Action
	case entity.CardEffectCollectFromPlayers:
		return v.Action
	case entity.CardEffectPayToPlayers:
		return v.Action
	case entity.CardEffectStreetRepairs:
		return v.Action
	default:
		return "unknown"
	}
}

func TestSpecificEffectValues(t *testing.T) {
	// Chance card 1: goToSpace 0
	if eff, ok := CHANCE_CARDS[0].Effect.(entity.CardEffectGoToSpace); !ok {
		t.Errorf("chance card 1: expected CardEffectGoToSpace, got %T", CHANCE_CARDS[0].Effect)
	} else if eff.SpaceID != 0 {
		t.Errorf("chance card 1: expected SpaceID 0, got %d", eff.SpaceID)
	}

	// Chance card 5: collect 50
	if eff, ok := CHANCE_CARDS[4].Effect.(entity.CardEffectCollect); !ok {
		t.Errorf("chance card 5: expected CardEffectCollect, got %T", CHANCE_CARDS[4].Effect)
	} else if eff.Amount != 50 {
		t.Errorf("chance card 5: expected Amount 50, got %d", eff.Amount)
	}

	// Chance card 8: streetRepairs perHouse=25, perHotel=100
	if eff, ok := CHANCE_CARDS[7].Effect.(entity.CardEffectStreetRepairs); !ok {
		t.Errorf("chance card 8: expected CardEffectStreetRepairs, got %T", CHANCE_CARDS[7].Effect)
	} else {
		if eff.PerHouse != 25 {
			t.Errorf("chance card 8: expected PerHouse 25, got %d", eff.PerHouse)
		}
		if eff.PerHotel != 100 {
			t.Errorf("chance card 8: expected PerHotel 100, got %d", eff.PerHotel)
		}
	}

	// Chance card 9: collectFromPlayers 10
	if eff, ok := CHANCE_CARDS[8].Effect.(entity.CardEffectCollectFromPlayers); !ok {
		t.Errorf("chance card 9: expected CardEffectCollectFromPlayers, got %T", CHANCE_CARDS[8].Effect)
	} else if eff.Amount != 10 {
		t.Errorf("chance card 9: expected Amount 10, got %d", eff.Amount)
	}

	// Community card 1: collect 200
	if eff, ok := COMMUNITY_CARDS[0].Effect.(entity.CardEffectCollect); !ok {
		t.Errorf("community card 1: expected CardEffectCollect, got %T", COMMUNITY_CARDS[0].Effect)
	} else if eff.Amount != 200 {
		t.Errorf("community card 1: expected Amount 200, got %d", eff.Amount)
	}
}
