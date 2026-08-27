package gameusecase

import (
	"testing"

	"monopoly-game-backend/internal/data"
	"monopoly-game-backend/internal/entity"
)

func buildState(opts ...func(*entity.GameState)) entity.GameState {
	owner := 1
	state := entity.GameState{
		Players: []entity.Player{
			{ID: 0, Position: 0, Properties: []int{}, Money: data.StartingMoney},
			{ID: 1, Position: 1, Properties: []int{1}, Money: data.StartingMoney},
		},
		Board: []entity.Space{
			{ID: 0, Type: entity.SpaceTypeGo},
			{ID: 1, Type: entity.SpaceTypeProperty, Owner: &owner, Houses: 0, HouseCost: []int{50}, Color: strPtr("#8B4513")},
			{ID: 2, Type: entity.SpaceTypeChance},
			{ID: 3, Type: entity.SpaceTypeTax},
		},
		CurrentPlayer: 1,
		Dice:          &[2]int{3, 4},
	}
	for _, fn := range opts {
		fn(&state)
	}
	return state
}

func TestCanBuildOnCurrentSpace_NormalCase(t *testing.T) {
	state := buildState()
	if !CanBuildOnCurrentSpace(state) {
		t.Error("expected true for normal buildable case")
	}
}

func TestCanBuildOnCurrentSpace_RequiresCurrentProperty(t *testing.T) {
	state := buildState(func(s *entity.GameState) {
		s.Players[1].Position = 0
	})
	if CanBuildOnCurrentSpace(state) {
		t.Error("expected false when an eligible owned property is not the current space")
	}
}

func TestCanBuildOnCurrentSpace_NotPropertyType(t *testing.T) {
	state := buildState(func(s *entity.GameState) {
		s.Board[1].Type = entity.SpaceTypeChance
	})
	if CanBuildOnCurrentSpace(state) {
		t.Error("expected false for non-property type")
	}
}

func TestCanBuildOnCurrentSpace_NoDiceRolled(t *testing.T) {
	state := buildState(func(s *entity.GameState) {
		s.Dice = nil
	})
	if CanBuildOnCurrentSpace(state) {
		t.Error("expected false when dice not rolled")
	}
}

func TestCanBuildOnCurrentSpace_NotOwner(t *testing.T) {
	other := 0
	state := buildState(func(s *entity.GameState) {
		s.Board[1].Owner = &other
	})
	if CanBuildOnCurrentSpace(state) {
		t.Error("expected false when not owner")
	}
}

func TestCanBuildOnCurrentSpace_AlreadyMaxHouses(t *testing.T) {
	state := buildState(func(s *entity.GameState) {
		s.Board[1].Houses = data.MaxHouses
	})
	if CanBuildOnCurrentSpace(state) {
		t.Error("expected false when at max houses")
	}
}

func TestCanBuildOnCurrentSpace_Mortgaged(t *testing.T) {
	state := buildState(func(s *entity.GameState) {
		s.Board[1].Mortgaged = true
	})
	if CanBuildOnCurrentSpace(state) {
		t.Error("expected false when mortgaged")
	}
}

func TestCanBuildOnCurrentSpace_JustBoughtThisSpace(t *testing.T) {
	spaceID := 1
	state := buildState(func(s *entity.GameState) {
		s.JustBoughtSpaceID = &spaceID
	})
	if CanBuildOnCurrentSpace(state) {
		t.Error("expected false when just bought this space")
	}
}

func TestCanBuildOnCurrentSpace_JustBoughtDifferentSpace(t *testing.T) {
	spaceID := 99
	state := buildState(func(s *entity.GameState) {
		s.JustBoughtSpaceID = &spaceID
	})
	if !CanBuildOnCurrentSpace(state) {
		t.Error("expected true when just bought a different space")
	}
}

func TestCanBuildOnCurrentSpace_UnaffordableOffCurrentProperty(t *testing.T) {
	state := buildState(func(s *entity.GameState) {
		s.Players[1].Position = 0
		s.Players[1].Money = 0
	})
	if CanBuildOnCurrentSpace(state) {
		t.Error("expected false when an off-current property is unaffordable")
	}
}

func TestCanBuildOnCurrentSpace_NoPlayer(t *testing.T) {
	state := buildState(func(s *entity.GameState) {
		s.Players = []entity.Player{}
		s.CurrentPlayer = 0
	})
	if CanBuildOnCurrentSpace(state) {
		t.Error("expected false when no player")
	}
}

func TestCanBuildOnCurrentSpace_NoEligibleProperty(t *testing.T) {
	state := buildState(func(s *entity.GameState) {
		s.Players[1].Position = 99
		s.Board[1].Owner = nil
	})
	if CanBuildOnCurrentSpace(state) {
		t.Error("expected false when no eligible property exists")
	}
}
