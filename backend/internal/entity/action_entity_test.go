package entity

import "testing"

func TestActionEntityDeclarationsImplementGameAction(t *testing.T) {
	actions := []GameAction{
		StartGameAction{},
		RollDiceAction{},
		DiceAnimatedAction{},
		MoveTokenAction{},
		PassGoAction{},
		ResolveSpaceAction{},
		BuyPropertyAction{},
		DeclineBuyAction{},
		PayRentAction{},
		BuildHouseAction{},
		SellHouseAction{},
		MortgageAction{},
		UnmortgageAction{},
		SellPropertyAction{},
		ProposeTradeAction{},
		AcceptTradeAction{},
		RejectTradeAction{},
		CancelTradeAction{},
		DrawCardAction{},
		ResolveCardAction{},
		AttemptJailbreakAction{},
		EndTurnAction{},
		DeclareBankruptcyAction{},
		CollectFreeParkingAction{},
		SkipAction{},
		PayJailFineAction{},
		UseGetOutOfJailFreeAction{},
		SetBotControlAction{},
		SetReconnectGraceAction{},
	}
	if len(actions) != 29 {
		t.Fatalf("expected 29 action declarations, got %d", len(actions))
	}
}
