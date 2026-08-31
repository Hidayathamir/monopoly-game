package entity

type GameAction interface {
	gameActionType()
}

type StartGameAction struct {
	Type        GameActionType
	PlayerCount int
	Names       []string
	IsBot       []bool
	Colors      []string
	Avatars     []PlayerAvatarData
	PlayerIDs   []int
}
type RollDiceAction struct {
	Type   GameActionType
	Target *int
}
type DiceAnimatedAction struct {
	Type   GameActionType
	Dice   [2]int
	Target *int
	Luck   *int
}
type MoveTokenAction struct {
	Type   GameActionType
	Spaces int
}
type PassGoAction struct{ Type GameActionType }
type ResolveSpaceAction struct{ Type GameActionType }
type BuyPropertyAction struct{ Type GameActionType }
type DeclineBuyAction struct{ Type GameActionType }
type PayRentAction struct{ Type GameActionType }
type BuildHouseAction struct {
	Type    GameActionType
	SpaceID int
}
type SellHouseAction struct {
	Type    GameActionType
	SpaceID int
}
type MortgageAction struct {
	Type    GameActionType
	SpaceID int
}
type UnmortgageAction struct {
	Type    GameActionType
	SpaceID int
}
type SellPropertyAction struct {
	Type    GameActionType
	SpaceID int
}
type ProposeTradeAction struct {
	Type  GameActionType
	Offer TradeOffer
}
type AcceptTradeAction struct {
	Type    GameActionType
	TradeID int
}
type RejectTradeAction struct {
	Type    GameActionType
	TradeID int
}
type CancelTradeAction struct {
	Type    GameActionType
	TradeID int
}
type DrawCardAction struct{ Type GameActionType }
type ResolveCardAction struct{ Type GameActionType }
type AttemptJailbreakAction struct {
	Type GameActionType
	Dice [2]int
}
type EndTurnAction struct{ Type GameActionType }
type DeclareBankruptcyAction struct{ Type GameActionType }
type CollectFreeParkingAction struct{ Type GameActionType }
type SkipAction struct{ Type GameActionType }
type PayJailFineAction struct{ Type GameActionType }
type UseGetOutOfJailFreeAction struct{ Type GameActionType }
type SetBotControlAction struct {
	Type       GameActionType
	PlayerID   int
	Controlled bool
	Reason     BotControlReason
}
type SetReconnectGraceAction struct {
	Type     GameActionType
	PlayerID int
	Until    *int
}

func (StartGameAction) gameActionType()           {}
func (RollDiceAction) gameActionType()            {}
func (DiceAnimatedAction) gameActionType()        {}
func (MoveTokenAction) gameActionType()           {}
func (PassGoAction) gameActionType()              {}
func (ResolveSpaceAction) gameActionType()        {}
func (BuyPropertyAction) gameActionType()         {}
func (DeclineBuyAction) gameActionType()          {}
func (PayRentAction) gameActionType()             {}
func (BuildHouseAction) gameActionType()          {}
func (SellHouseAction) gameActionType()           {}
func (MortgageAction) gameActionType()            {}
func (UnmortgageAction) gameActionType()          {}
func (SellPropertyAction) gameActionType()        {}
func (ProposeTradeAction) gameActionType()        {}
func (AcceptTradeAction) gameActionType()         {}
func (RejectTradeAction) gameActionType()         {}
func (CancelTradeAction) gameActionType()         {}
func (DrawCardAction) gameActionType()            {}
func (ResolveCardAction) gameActionType()         {}
func (AttemptJailbreakAction) gameActionType()    {}
func (EndTurnAction) gameActionType()             {}
func (DeclareBankruptcyAction) gameActionType()   {}
func (CollectFreeParkingAction) gameActionType()  {}
func (SkipAction) gameActionType()                {}
func (PayJailFineAction) gameActionType()         {}
func (UseGetOutOfJailFreeAction) gameActionType() {}
func (SetBotControlAction) gameActionType()       {}
func (SetReconnectGraceAction) gameActionType()   {}
