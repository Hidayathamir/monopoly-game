package botusecase

import (
	"testing"

	"monopoly-game-backend/internal/data"
	"monopoly-game-backend/internal/entity"
)

func testPlayer(overrides func(*entity.Player)) entity.Player {
	player := entity.Player{ID: 0, Name: "Bot", Money: data.StartingMoney, PassedGo: true, IsBot: true}
	if overrides != nil {
		overrides(&player)
	}
	return player
}

func testState(player entity.Player, overrides func(*entity.GameState)) entity.GameState {
	state := entity.GameState{Phase: entity.GamePhaseWaiting, Players: []entity.Player{player}, CurrentPlayer: 0, TurnOrder: []int{0}, Board: data.CreateInitialBoard(), EventLog: []entity.LogEntry{}, Dice: nil}
	if overrides != nil {
		overrides(&state)
	}
	return state
}

func testPending(state *entity.GameState, action entity.PendingAction) { state.PendingAction = &action }

func testActionType(action entity.GameAction) entity.GameActionType {
	switch value := action.(type) {
	case entity.RollDiceAction:
		return value.Type
	case entity.UseGetOutOfJailFreeAction:
		return value.Type
	case entity.PayJailFineAction:
		return value.Type
	case entity.BuyPropertyAction:
		return value.Type
	case entity.DeclineBuyAction:
		return value.Type
	case entity.PayRentAction:
		return value.Type
	case entity.DrawCardAction:
		return value.Type
	case entity.ResolveCardAction:
		return value.Type
	case entity.EndTurnAction:
		return value.Type
	case entity.DeclareBankruptcyAction:
		return value.Type
	case entity.BuildHouseAction:
		return value.Type
	case entity.SellHouseAction:
		return value.Type
	case entity.MortgageAction:
		return value.Type
	}
	return ""
}

func TestDecideBotActionBasicFlow(t *testing.T) {
	state := testState(testPlayer(nil), nil)
	if got := DecideBotAction(state); testActionType(got) != entity.GameActionTypeRollDice {
		t.Fatalf("expected roll, got %#v", got)
	}
	state.Players[0].InJail = true
	state.Players[0].GetOutOfJailFreeCards = 1
	if got := DecideBotAction(state); testActionType(got) != entity.GameActionTypeUseGetOutOfJailFree {
		t.Fatalf("expected jail card, got %#v", got)
	}
	state.Players[0].GetOutOfJailFreeCards = 0
	state.Players[0].Money = data.JailFine
	if got := DecideBotAction(state); testActionType(got) != entity.GameActionTypePayJailFine {
		t.Fatalf("expected jail fine, got %#v", got)
	}
	state.Players[0].Money = 0
	if got := DecideBotAction(state); testActionType(got) != entity.GameActionTypeRollDice {
		t.Fatalf("expected jail roll, got %#v", got)
	}
}

func TestDecideBotActionPendingAndLiquidation(t *testing.T) {
	board := data.CreateInitialBoard()
	space := board[1]
	owner := 0
	space.Owner = &owner
	space.Houses = 1
	board[1] = space
	state := testState(testPlayer(func(player *entity.Player) { player.Money = 0; player.Properties = []int{1} }), func(state *entity.GameState) { state.Board = board })
	testPending(&state, entity.PendingPayRentAction{Type: entity.PendingActionTypePayRent, Amount: data.StartingMoney, SpaceID: 1})
	if got := DecideBotAction(state); testActionType(got) != entity.GameActionTypeSellHouse {
		t.Fatalf("expected sell house, got %#v", got)
	}
	space.Houses = 0
	space.Mortgaged = false
	board[1] = space
	state.Board = board
	if got := DecideBotAction(state); testActionType(got) != entity.GameActionTypeMortgage {
		t.Fatalf("expected mortgage, got %#v", got)
	}
	space.Mortgaged = true
	board[1] = space
	state.Board = board
	if got := DecideBotAction(state); testActionType(got) != entity.GameActionTypeDeclareBankruptcy {
		t.Fatalf("expected bankruptcy, got %#v", got)
	}
}

func TestDecideBotActionBuildRules(t *testing.T) {
	board := data.CreateInitialBoard()
	owner := 0
	board[1].Owner = &owner
	state := testState(testPlayer(func(player *entity.Player) { player.Position = 1; player.Money = 100000; player.Properties = []int{1} }), func(state *entity.GameState) { state.Board = board; state.Dice = &[2]int{3, 4} })
	if got := DecideBotAction(state); got == nil || testActionType(got) != entity.GameActionTypeBuildHouse {
		t.Fatalf("expected build, got %#v", got)
	}
	state.BuiltThisStop = true
	if got := DecideBotAction(state); testActionType(got) != entity.GameActionTypeEndTurn {
		t.Fatalf("expected end turn, got %#v", got)
	}
	state.JustBoughtSpaceID = &state.Players[0].Position
	state.BuiltThisStop = false
	if got := DecideBotAction(state); testActionType(got) != entity.GameActionTypeEndTurn {
		t.Fatalf("expected end turn after purchase, got %#v", got)
	}
}

func TestDecideBotActionIgnoresHumanAndGameOver(t *testing.T) {
	state := testState(testPlayer(func(player *entity.Player) { player.IsBot = false }), nil)
	if DecideBotAction(state) != nil {
		t.Fatal("human player should not be driven")
	}
	state.Players[0].IsBot = true
	state.Phase = entity.GamePhaseGameOver
	if DecideBotAction(state) != nil {
		t.Fatal("game over should not be driven")
	}
}

func tradeState(t *testing.T) entity.GameState {
	t.Helper()
	state := testState(testPlayer(nil), nil)
	state.Players = []entity.Player{{ID: 0, Money: data.StartingMoney}, {ID: 1, Money: data.StartingMoney, IsBot: true}}
	state.CurrentPlayer = 1
	return state
}

func TestShouldAcceptTrade(t *testing.T) {
	state := tradeState(t)
	if !ShouldAcceptTrade(state, entity.TradeOffer{ToID: 1, OfferCash: 100, RequestProperties: []int{1}}) {
		t.Fatal("expected clear surplus to be accepted")
	}
	if ShouldAcceptTrade(state, entity.TradeOffer{ToID: 1, OfferCash: 40, RequestProperties: []int{1}}) {
		t.Fatal("expected insufficient cash offer to be rejected")
	}
	if ShouldAcceptTrade(state, entity.TradeOffer{ToID: 1, OfferProperties: []int{1}, RequestProperties: []int{3}}) {
		t.Fatal("expected break-even trade to be rejected")
	}
}

func TestShouldAcceptTradeValuesDevelopmentAndReserve(t *testing.T) {
	state := tradeState(t)
	owner := 0
	state.Board[1].Owner = &owner
	state.Board[1].Houses = 3
	owner = 1
	state.Board[6].Owner = &owner
	if !ShouldAcceptTrade(state, entity.TradeOffer{ToID: 1, OfferProperties: []int{1}, RequestProperties: []int{6}}) {
		t.Fatal("developed property should be valued above bare property")
	}
	state.Players[1].Money = 50
	if ShouldAcceptTrade(state, entity.TradeOffer{ToID: 1, OfferProperties: []int{6}, RequestProperties: []int{1}}) {
		t.Fatal("low cash should require a twofold surplus")
	}
}

func TestDecideBotActionBotControlledHumanAndBuyPrompt(t *testing.T) {
	state := testState(testPlayer(func(player *entity.Player) { player.IsBot = false; player.BotControlled = true }), nil)
	if got := DecideBotAction(state); testActionType(got) != entity.GameActionTypeRollDice {
		t.Fatalf("bot-controlled human should roll, got %#v", got)
	}
	property := 1
	testPending(&state, entity.PendingBuyPropertyAction{Type: entity.PendingActionTypeBuyProperty, SpaceID: property})
	if got := DecideBotAction(state); testActionType(got) != entity.GameActionTypeBuyProperty {
		t.Fatalf("bot-controlled human should buy affordable property, got %#v", got)
	}
	state.Players[0].Money = 0
	if got := DecideBotAction(state); testActionType(got) != entity.GameActionTypeDeclineBuy {
		t.Fatalf("bot-controlled human should decline unaffordable property, got %#v", got)
	}
}

func colorGroupForTest(board []entity.Space) []entity.Space {
	for _, space := range board {
		if space.Type != entity.SpaceTypeProperty || space.Color == nil {
			continue
		}
		group := make([]entity.Space, 0)
		for _, candidate := range board {
			if candidate.Type == entity.SpaceTypeProperty && candidate.Color != nil && *candidate.Color == *space.Color {
				group = append(group, candidate)
			}
		}
		return group
	}
	return nil
}

func scarceBuildBoard(targetID int, unowned int) []entity.Space {
	board := data.CreateInitialBoard()
	buyable := make([]int, 0)
	for _, space := range board {
		if space.Type == entity.SpaceTypeProperty || space.Type == entity.SpaceTypeRailroad || space.Type == entity.SpaceTypeUtility {
			buyable = append(buyable, space.ID)
		}
	}
	owned := len(buyable) - unowned
	count := 0
	for _, id := range buyable {
		owner := 1
		if id == targetID {
			owner = 0
		} else if count >= owned {
			board[id].Owner = nil
			continue
		}
		board[id].Owner = &owner
		count++
	}
	return board
}

func TestDecideBotActionScarceLandRepeatedBuildsAndReserve(t *testing.T) {
	board := data.CreateInitialBoard()
	group := colorGroupForTest(board)
	if len(group) == 0 {
		t.Fatal("expected a property color group")
	}
	target := group[0]
	board = scarceBuildBoard(target.ID, 6)
	owner := 0
	board[target.ID].Owner = &owner
	state := testState(testPlayer(func(player *entity.Player) {
		player.Position = target.ID
		player.Properties = []int{target.ID}
		player.Money = 100000
	}), func(state *entity.GameState) {
		state.Board = board
		state.Dice = &[2]int{3, 4}
		state.BuiltThisStop = true
	})

	builds := 0
	for {
		action := DecideBotAction(state)
		build, ok := action.(entity.BuildHouseAction)
		if !ok {
			if testActionType(action) != entity.GameActionTypeEndTurn {
				t.Fatalf("expected build or end turn after %d builds, got %#v", builds, action)
			}
			break
		}
		if build.SpaceID != target.ID {
			t.Fatalf("build targeted space %d, want %d", build.SpaceID, target.ID)
		}
		cost := data.GetHouseCost(state.Board[target.ID], state.Board[target.ID].Houses)
		state.Board[target.ID].Houses++
		state.Players[0].Money -= cost
		builds++
		if builds > data.MaxHouses {
			t.Fatal("bot built beyond maximum houses")
		}
	}
	if builds != data.MaxHouses || state.Board[target.ID].Houses != data.MaxHouses {
		t.Fatalf("expected %d repeated builds, got %d", data.MaxHouses, builds)
	}

	cost := data.GetHouseCost(board[target.ID], 0)
	state.Board[target.ID].Houses = 0
	state.Players[0].Money = BUILD_CASH_RESERVE + cost
	state.BuiltThisStop = false
	first := DecideBotAction(state)
	if testActionType(first) != entity.GameActionTypeBuildHouse {
		t.Fatalf("expected reserve-bound build, got %#v", first)
	}
	state.Players[0].Money -= cost
	state.Board[target.ID].Houses = 1
	if state.Players[0].Money != BUILD_CASH_RESERVE {
		t.Fatalf("expected cash reserve %d, got %d", BUILD_CASH_RESERVE, state.Players[0].Money)
	}
	if got := DecideBotAction(state); testActionType(got) != entity.GameActionTypeEndTurn {
		t.Fatalf("expected end turn at cash reserve, got %#v", got)
	}
}

func TestShouldAcceptTradeMonopolyBonusAndPenalty(t *testing.T) {
	state := tradeState(t)
	brown := "brown"
	state.Board[1].Color = &brown
	state.Board[3].Color = &brown
	owner := 0
	state.Board[1].Owner = &owner
	state.Board[3].Owner = &owner
	if !ShouldAcceptTrade(state, entity.TradeOffer{ToID: 1, OfferProperties: []int{3}, RequestCash: 50}) {
		t.Fatal("expected monopoly gain bonus to affect valuation")
	}
	owner = 1
	state.Board[1].Owner = &owner
	state.Board[3].Owner = &owner
	if ShouldAcceptTrade(state, entity.TradeOffer{ToID: 1, RequestProperties: []int{1}, OfferCash: 100}) {
		t.Fatal("expected monopoly loss penalty to affect valuation")
	}
}

func TestShouldAcceptTradeDetailedValueMatrix(t *testing.T) {
	breakEven := tradeState(t)
	breakEven.Board[6].Owner = &[]int{0}[0]
	breakEven.Board[8].Owner = &[]int{1}[0]
	if ShouldAcceptTrade(breakEven, entity.TradeOffer{ToID: 1, OfferProperties: []int{6}, RequestProperties: []int{8}}) {
		t.Fatal("equal-value swap should be rejected")
	}

	tests := []struct {
		name  string
		setup func(entity.GameState) entity.GameState
		offer entity.TradeOffer
		want  bool
	}{
		{
			name: "break even rejects and eleven percent surplus accepts",
			setup: func(state entity.GameState) entity.GameState {
				first, second := 6, 8
				state.Board[first].Owner = &[]int{0}[0]
				state.Board[second].Owner = &[]int{1}[0]
				return state
			},
			offer: entity.TradeOffer{ToID: 1, OfferProperties: []int{6}, RequestProperties: []int{8}, OfferCash: 11},
			want:  true,
		},
		{
			name: "railroad valued at price",
			setup: func(state entity.GameState) entity.GameState {
				first, second := 5, 6
				state.Board[first].Owner = &[]int{0}[0]
				state.Board[second].Owner = &[]int{1}[0]
				return state
			},
			offer: entity.TradeOffer{ToID: 1, OfferProperties: []int{5}, RequestProperties: []int{6}},
			want:  true,
		},
		{
			name: "hotel uses two point five multiplier",
			setup: func(state entity.GameState) entity.GameState {
				state.Board[1].Owner = &[]int{0}[0]
				state.Board[1].Houses = 5
				state.Board[6].Owner = &[]int{1}[0]
				return state
			},
			offer: entity.TradeOffer{ToID: 1, OfferProperties: []int{1}, RequestProperties: []int{6}},
			want:  true,
		},
		{
			name: "low reserve rejects ordinary trade",
			setup: func(state entity.GameState) entity.GameState {
				state.Players[1].Money = BUILD_CASH_RESERVE - 1
				state.Board[6].Owner = &[]int{0}[0]
				state.Board[1].Owner = &[]int{1}[0]
				return state
			},
			offer: entity.TradeOffer{ToID: 1, OfferProperties: []int{6}, RequestProperties: []int{1}},
			want:  false,
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			state := test.setup(tradeState(t))
			if got := ShouldAcceptTrade(state, test.offer); got != test.want {
				t.Fatalf("ShouldAcceptTrade() = %v, want %v", got, test.want)
			}
		})
	}
}
