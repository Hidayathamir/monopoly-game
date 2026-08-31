package data

import (
	"os"
	"testing"

	canonicaldata "monopoly-game-backend/data"
)

func TestLoadersUseCanonicalBoardData(t *testing.T) {
	if string(boardDataJSON) != string(canonicaldata.BoardDataJSON()) {
		t.Fatal("board loader is not using canonical board data")
	}
	if _, err := os.Stat("board-data.json"); !os.IsNotExist(err) {
		t.Fatalf("legacy internal board data asset still exists: %v", err)
	}
}

func TestCreateInitialBoard(t *testing.T) {
	board := CreateInitialBoard()
	if len(board) != BoardSize {
		t.Fatalf("expected %d spaces, got %d", BoardSize, len(board))
	}
}

func TestSpaceTypes(t *testing.T) {
	board := CreateInitialBoard()
	tests := []struct {
		id       int
		expected string
	}{
		{0, "go"},
		{10, "jail"},
		{20, "freeParking"},
		{30, "goToJail"},
	}
	for _, tt := range tests {
		if board[tt.id].Type != tt.expected {
			t.Errorf("space %d: expected type %q, got %q", tt.id, tt.expected, board[tt.id].Type)
		}
	}
}

func TestInitialSpaceDefaults(t *testing.T) {
	board := CreateInitialBoard()
	for _, s := range board {
		if s.Owner != nil {
			t.Errorf("space %d: owner should be nil", s.ID)
		}
		if s.Houses != 0 {
			t.Errorf("space %d: houses should be 0", s.ID)
		}
		if s.Mortgaged {
			t.Errorf("space %d: mortgaged should be false", s.ID)
		}
	}
}

func TestConstants(t *testing.T) {
	if GoSalary != 200 {
		t.Errorf("GoSalary: expected 200, got %d", GoSalary)
	}
	if JailFine != 50 {
		t.Errorf("JailFine: expected 50, got %d", JailFine)
	}
	if JailSpace != 10 {
		t.Errorf("JailSpace: expected 10, got %d", JailSpace)
	}
	if StartingMoney != 1500 {
		t.Errorf("StartingMoney: expected 1500, got %d", StartingMoney)
	}
	if MaxJailTurns != 3 {
		t.Errorf("MaxJailTurns: expected 3, got %d", MaxJailTurns)
	}
	if BoardSize != 40 {
		t.Errorf("BoardSize: expected 40, got %d", BoardSize)
	}
	if MaxHouses != 5 {
		t.Errorf("MaxHouses: expected 5, got %d", MaxHouses)
	}
}

func TestFloatConstants(t *testing.T) {
	if IncomeTaxRate != 0.1 {
		t.Errorf("IncomeTaxRate: expected 0.1, got %f", IncomeTaxRate)
	}
	if SellRate != 0.75 {
		t.Errorf("SellRate: expected 0.75, got %f", SellRate)
	}
	if MortgagedSellExtra != 0.1 {
		t.Errorf("MortgagedSellExtra: expected 0.1, got %f", MortgagedSellExtra)
	}
	if HouseSellRate != 0.75 {
		t.Errorf("HouseSellRate: expected 0.75, got %f", HouseSellRate)
	}
}

func TestGetHouseCost(t *testing.T) {
	board := CreateInitialBoard()
	space := board[1]

	if got := GetHouseCost(space, 0); got != 25 {
		t.Errorf("GetHouseCost(space 1, 0): expected 25, got %d", got)
	}
	if got := GetHouseCost(space, 4); got != 150 {
		t.Errorf("GetHouseCost(space 1, 4): expected 150, got %d", got)
	}
	if got := GetHouseCost(space, -1); got != 0 {
		t.Errorf("GetHouseCost(space 1, -1): expected 0, got %d", got)
	}
	if got := GetHouseCost(space, 5); got != 0 {
		t.Errorf("GetHouseCost(space 1, 5): expected 0, got %d", got)
	}
}

func TestGetTotalHouseInvestment(t *testing.T) {
	board := CreateInitialBoard()
	space := board[1]

	if got := GetTotalHouseInvestment(space); got != 0 {
		t.Errorf("total investment with 0 houses: expected 0, got %d", got)
	}

	space.Houses = 2
	if got := GetTotalHouseInvestment(space); got != 75 {
		t.Errorf("total investment with 2 houses: expected 75, got %d", got)
	}

	space.Houses = 5
	if got := GetTotalHouseInvestment(space); got != 400 {
		t.Errorf("total investment with 5 houses: expected 400, got %d", got)
	}
}

func TestGetTotalHouseInvestmentNoHouseCost(t *testing.T) {
	board := CreateInitialBoard()
	space := board[5]
	if got := GetTotalHouseInvestment(space); got != 0 {
		t.Errorf("total investment for railroad: expected 0, got %d", got)
	}
}
