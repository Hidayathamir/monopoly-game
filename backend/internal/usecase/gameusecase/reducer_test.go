package gameusecase

import (
	"monopoly-game-backend/internal/data"
	"monopoly-game-backend/internal/entity"
	"testing"
)

func startedState(t *testing.T) entity.GameState {
	t.Helper()
	s := GameReducer(CreateInitialState(), entity.StartGameAction{Type: entity.GameActionTypeStartGame, PlayerCount: 2, Names: []string{"Alice", "Bob"}})
	s.TurnOrder = []int{0, 1}
	s.CurrentPlayer = 0
	return s
}

func TestCreateInitialState(t *testing.T) {
	s := CreateInitialState()
	if s.Phase != entity.GamePhaseSetup || len(s.Players) != 0 || len(s.Board) != data.BoardSize {
		t.Fatalf("unexpected initial state: %+v", s)
	}
	if s.PendingTrades == nil || s.NextTradeID != 0 || s.TradesEnabled {
		t.Fatalf("unexpected trade state")
	}
}

func TestStartGame(t *testing.T) {
	s := GameReducer(CreateInitialState(), entity.StartGameAction{Type: entity.GameActionTypeStartGame, PlayerCount: 3, Names: []string{"Alice", "Bob", "Charlie"}, IsBot: []bool{false, true, false}})
	if s.Phase != entity.GamePhaseWaiting || len(s.Players) != 3 {
		t.Fatalf("game did not start")
	}
	if s.Players[0].Money != data.StartingMoney || !s.Players[1].IsBot {
		t.Fatalf("players not initialized")
	}
	if len(s.TurnOrder) != 3 {
		t.Fatalf("invalid turn order")
	}
	for _, player := range s.Players {
		if player.Properties == nil {
			t.Fatalf("player %d properties must be an empty JSON array", player.ID)
		}
	}
}

func TestDiceAnimatedMovesAndPassesGo(t *testing.T) {
	s := startedState(t)
	s.Players[0].Position = 38
	s = GameReducer(s, entity.DiceAnimatedAction{Type: entity.GameActionTypeDiceAnimated, Dice: [2]int{3, 4}})
	if s.Players[0].Position != 5 || s.Players[0].Money != data.StartingMoney+data.GoSalary || s.Phase != entity.GamePhaseMoving {
		t.Fatalf("unexpected move: %+v", s.Players[0])
	}
}

func TestThreeDoublesSendsPlayerToJail(t *testing.T) {
	s := startedState(t)
	s.DoublesCount = 2
	s = GameReducer(s, entity.DiceAnimatedAction{Type: entity.GameActionTypeDiceAnimated, Dice: [2]int{1, 1}})
	if !s.Players[0].InJail || s.Players[0].Position != data.JailSpace || s.CurrentPlayer != 1 {
		t.Fatalf("triple doubles not handled")
	}
}

func TestBuyPropertyAndBuild(t *testing.T) {
	s := startedState(t)
	s.Players[0].Position = 1
	s.Players[0].PassedGo = true
	s = setPendingBuy(s, 1)
	s = GameReducer(s, entity.BuyPropertyAction{Type: entity.GameActionTypeBuyProperty})
	if s.Board[1].Owner == nil || *s.Board[1].Owner != 0 || s.Players[0].Money != 1440 || s.Phase != entity.GamePhaseWaiting {
		t.Fatalf("property not bought or waiting phase not restored: %+v", s)
	}
	s.Dice = &[2]int{3, 4}
	s.JustBoughtSpaceID = nil
	s = GameReducer(s, entity.BuildHouseAction{Type: entity.GameActionTypeBuildHouse, SpaceID: 1})
	if s.Board[1].Houses != 1 || s.Players[0].Money != 1415 || s.Phase != entity.GamePhaseWaiting || !s.BuiltThisStop {
		t.Fatalf("house not built or waiting phase not restored: %+v", s)
	}
}

func TestBuildHouseOnOwnedPropertyAwayFromPosition(t *testing.T) {
	s := startedState(t)
	s.Players[0].Position = 8
	s.Players[0].Properties = []int{1}
	s.Players[0].Money = 1200
	owner := 0
	s.Board[1].Owner = &owner
	s.Board[1].Houses = 0
	s.Dice = &[2]int{3, 4}

	s = GameReducer(s, entity.BuildHouseAction{Type: entity.GameActionTypeBuildHouse, SpaceID: 1})
	if s.Board[1].Houses != 0 || s.Players[0].Money != 1200 {
		t.Fatalf("expected off-position build to be rejected, got houses=%d money=%d", s.Board[1].Houses, s.Players[0].Money)
	}
}

func setPendingBuy(s entity.GameState, id int) entity.GameState {
	return setPending(s, entity.PendingBuyPropertyAction{Type: entity.PendingActionTypeBuyProperty, SpaceID: id})
}

func TestResolveSpaceUnownedProperty(t *testing.T) {
	s := startedState(t)
	s.Players[0].Position = 1
	s.Players[0].PassedGo = true
	s = GameReducer(s, entity.ResolveSpaceAction{Type: entity.GameActionTypeResolveSpace})
	if s.Phase != entity.GamePhaseBuying || s.PendingAction == nil {
		t.Fatalf("property did not become buyable")
	}
}

func TestEndTurnSkipsBankruptPlayer(t *testing.T) {
	s := startedState(t)
	s.Players[1].Bankrupt = true
	s = GameReducer(s, entity.EndTurnAction{Type: entity.GameActionTypeEndTurn})
	if s.CurrentPlayer != 0 || s.Dice != nil {
		t.Fatalf("turn did not skip bankrupt player")
	}
}

func TestJailFine(t *testing.T) {
	s := startedState(t)
	s.Players[0].InJail = true
	s = GameReducer(s, entity.PayJailFineAction{Type: entity.GameActionTypePayJailFine})
	if s.Players[0].InJail || s.Players[0].Money != data.StartingMoney-data.JailFine || s.CurrentPlayer != 1 {
		t.Fatalf("jail fine not handled")
	}
}

func TestSetBotControl(t *testing.T) {
	s := startedState(t)
	s = GameReducer(s, entity.SetBotControlAction{Type: entity.GameActionTypeSetBotControl, PlayerID: 0, Controlled: true, Reason: entity.BotControlReasonAfk})
	if !s.Players[0].BotControlled || !s.Players[0].Afk {
		t.Fatalf("bot control not set")
	}
}

func TestResolveSpaceParityRules(t *testing.T) {
	s := startedState(t)
	s.Players[0].Position = 1
	s = GameReducer(s, entity.ResolveSpaceAction{Type: entity.GameActionTypeResolveSpace})
	if s.Phase != entity.GamePhaseWaiting || s.PendingAction != nil || s.EventLog[len(s.EventLog)-1].Key != entity.LogEventKeyMustCircleBoard {
		t.Fatal("passed-go gating missing")
	}
	s.Players[0].PassedGo = true
	s.Players[1].InJail = true
	o := 1
	s.Board[1].Owner = &o
	s = GameReducer(s, entity.ResolveSpaceAction{Type: entity.GameActionTypeResolveSpace})
	if s.PendingAction != nil || s.EventLog[len(s.EventLog)-1].Key != entity.LogEventKeyOwnerInJail {
		t.Fatal("owner-in-jail handling missing")
	}
	s.Players[1].InJail = false
	color := "brown"
	s.Board[1].Color = &color
	s.Board[3].Color = &color
	s.Board[3].Owner = &o
	s = GameReducer(s, entity.ResolveSpaceAction{Type: entity.GameActionTypeResolveSpace})
	pending, ok := (*s.PendingAction).(entity.PendingPayRentAction)
	if !ok || pending.Amount != s.Board[1].Rent[0]*2 || s.EventLog[len(s.EventLog)-1].Key != entity.LogEventKeyMonopolyRent {
		t.Fatal("monopoly rent parity missing")
	}
}

func TestCollectFreeParkingLogsCapturedPot(t *testing.T) {
	s := startedState(t)
	s.FreeParkingPot = 125
	s = GameReducer(s, entity.CollectFreeParkingAction{Type: entity.GameActionTypeCollectFreeParking})
	if s.EventLog[len(s.EventLog)-1].Params[entity.LogParamKeyAmount] != 125 {
		t.Fatal("free parking amount was not captured")
	}
}

func TestTradeParity(t *testing.T) {
	s := startedState(t)
	s.TradesEnabled = true
	s = GameReducer(s, entity.ProposeTradeAction{Type: entity.GameActionTypeProposeTrade, Offer: entity.TradeOffer{FromID: 0, ToID: 0, OfferCash: 1}})
	if len(s.PendingTrades) != 0 {
		t.Fatal("same-player trade accepted")
	}
	s = GameReducer(s, entity.ProposeTradeAction{Type: entity.GameActionTypeProposeTrade, Offer: entity.TradeOffer{FromID: 0, ToID: 1, OfferCash: 1}})
	if len(s.PendingTrades) != 1 {
		t.Fatal("valid trade not queued")
	}
	s.TradesEnabled = false
	s = GameReducer(s, entity.AcceptTradeAction{Type: entity.GameActionTypeAcceptTrade, TradeID: 0})
	if len(s.PendingTrades) != 1 {
		t.Fatal("disabled trade was accepted")
	}
	s.TradesEnabled = true
	s.Players[0].Money = 0
	s = GameReducer(s, entity.AcceptTradeAction{Type: entity.GameActionTypeAcceptTrade, TradeID: 0})
	if len(s.PendingTrades) != 0 || s.EventLog[len(s.EventLog)-1].Key != entity.LogEventKeyTradeRejected {
		t.Fatal("invalid accepted trade was not removed/logged")
	}
}

func TestValidTradeProposalAcceptsAndTransfersState(t *testing.T) {
	s := startedState(t)
	s.TradesEnabled = true
	s.Players[0].Money = 1499
	s.Players[1].Money = 1501
	s = GameReducer(s, entity.ProposeTradeAction{Type: entity.GameActionTypeProposeTrade, Offer: entity.TradeOffer{FromID: 0, ToID: 1, OfferCash: 1, RequestCash: 1}})
	if len(s.PendingTrades) != 1 || s.NextTradeID != 1 {
		t.Fatalf("proposal did not match Node pending trade state: %+v", s)
	}
	if got := s.EventLog[len(s.EventLog)-1].Key; got != entity.LogEventKeyTradeProposed {
		t.Fatalf("proposal event = %q", got)
	}
	s = GameReducer(s, entity.AcceptTradeAction{Type: entity.GameActionTypeAcceptTrade, TradeID: 0})
	if len(s.PendingTrades) != 0 || s.Players[0].Money != 1499 || s.Players[1].Money != 1501 {
		t.Fatalf("accepted trade changed state incorrectly: %+v", s)
	}
	if got := s.EventLog[len(s.EventLog)-1].Key; got != entity.LogEventKeyTradeAccepted {
		t.Fatalf("accept event = %q", got)
	}
}

func TestValidTradeRejectionRemovesPendingTradeWithoutTransfer(t *testing.T) {
	s := startedState(t)
	s.TradesEnabled = true
	s = GameReducer(s, entity.ProposeTradeAction{Type: entity.GameActionTypeProposeTrade, Offer: entity.TradeOffer{FromID: 0, ToID: 1, OfferCash: 1, RequestCash: 1}})
	s = GameReducer(s, entity.RejectTradeAction{Type: entity.GameActionTypeRejectTrade, TradeID: 0})
	if len(s.PendingTrades) != 0 || s.Players[0].Money != data.StartingMoney || s.Players[1].Money != data.StartingMoney {
		t.Fatalf("rejected trade changed state incorrectly: %+v", s)
	}
	if got := s.EventLog[len(s.EventLog)-1].Key; got != entity.LogEventKeyTradeRejected {
		t.Fatalf("reject event = %q", got)
	}
}

func TestBankruptcyClampsMoneyAndLogsTransfer(t *testing.T) {
	s := startedState(t)
	s.Players[0].Money = -50
	s.PendingAction = pending(entity.PendingBankruptcyAction{Type: entity.PendingActionTypeBankruptcy, SpaceID: 1, Amount: 100})
	o := 1
	s.Board[1].Owner = &o
	s.Players[1].Properties = []int{1}
	bankruptOwner := 0
	s.Board[3].Owner = &bankruptOwner
	s.Players[0].Properties = []int{3}
	s = GameReducer(s, entity.DeclareBankruptcyAction{Type: entity.GameActionTypeDeclareBankruptcy})
	if s.Players[1].Money != data.StartingMoney+45 {
		t.Fatalf("unexpected bankruptcy transfer: %d", s.Players[1].Money)
	}
	found := false
	for _, e := range s.EventLog {
		if e.Key == entity.LogEventKeyBankruptcyTransfer {
			found = true
		}
	}
	if !found {
		t.Fatal("bankruptcy transfer was not logged")
	}
}

func TestQueuedTradeValidationIsSafeAndParityChecked(t *testing.T) {
	s := startedState(t)
	s.TradesEnabled = true
	s.PendingTrades = []entity.PendingTrade{{ID: 9, TradeOffer: entity.TradeOffer{FromID: 99, ToID: -1, OfferCash: 1}}}
	s = GameReducer(s, entity.AcceptTradeAction{Type: entity.GameActionTypeAcceptTrade, TradeID: 9})
	if len(s.PendingTrades) != 0 || s.EventLog[len(s.EventLog)-1].Key != entity.LogEventKeyTradeRejected {
		t.Fatal("malformed queued trade was not safely rejected")
	}
	s.PendingTrades = []entity.PendingTrade{{ID: 10, TradeOffer: entity.TradeOffer{FromID: 0, ToID: 1, OfferCash: 1}}}
	s.Players[1].Bankrupt = true
	s = GameReducer(s, entity.AcceptTradeAction{Type: entity.GameActionTypeAcceptTrade, TradeID: 10})
	if len(s.PendingTrades) != 0 || s.EventLog[len(s.EventLog)-1].Key != entity.LogEventKeyTradeRejected {
		t.Fatal("bankrupt queued trade was accepted")
	}
}

func TestBotTradeValuationIncludesMonopolyBonusAndPenalty(t *testing.T) {
	s := startedState(t)
	s.Players[1].IsBot = true
	color := "brown"
	for _, id := range []int{1, 3} {
		s.Board[id].Color = &color
	}
	owner := 0
	s.Board[1].Owner = &owner
	s.Board[3].Owner = &owner
	trade := entity.PendingTrade{TradeOffer: entity.TradeOffer{FromID: 0, ToID: 1, OfferProperties: []int{3}, RequestCash: 50}}
	if !shouldAcceptTrade(s, trade) {
		t.Fatal("expected monopoly gain bonus to affect bot valuation")
	}
	botOwner := 1
	s.Board[1].Owner = &botOwner
	s.Board[3].Owner = &botOwner
	trade = entity.PendingTrade{TradeOffer: entity.TradeOffer{FromID: 0, ToID: 1, RequestProperties: []int{1}, OfferCash: 100}}
	if shouldAcceptTrade(s, trade) {
		t.Fatal("expected monopoly loss penalty to affect bot valuation")
	}
}

func TestBotTradeValuationDeduplicatesPropertyIDs(t *testing.T) {
	s := startedState(t)
	s.Players[1].IsBot = true
	color := "brown"
	s.Board[1].Color = &color
	s.Board[3].Color = &color
	owner := 0
	s.Board[1].Owner = &owner
	s.Board[3].Owner = &owner
	unique := entity.PendingTrade{TradeOffer: entity.TradeOffer{FromID: 0, ToID: 1, OfferProperties: []int{3}, RequestCash: 50}}
	duplicate := entity.PendingTrade{TradeOffer: entity.TradeOffer{FromID: 0, ToID: 1, OfferProperties: []int{3, 3}, RequestCash: 50}}
	if shouldAcceptTrade(s, unique) != shouldAcceptTrade(s, duplicate) {
		t.Fatal("duplicate offered property changed bot valuation")
	}
}

func TestDiceAnimatedAwardsGoWhenLandingExactlyOnGo(t *testing.T) {
	s := startedState(t)
	s.Players[0].Position = 38
	s = GameReducer(s, entity.DiceAnimatedAction{Type: entity.GameActionTypeDiceAnimated, Dice: [2]int{1, 1}})
	if s.Players[0].Position != 0 || s.Players[0].Money != data.StartingMoney+data.GoSalary {
		t.Fatal("landing exactly on GO did not award salary")
	}
}

func TestSellHouseRequiresCurrentPlayerOwnership(t *testing.T) {
	s := startedState(t)
	s.Players[0].Money = 1000
	s.Players[1].Money = 1000
	s.Board[1].Houses = 1
	owner := 1
	s.Board[1].Owner = &owner
	before := s
	s = GameReducer(s, entity.SellHouseAction{Type: entity.GameActionTypeSellHouse, SpaceID: 1})
	if s.Board[1].Houses != before.Board[1].Houses || s.Players[0].Money != before.Players[0].Money || s.Players[1].Money != before.Players[1].Money {
		t.Fatal("unauthorized house sale changed state")
	}
	s.CurrentPlayer = -1
	s = GameReducer(s, entity.SellHouseAction{Type: entity.GameActionTypeSellHouse, SpaceID: 1})
	if s.Board[1].Houses != 1 {
		t.Fatal("invalid current player did not reject house sale")
	}
}

func TestSellHousePreservesAuthorizedBehavior(t *testing.T) {
	s := startedState(t)
	s.CurrentPlayer = 0
	s.Players[0].Money = 1000
	owner := 0
	s.Board[1].Owner = &owner
	s.Board[1].Houses = 1

	s = GameReducer(s, entity.SellHouseAction{Type: entity.GameActionTypeSellHouse, SpaceID: 1})
	if s.Board[1].Houses != 0 {
		t.Fatalf("authorized house sale left %d houses, want 0", s.Board[1].Houses)
	}
	if s.Players[0].Money != 1018 {
		t.Fatalf("authorized house sale money = %d, want 1018", s.Players[0].Money)
	}
}

func TestMortgageAndUnmortgageRequireCurrentPlayerOwnership(t *testing.T) {
	s := startedState(t)
	s.Players[0].Money = 1000
	s.Players[1].Money = 1000
	owner := 1
	s.Board[1].Owner = &owner
	before := s
	s = GameReducer(s, entity.MortgageAction{Type: entity.GameActionTypeMortgage, SpaceID: 1})
	if s.Board[1].Mortgaged || s.Players[0].Money != before.Players[0].Money {
		t.Fatal("unauthorized mortgage changed state")
	}
	s.Board[1].Mortgaged = true
	s = GameReducer(s, entity.UnmortgageAction{Type: entity.GameActionTypeUnmortgage, SpaceID: 1})
	if !s.Board[1].Mortgaged || s.Players[0].Money != before.Players[0].Money {
		t.Fatal("unauthorized unmortgage changed state")
	}
	s.CurrentPlayer = -1
	s = GameReducer(s, entity.MortgageAction{Type: entity.GameActionTypeMortgage, SpaceID: 1})
	if !s.Board[1].Mortgaged {
		t.Fatal("invalid current player did not reject mortgage")
	}

	s = startedState(t)
	s.Players[0].Money = 1000
	owner = 0
	s.Board[1].Owner = &owner
	s = GameReducer(s, entity.MortgageAction{Type: entity.GameActionTypeMortgage, SpaceID: 1})
	if !s.Board[1].Mortgaged || s.Players[0].Money != 1030 {
		t.Fatal("authorized mortgage did not preserve legitimate behavior")
	}
	s = GameReducer(s, entity.UnmortgageAction{Type: entity.GameActionTypeUnmortgage, SpaceID: 1})
	if s.Board[1].Mortgaged || s.Players[0].Money != 997 {
		t.Fatal("authorized unmortgage did not preserve legitimate behavior")
	}
}

func TestValidTradeRejectsDuplicatePropertyIDs(t *testing.T) {
	s := startedState(t)
	s.TradesEnabled = true
	owner0, owner1 := 0, 1
	s.Board[1].Owner = &owner0
	s.Board[3].Owner = &owner1
	for _, offer := range []entity.TradeOffer{
		{FromID: 0, ToID: 1, OfferProperties: []int{1, 1}},
		{FromID: 0, ToID: 1, RequestProperties: []int{3, 3}},
	} {
		s.PendingTrades = nil
		s = GameReducer(s, entity.ProposeTradeAction{Type: entity.GameActionTypeProposeTrade, Offer: offer})
		if len(s.PendingTrades) != 0 {
			t.Fatalf("duplicate property trade was queued: %+v", offer)
		}
	}
}

func TestValidTradeTransfersUniqueProperties(t *testing.T) {
	s := startedState(t)
	s.TradesEnabled = true
	owner0, owner1 := 0, 1
	s.Board[1].Owner = &owner0
	s.Board[3].Owner = &owner1
	s.Players[0].Properties = []int{1}
	s.Players[1].Properties = []int{3}
	s = GameReducer(s, entity.ProposeTradeAction{Type: entity.GameActionTypeProposeTrade, Offer: entity.TradeOffer{FromID: 0, ToID: 1, OfferProperties: []int{1}, RequestProperties: []int{3}}})
	if len(s.PendingTrades) != 1 {
		t.Fatal("valid property trade was not queued")
	}
	s = GameReducer(s, entity.AcceptTradeAction{Type: entity.GameActionTypeAcceptTrade, TradeID: s.PendingTrades[0].ID})
	if s.Board[1].Owner == nil || *s.Board[1].Owner != 1 || s.Board[3].Owner == nil || *s.Board[3].Owner != 0 {
		t.Fatal("valid trade did not transfer ownership")
	}
	if len(s.Players[0].Properties) != 1 || s.Players[0].Properties[0] != 3 || len(s.Players[1].Properties) != 1 || s.Players[1].Properties[0] != 1 {
		t.Fatal("valid trade did not preserve unique property collections")
	}
}

func TestMalformedReducerInputsDoNotPanic(t *testing.T) {
	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("malformed reducer input panicked: %v", r)
		}
	}()
	GameReducer(CreateInitialState(), entity.StartGameAction{Type: entity.GameActionTypeStartGame, PlayerCount: 0})
	s := startedState(t)
	s.PendingAction = pending(entity.PendingBuyPropertyAction{Type: entity.PendingActionTypeBuyProperty, SpaceID: -1})
	GameReducer(s, entity.BuyPropertyAction{Type: entity.GameActionTypeBuyProperty})
	s.PendingAction = pending(entity.PendingPayRentAction{Type: entity.PendingActionTypePayRent, SpaceID: 999, Amount: 10})
	GameReducer(s, entity.PayRentAction{Type: entity.GameActionTypePayRent})
	s.Players[0].Position = 999
	GameReducer(s, entity.ResolveSpaceAction{Type: entity.GameActionTypeResolveSpace})
	s.Players[0].Position = 1
	owner := 999
	s.Board[1].Owner = &owner
	GameReducer(s, entity.ResolveSpaceAction{Type: entity.GameActionTypeResolveSpace})
}
