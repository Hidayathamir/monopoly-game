package gameusecase

import (
	"testing"

	"monopoly-game-backend/internal/entity"
)

func intPtr(v int) *int       { return &v }
func strPtr(v string) *string { return &v }

func makeSpace(overrides ...func(*entity.Space)) entity.Space {
	s := entity.Space{
		ID:        1,
		Type:      entity.SpaceTypeProperty,
		Price:     intPtr(60000),
		Rent:      []int{2000, 4000, 10000, 30000, 90000, 160000, 250000, 450000},
		HouseCost: []int{50000},
		Color:     strPtr("#8B4513"),
		Owner:     nil,
		Houses:    0,
		Mortgaged: false,
	}
	for _, fn := range overrides {
		fn(&s)
	}
	return s
}

func TestCalculatePropertyRent_BaseRent0Houses(t *testing.T) {
	s := makeSpace(func(s *entity.Space) { s.Houses = 0 })
	got := CalculatePropertyRent(s, nil)
	if got != 2000 {
		t.Errorf("expected 2000, got %d", got)
	}
}

func TestCalculatePropertyRent_1House(t *testing.T) {
	s := makeSpace(func(s *entity.Space) { s.Houses = 1 })
	got := CalculatePropertyRent(s, nil)
	if got != 4000 {
		t.Errorf("expected 4000, got %d", got)
	}
}

func TestCalculatePropertyRent_4Houses(t *testing.T) {
	s := makeSpace(func(s *entity.Space) { s.Houses = 4 })
	got := CalculatePropertyRent(s, nil)
	if got != 90000 {
		t.Errorf("expected 90000, got %d", got)
	}
}

func TestCalculatePropertyRent_5Houses(t *testing.T) {
	s := makeSpace(func(s *entity.Space) { s.Houses = 5 })
	got := CalculatePropertyRent(s, nil)
	if got != 450000 {
		t.Errorf("expected 450000 (MAX_HOUSES maps to rent.length-1), got %d", got)
	}
}

func TestCalculatePropertyRent_HotelLastRent(t *testing.T) {
	s := makeSpace(func(s *entity.Space) {
		s.Houses = 5
		s.Rent = []int{50000, 200000, 600000, 1400000, 1700000, 2000000, 2200000, 2000000}
	})
	got := CalculatePropertyRent(s, nil)
	if got != 2000000 {
		t.Errorf("expected 2000000, got %d", got)
	}
}

func TestCalculatePropertyRent_MaxHouses_MapsToLastRent(t *testing.T) {
	s := makeSpace(func(s *entity.Space) {
		s.Houses = 5
		s.Rent = []int{1000, 2000, 3000, 4000, 5000, 6000, 7000}
	})
	got := CalculatePropertyRent(s, nil)
	if got != 7000 {
		t.Errorf("expected 7000 (MAX_HOUSES maps to last rent), got %d", got)
	}
}

func TestCalculatePropertyRent_MissingRentArray(t *testing.T) {
	s := makeSpace(func(s *entity.Space) {
		s.Type = entity.SpaceTypeGo
		s.Rent = nil
	})
	got := CalculatePropertyRent(s, nil)
	if got != 0 {
		t.Errorf("expected 0, got %d", got)
	}
}

func TestCalculatePropertyRent_ClampsToLast(t *testing.T) {
	s := makeSpace(func(s *entity.Space) { s.Houses = 10 })
	got := CalculatePropertyRent(s, nil)
	if got != 450000 {
		t.Errorf("expected 450000, got %d", got)
	}
}

func TestCalculatePropertyRent_BoardwalkHotel(t *testing.T) {
	s := makeSpace(func(s *entity.Space) {
		s.Price = intPtr(400000)
		s.Rent = []int{50000, 200000, 600000, 1400000, 1700000, 2000000, 2200000, 2000000}
		s.HouseCost = []int{200000}
		s.Houses = 5
	})
	got := CalculatePropertyRent(s, nil)
	if got != 2000000 {
		t.Errorf("expected 2000000, got %d", got)
	}
}

func TestRailroadRent(t *testing.T) {
	s := makeSpace(func(s *entity.Space) {
		s.Type = entity.SpaceTypeRailroad
		s.Rent = []int{25000, 50000, 100000, 200000}
		s.Price = intPtr(200000)
	})
	got := CalculatePropertyRent(s, nil)
	if got != 25000 {
		t.Errorf("expected 25000, got %d", got)
	}
}

func TestRailroadRent_WithCount(t *testing.T) {
	s := makeSpace(func(s *entity.Space) {
		s.Type = entity.SpaceTypeRailroad
		s.Rent = []int{25000, 50000, 100000, 200000}
		s.Price = intPtr(200000)
	})
	s = SetRailroadCount(s, 3)
	got := CalculatePropertyRent(s, nil)
	if got != 100000 {
		t.Errorf("expected 100000, got %d", got)
	}
}

func TestUtilityRent_1Utility(t *testing.T) {
	s := makeSpace(func(s *entity.Space) {
		s.Type = entity.SpaceTypeUtility
		s.Price = intPtr(150000)
		s.Rent = []int{0}
	})
	got := CalculatePropertyRent(s, &[2]int{3, 4})
	if got != 28 {
		t.Errorf("expected 28, got %d", got)
	}
}

func TestUtilityRent_2Utilities(t *testing.T) {
	s := makeSpace(func(s *entity.Space) {
		s.Type = entity.SpaceTypeUtility
		s.Price = intPtr(150000)
		s.Rent = []int{0}
		s.UtilityCount = 2
	})
	got := CalculatePropertyRent(s, &[2]int{3, 4})
	if got != 70 {
		t.Errorf("expected 70, got %d", got)
	}
}

func TestGetRailroadCount_Default(t *testing.T) {
	s := entity.Space{}
	got := GetRailroadCount(s)
	if got != 1 {
		t.Errorf("expected 1, got %d", got)
	}
}

func TestGetRailroadCount_Set(t *testing.T) {
	s := entity.Space{RailroadCount: 3}
	got := GetRailroadCount(s)
	if got != 3 {
		t.Errorf("expected 3, got %d", got)
	}
}

func TestSetRailroadCount(t *testing.T) {
	s := entity.Space{}
	s2 := SetRailroadCount(s, 2)
	if s2.RailroadCount != 2 {
		t.Errorf("expected 2, got %d", s2.RailroadCount)
	}
	if s.RailroadCount != 0 {
		t.Error("original should not be modified")
	}
}

func TestGetUtilityCount_Default(t *testing.T) {
	s := entity.Space{}
	got := GetUtilityCount(s)
	if got != 1 {
		t.Errorf("expected 1, got %d", got)
	}
}

func TestCalculateRailroadRentFromBoard_NegativeSpaceID(t *testing.T) {
	got := CalculateRailroadRentFromBoard(0, []entity.Space{}, -1)
	if got != 25 {
		t.Errorf("expected 25 (fallback), got %d", got)
	}
}

func TestCalculateRailroadRentFromBoard_OutOfBoundsSpaceID(t *testing.T) {
	got := CalculateRailroadRentFromBoard(0, []entity.Space{}, 99)
	if got != 25 {
		t.Errorf("expected 25 (fallback), got %d", got)
	}
}

func TestCalculateRailroadRentFromBoard(t *testing.T) {
	owner := 0
	board := []entity.Space{
		{ID: 0, Type: entity.SpaceTypeRailroad, Owner: &owner, Rent: []int{25000, 50000, 100000, 200000}},
		{ID: 1, Type: entity.SpaceTypeRailroad, Owner: &owner, Rent: []int{25000, 50000, 100000, 200000}},
		{ID: 2, Type: entity.SpaceTypeRailroad, Owner: nil, Rent: []int{25000, 50000, 100000, 200000}},
	}
	got := CalculateRailroadRentFromBoard(0, board, 0)
	if got != 50000 {
		t.Errorf("expected 50000 (2 railroads), got %d", got)
	}
}

func TestCalculateUtilityRentFromBoard_1(t *testing.T) {
	owner := 0
	board := []entity.Space{
		{ID: 0, Type: entity.SpaceTypeUtility, Owner: &owner},
		{ID: 1, Type: entity.SpaceTypeUtility, Owner: nil},
	}
	got := CalculateUtilityRentFromBoard(0, board, 0, [2]int{5, 5})
	if got != 40 {
		t.Errorf("expected 40 (1 utility), got %d", got)
	}
}

func TestCalculateUtilityRentFromBoard_2(t *testing.T) {
	owner := 0
	board := []entity.Space{
		{ID: 0, Type: entity.SpaceTypeUtility, Owner: &owner},
		{ID: 1, Type: entity.SpaceTypeUtility, Owner: &owner},
	}
	got := CalculateUtilityRentFromBoard(0, board, 0, [2]int{5, 5})
	if got != 100 {
		t.Errorf("expected 100 (2 utilities), got %d", got)
	}
}

func TestIsMonopoly_AllOwned(t *testing.T) {
	owner := 0
	board := []entity.Space{
		{ID: 0, Type: entity.SpaceTypeProperty, Color: strPtr("#8B4513"), Owner: &owner},
		{ID: 1, Type: entity.SpaceTypeProperty, Color: strPtr("#8B4513"), Owner: &owner},
	}
	if !IsMonopoly(0, board, board[0]) {
		t.Error("expected monopoly")
	}
}

func TestIsMonopoly_SplitOwnership(t *testing.T) {
	owner0 := 0
	owner1 := 1
	board := []entity.Space{
		{ID: 0, Type: entity.SpaceTypeProperty, Color: strPtr("#8B4513"), Owner: &owner0},
		{ID: 1, Type: entity.SpaceTypeProperty, Color: strPtr("#8B4513"), Owner: &owner1},
	}
	if IsMonopoly(0, board, board[0]) {
		t.Error("expected not monopoly")
	}
}

func TestIsMonopoly_NonProperty(t *testing.T) {
	s := entity.Space{Type: entity.SpaceTypeRailroad}
	board := []entity.Space{s}
	if IsMonopoly(0, board, s) {
		t.Error("expected false for non-property")
	}
}

func TestIsMonopoly_NoColor(t *testing.T) {
	s := entity.Space{Type: entity.SpaceTypeProperty, Color: nil}
	board := []entity.Space{s}
	if IsMonopoly(0, board, s) {
		t.Error("expected false for nil color")
	}
}

func TestCalculatePlayerTotalAssets(t *testing.T) {
	owner := 0
	price := 60000
	board := []entity.Space{
		{ID: 0, Type: entity.SpaceTypeProperty, Price: &price, Color: strPtr("#8B4513"), Owner: &owner, Houses: 1, HouseCost: []int{50000}},
	}
	player := entity.Player{Money: 1000, Properties: []int{0}}
	got := CalculatePlayerTotalAssets(player, board)
	// 1000 + 60000/2 + 50000 = 1000 + 30000 + 50000 = 81000
	if got != 81000 {
		t.Errorf("expected 81000, got %d", got)
	}
}

func TestCalculatePlayerTotalAssets_SkipsMortgaged(t *testing.T) {
	owner := 0
	price := 60000
	board := []entity.Space{
		{ID: 0, Type: entity.SpaceTypeProperty, Price: &price, Color: strPtr("#8B4513"), Owner: &owner, Mortgaged: true},
	}
	player := entity.Player{Money: 1000, Properties: []int{0}}
	got := CalculatePlayerTotalAssets(player, board)
	if got != 1000 {
		t.Errorf("expected 1000 (mortgaged skipped), got %d", got)
	}
}

func TestCalculatePlayerNetWorth(t *testing.T) {
	owner := 0
	price := 60000
	board := []entity.Space{
		{ID: 0, Type: entity.SpaceTypeProperty, Price: &price, Color: strPtr("#8B4513"), Owner: &owner, Houses: 2, HouseCost: []int{50000, 50000}},
	}
	player := entity.Player{Money: 1000, Properties: []int{0}}
	got := CalculatePlayerNetWorth(player, board)
	// 1000 + 60000 + 100000 (2 * 50000) = 161000
	if got != 161000 {
		t.Errorf("expected 161000, got %d", got)
	}
}

func TestCalculatePlayerNetWorth_OutOfBounds(t *testing.T) {
	player := entity.Player{Money: 500, Properties: []int{99}}
	board := []entity.Space{}
	got := CalculatePlayerNetWorth(player, board)
	if got != 500 {
		t.Errorf("expected 500 (out of bounds skipped), got %d", got)
	}
}

func TestCalculatePlayerTotalAssets_OutOfBounds(t *testing.T) {
	player := entity.Player{Money: 500, Properties: []int{99}}
	board := []entity.Space{}
	got := CalculatePlayerTotalAssets(player, board)
	if got != 500 {
		t.Errorf("expected 500, got %d", got)
	}
}
