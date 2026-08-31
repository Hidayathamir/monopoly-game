package data

import (
	"encoding/json"
	"testing"
)

func TestCanonicalCardsData(t *testing.T) {
	var cards struct {
		Chance    []json.RawMessage `json:"chance"`
		Community []json.RawMessage `json:"community"`
	}
	if err := json.Unmarshal(CardsDataJSON(), &cards); err != nil {
		t.Fatalf("canonical cards data is invalid: %v", err)
	}
	if len(cards.Chance) != 16 {
		t.Fatalf("expected 16 chance cards, got %d", len(cards.Chance))
	}
	if len(cards.Community) != 16 {
		t.Fatalf("expected 16 community cards, got %d", len(cards.Community))
	}
}

func TestCanonicalBoardData(t *testing.T) {
	var board []json.RawMessage
	if err := json.Unmarshal(BoardDataJSON(), &board); err != nil {
		t.Fatalf("canonical board data is invalid: %v", err)
	}
	if len(board) != 40 {
		t.Fatalf("expected 40 board spaces, got %d", len(board))
	}
}
