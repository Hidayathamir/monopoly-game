package entity

import (
	"encoding/json"
	"fmt"
)

// SpaceType string constants and type
type SpaceType = string

const (
	SpaceTypeProperty    SpaceType = "property"
	SpaceTypeRailroad    SpaceType = "railroad"
	SpaceTypeUtility     SpaceType = "utility"
	SpaceTypeChance      SpaceType = "chance"
	SpaceTypeCommunity   SpaceType = "community"
	SpaceTypeTax         SpaceType = "tax"
	SpaceTypeGo          SpaceType = "go"
	SpaceTypeJail        SpaceType = "jail"
	SpaceTypeGoToJail    SpaceType = "goToJail"
	SpaceTypeFreeParking SpaceType = "freeParking"
)

// CardType string constants and type
type CardType = string

const (
	CardTypeChance    CardType = "chance"
	CardTypeCommunity CardType = "community"
)

// CardActionType string constants and type
type CardActionType = string

const (
	CardActionTypeCollect            CardActionType = "collect"
	CardActionTypePay                CardActionType = "pay"
	CardActionTypeGoToJail           CardActionType = "goToJail"
	CardActionTypeGetOutOfJailFree   CardActionType = "getOutOfJailFree"
	CardActionTypeGoToSpace          CardActionType = "goToSpace"
	CardActionTypeCollectFromPlayers CardActionType = "collectFromPlayers"
	CardActionTypePayToPlayers       CardActionType = "payToPlayers"
	CardActionTypeStreetRepairs      CardActionType = "streetRepairs"
)

// TaxType string constants and type
type TaxType = string

const (
	TaxTypeIncome TaxType = "income"
	TaxTypeLuxury TaxType = "luxury"
)

// GamePhase string constants and type
type GamePhase = string

const (
	GamePhaseSetup     GamePhase = "setup"
	GamePhaseWaiting   GamePhase = "waiting"
	GamePhaseRolling   GamePhase = "rolling"
	GamePhaseMoving    GamePhase = "moving"
	GamePhaseResolving GamePhase = "resolving"
	GamePhaseBuying    GamePhase = "buying"
	GamePhaseBuilding  GamePhase = "building"
	GamePhaseGameOver  GamePhase = "gameOver"
)

// PendingActionType string constants and type
type PendingActionType = string

const (
	PendingActionTypeBuyProperty PendingActionType = "buyProperty"
	PendingActionTypePayRent     PendingActionType = "payRent"
	PendingActionTypeDrawCard    PendingActionType = "drawCard"
	PendingActionTypeCardEffect  PendingActionType = "cardEffect"
	PendingActionTypeBankruptcy  PendingActionType = "bankruptcy"
)

// GameActionType string constants and type
type GameActionType = string

const (
	GameActionTypeStartGame           GameActionType = "START_GAME"
	GameActionTypeRollDice            GameActionType = "ROLL_DICE"
	GameActionTypeDiceAnimated        GameActionType = "DICE_ANIMATED"
	GameActionTypeMoveToken           GameActionType = "MOVE_TOKEN"
	GameActionTypePassGo              GameActionType = "PASS_GO"
	GameActionTypeResolveSpace        GameActionType = "RESOLVE_SPACE"
	GameActionTypeBuyProperty         GameActionType = "BUY_PROPERTY"
	GameActionTypeDeclineBuy          GameActionType = "DECLINE_BUY"
	GameActionTypePayRent             GameActionType = "PAY_RENT"
	GameActionTypeBuildHouse          GameActionType = "BUILD_HOUSE"
	GameActionTypeSellHouse           GameActionType = "SELL_HOUSE"
	GameActionTypeMortgage            GameActionType = "MORTGAGE"
	GameActionTypeUnmortgage          GameActionType = "UNMORTGAGE"
	GameActionTypeSellProperty        GameActionType = "SELL_PROPERTY"
	GameActionTypeProposeTrade        GameActionType = "PROPOSE_TRADE"
	GameActionTypeAcceptTrade         GameActionType = "ACCEPT_TRADE"
	GameActionTypeRejectTrade         GameActionType = "REJECT_TRADE"
	GameActionTypeCancelTrade         GameActionType = "CANCEL_TRADE"
	GameActionTypeDrawCard            GameActionType = "DRAW_CARD"
	GameActionTypeResolveCard         GameActionType = "RESOLVE_CARD"
	GameActionTypeAttemptJailbreak    GameActionType = "ATTEMPT_JAILBREAK"
	GameActionTypeEndTurn             GameActionType = "END_TURN"
	GameActionTypeDeclareBankruptcy   GameActionType = "DECLARE_BANKRUPTCY"
	GameActionTypeCollectFreeParking  GameActionType = "COLLECT_FREE_PARKING"
	GameActionTypeSkipAction          GameActionType = "SKIP_ACTION"
	GameActionTypePayJailFine         GameActionType = "PAY_JAIL_FINE"
	GameActionTypeUseGetOutOfJailFree GameActionType = "USE_GET_OUT_OF_JAIL_FREE"
	GameActionTypeSetBotControl       GameActionType = "SET_BOT_CONTROL"
	GameActionTypeSetReconnectGrace   GameActionType = "SET_RECONNECT_GRACE"
)

// BotControlReason string constants and type
type BotControlReason = string

const (
	BotControlReasonOffline BotControlReason = "offline"
	BotControlReasonAfk     BotControlReason = "afk"
)

// LogEventKey string constants and type
type LogEventKey = string

const (
	LogEventKeyGameStarted           LogEventKey = "event.gameStarted"
	LogEventKeyTurn                  LogEventKey = "event.turn"
	LogEventKeyRolled                LogEventKey = "event.rolled"
	LogEventKeyRolledAimed           LogEventKey = "event.rolledAimed"
	LogEventKeyPassedGo              LogEventKey = "event.passedGo"
	LogEventKeyJailBreakDoubles      LogEventKey = "event.jailBreakDoubles"
	LogEventKeyJailForcedOut         LogEventKey = "event.jailForcedOut"
	LogEventKeyJailFailed            LogEventKey = "event.jailFailed"
	LogEventKeyTripleDoubles         LogEventKey = "event.tripleDoubles"
	LogEventKeyToJail                LogEventKey = "event.toJail"
	LogEventKeyFreeParkingJackpot    LogEventKey = "event.freeParkingJackpot"
	LogEventKeyIncomeTax             LogEventKey = "event.incomeTax"
	LogEventKeyLuxuryTax             LogEventKey = "event.luxuryTax"
	LogEventKeyOwnerInJail           LogEventKey = "event.ownerInJail"
	LogEventKeyMonopolyRent          LogEventKey = "event.monopolyRent"
	LogEventKeyMustCircleBoard       LogEventKey = "event.mustCircleBoard"
	LogEventKeyBought                LogEventKey = "event.bought"
	LogEventKeyPaidRent              LogEventKey = "event.paidRent"
	LogEventKeyBuiltHouse            LogEventKey = "event.builtHouse"
	LogEventKeyBuiltHotel            LogEventKey = "event.builtHotel"
	LogEventKeySoldHouse             LogEventKey = "event.soldHouse"
	LogEventKeyMortgaged             LogEventKey = "event.mortgaged"
	LogEventKeyUnmortgaged           LogEventKey = "event.unmortgaged"
	LogEventKeySoldToBank            LogEventKey = "event.soldToBank"
	LogEventKeyTradeProposed         LogEventKey = "event.tradeProposed"
	LogEventKeyTradeAccepted         LogEventKey = "event.tradeAccepted"
	LogEventKeyTradeRejected         LogEventKey = "event.tradeRejected"
	LogEventKeyTradeProposalRejected LogEventKey = "event.tradeProposalRejected"
	LogEventKeyTradeCancelled        LogEventKey = "event.tradeCancelled"
	LogEventKeyPaidJailFine          LogEventKey = "event.paidJailFine"
	LogEventKeyUsedJailCard          LogEventKey = "event.usedJailCard"
	LogEventKeyDoublesAgain          LogEventKey = "event.doublesAgain"
	LogEventKeyCardCollect           LogEventKey = "event.cardCollect"
	LogEventKeyCardPay               LogEventKey = "event.cardPay"
	LogEventKeyCardToJail            LogEventKey = "event.cardToJail"
	LogEventKeyGotJailCard           LogEventKey = "event.gotJailCard"
	LogEventKeyCardCollectPlayers    LogEventKey = "event.cardCollectPlayers"
	LogEventKeyCardPayPlayers        LogEventKey = "event.cardPayPlayers"
	LogEventKeyCardStreetRepairs     LogEventKey = "event.cardStreetRepairs"
	LogEventKeyMovedForward          LogEventKey = "event.movedForward"
	LogEventKeyMovedBack             LogEventKey = "event.movedBack"
	LogEventKeyBankruptcy            LogEventKey = "event.bankruptcy"
	LogEventKeyBankruptcyWin         LogEventKey = "event.bankruptcyWin"
	LogEventKeyBankruptcyTransfer    LogEventKey = "event.bankruptcyTransfer"
	LogEventKeyPlayerOffline         LogEventKey = "event.playerOffline"
	LogEventKeyPlayerAfk             LogEventKey = "event.playerAfk"
	LogEventKeyPlayerBack            LogEventKey = "event.playerBack"
	LogEventKeyReconnectWait         LogEventKey = "event.reconnectWait"
)

// LogParamKey string constants and type
type LogParamKey = string

const (
	LogParamKeyBot       LogParamKey = "bot"
	LogParamKeySpaceId   LogParamKey = "spaceId"
	LogParamKeyCardId    LogParamKey = "cardId"
	LogParamKeyAmount    LogParamKey = "amount"
	LogParamKeyMoney     LogParamKey = "money"
	LogParamKeyPerHouse  LogParamKey = "perHouse"
	LogParamKeyPerHotel  LogParamKey = "perHotel"
	LogParamKeyPerPlayer LogParamKey = "perPlayer"
)

// TradeDecisionType string constants and type
type TradeDecisionType = string

const (
	TradeDecisionTypeAccept TradeDecisionType = "accept"
	TradeDecisionTypeReject TradeDecisionType = "reject"
)

// Emoticon and ActiveEmotion are defined in emotion_entity.go.

// --- Core structs ---

type Player struct {
	ID                    int              `json:"id"`
	Name                  string           `json:"name"`
	Money                 int              `json:"money"`
	Position              int              `json:"position"`
	Properties            []int            `json:"properties"`
	PassedGo              bool             `json:"passedGo"`
	InJail                bool             `json:"inJail"`
	JailTurns             int              `json:"jailTurns"`
	Bankrupt              bool             `json:"bankrupt"`
	GetOutOfJailFreeCards int              `json:"getOutOfJailFreeCards"`
	IsBot                 bool             `json:"isBot"`
	BotControlled         bool             `json:"botControlled"`
	Afk                   bool             `json:"afk"`
	Color                 string           `json:"color"`
	Avatar                PlayerAvatarData `json:"avatar"`
}

type Space struct {
	ID            int       `json:"id"`
	Type          SpaceType `json:"type"`
	Price         *int      `json:"price,omitempty"`
	Rent          []int     `json:"rent,omitempty"`
	HouseCost     []int     `json:"houseCost,omitempty"`
	Color         *string   `json:"color,omitempty"`
	Owner         *int      `json:"owner"`
	Houses        int       `json:"houses"`
	Mortgaged     bool      `json:"mortgaged"`
	TaxType       *TaxType  `json:"taxType,omitempty"`
	RailroadCount int       `json:"-"`
	UtilityCount  int       `json:"-"`
}

type Card struct {
	ID     int        `json:"id"`
	Type   CardType   `json:"type"`
	Effect CardEffect `json:"effect"`
}

func (c *Card) UnmarshalJSON(data []byte) error {
	var raw struct {
		ID     int             `json:"id"`
		Type   CardType        `json:"type"`
		Effect json.RawMessage `json:"effect"`
	}
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	var action struct {
		Action CardActionType `json:"action"`
	}
	if err := json.Unmarshal(raw.Effect, &action); err != nil {
		return err
	}
	var effect CardEffect
	switch action.Action {
	case CardActionTypeCollect:
		var value CardEffectCollect
		if err := json.Unmarshal(raw.Effect, &value); err != nil {
			return err
		}
		effect = value
	case CardActionTypePay:
		var value CardEffectPay
		if err := json.Unmarshal(raw.Effect, &value); err != nil {
			return err
		}
		effect = value
	case CardActionTypeGoToJail:
		var value CardEffectGoToJail
		if err := json.Unmarshal(raw.Effect, &value); err != nil {
			return err
		}
		effect = value
	case CardActionTypeGetOutOfJailFree:
		var value CardEffectGetOutOfJailFree
		if err := json.Unmarshal(raw.Effect, &value); err != nil {
			return err
		}
		effect = value
	case CardActionTypeGoToSpace:
		var value CardEffectGoToSpace
		if err := json.Unmarshal(raw.Effect, &value); err != nil {
			return err
		}
		effect = value
	case CardActionTypeCollectFromPlayers:
		var value CardEffectCollectFromPlayers
		if err := json.Unmarshal(raw.Effect, &value); err != nil {
			return err
		}
		effect = value
	case CardActionTypePayToPlayers:
		var value CardEffectPayToPlayers
		if err := json.Unmarshal(raw.Effect, &value); err != nil {
			return err
		}
		effect = value
	case CardActionTypeStreetRepairs:
		var value CardEffectStreetRepairs
		if err := json.Unmarshal(raw.Effect, &value); err != nil {
			return err
		}
		effect = value
	default:
		return fmt.Errorf("unknown card action: %q", action.Action)
	}
	c.ID = raw.ID
	c.Type = raw.Type
	c.Effect = effect
	return nil
}

type LogEntry struct {
	Key    LogEventKey            `json:"key"`
	Params map[string]interface{} `json:"params,omitempty"`
}

type ReconnectGrace struct {
	PlayerID int `json:"playerId"`
	Until    int `json:"until"`
}

type TradeOffer struct {
	FromID            int   `json:"fromId"`
	ToID              int   `json:"toId"`
	OfferProperties   []int `json:"offerProperties"`
	OfferCash         int   `json:"offerCash"`
	RequestProperties []int `json:"requestProperties"`
	RequestCash       int   `json:"requestCash"`
}

type PendingTrade struct {
	ID int `json:"id"`
	TradeOffer
}

// --- Discriminated unions ---

// PendingAction is a discriminated union on Type.
type PendingAction interface {
	pendingActionType() // sealed
}

type PendingBuyPropertyAction struct {
	Type    PendingActionType `json:"type"`
	SpaceID int               `json:"spaceId"`
}

func (PendingBuyPropertyAction) pendingActionType() {}

type PendingPayRentAction struct {
	Type    PendingActionType `json:"type"`
	SpaceID int               `json:"spaceId"`
	Amount  int               `json:"amount"`
}

func (PendingPayRentAction) pendingActionType() {}

type PendingDrawCardAction struct {
	Type     PendingActionType `json:"type"`
	DrawType CardType          `json:"cardType"`
}

func (PendingDrawCardAction) pendingActionType() {}

type PendingCardEffectAction struct {
	Type PendingActionType `json:"type"`
	Card Card              `json:"card"`
}

func (PendingCardEffectAction) pendingActionType() {}

type PendingBankruptcyAction struct {
	Type    PendingActionType `json:"type"`
	Amount  int               `json:"amount"`
	SpaceID int               `json:"spaceId"`
}

func (PendingBankruptcyAction) pendingActionType() {}

// CardEffect is a discriminated union on Action.
type CardEffect interface {
	cardEffectAction() // sealed
}

type CardEffectCollect struct {
	Action CardActionType `json:"action"`
	Amount int            `json:"amount"`
}

func (CardEffectCollect) cardEffectAction() {}

type CardEffectPay struct {
	Action CardActionType `json:"action"`
	Amount int            `json:"amount"`
}

func (CardEffectPay) cardEffectAction() {}

type CardEffectGoToJail struct {
	Action CardActionType `json:"action"`
}

func (CardEffectGoToJail) cardEffectAction() {}

type CardEffectGetOutOfJailFree struct {
	Action CardActionType `json:"action"`
}

func (CardEffectGetOutOfJailFree) cardEffectAction() {}

type CardEffectGoToSpace struct {
	Action  CardActionType `json:"action"`
	SpaceID int            `json:"spaceId"`
}

func (CardEffectGoToSpace) cardEffectAction() {}

type CardEffectCollectFromPlayers struct {
	Action CardActionType `json:"action"`
	Amount int            `json:"amount"`
}

func (CardEffectCollectFromPlayers) cardEffectAction() {}

type CardEffectPayToPlayers struct {
	Action CardActionType `json:"action"`
	Amount int            `json:"amount"`
}

func (CardEffectPayToPlayers) cardEffectAction() {}

type CardEffectStreetRepairs struct {
	Action   CardActionType `json:"action"`
	PerHouse int            `json:"perHouse"`
	PerHotel int            `json:"perHotel"`
}

func (CardEffectStreetRepairs) cardEffectAction() {}

// --- GameState ---

type GameState struct {
	Phase             GamePhase       `json:"phase"`
	Players           []Player        `json:"players"`
	TurnOrder         []int           `json:"turnOrder"`
	CurrentPlayer     int             `json:"currentPlayer"`
	Board             []Space         `json:"board"`
	ChanceDeck        []Card          `json:"chanceDeck"`
	CommunityDeck     []Card          `json:"communityDeck"`
	FreeParkingPot    int             `json:"freeParkingPot"`
	Dice              *[2]int         `json:"dice"`
	DoublesCount      int             `json:"doublesCount"`
	LastMoveSteps     *int            `json:"lastMoveSteps"`
	EventLog          []LogEntry      `json:"eventLog"`
	PendingAction     *PendingAction  `json:"pendingAction"`
	JustBoughtSpaceID *int            `json:"justBoughtSpaceId"`
	BuiltThisStop     bool            `json:"builtThisStop"`
	ReconnectGrace    *ReconnectGrace `json:"reconnectGrace"`
	PendingTrades     []PendingTrade  `json:"pendingTrades"`
	NextTradeID       int             `json:"nextTradeId"`
	TradesEnabled     bool            `json:"tradesEnabled"`
}

func (s GameState) MarshalJSON() ([]byte, error) {
	type alias GameState
	if s.Players == nil {
		s.Players = []Player{}
	}
	if s.TurnOrder == nil {
		s.TurnOrder = []int{}
	}
	if s.Board == nil {
		s.Board = []Space{}
	}
	if s.ChanceDeck == nil {
		s.ChanceDeck = []Card{}
	}
	if s.CommunityDeck == nil {
		s.CommunityDeck = []Card{}
	}
	if s.EventLog == nil {
		s.EventLog = []LogEntry{}
	}
	if s.PendingTrades == nil {
		s.PendingTrades = []PendingTrade{}
	}
	for i := range s.PendingTrades {
		if s.PendingTrades[i].OfferProperties == nil {
			s.PendingTrades[i].OfferProperties = []int{}
		}
		if s.PendingTrades[i].RequestProperties == nil {
			s.PendingTrades[i].RequestProperties = []int{}
		}
	}
	return json.Marshal(alias(s))
}

func (s *GameState) UnmarshalJSON(data []byte) error {
	var raw struct {
		Phase             GamePhase       `json:"phase"`
		Players           []Player        `json:"players"`
		TurnOrder         []int           `json:"turnOrder"`
		CurrentPlayer     int             `json:"currentPlayer"`
		Board             []Space         `json:"board"`
		ChanceDeck        []Card          `json:"chanceDeck"`
		CommunityDeck     []Card          `json:"communityDeck"`
		FreeParkingPot    int             `json:"freeParkingPot"`
		Dice              *[2]int         `json:"dice"`
		DoublesCount      int             `json:"doublesCount"`
		LastMoveSteps     *int            `json:"lastMoveSteps"`
		EventLog          []LogEntry      `json:"eventLog"`
		PendingAction     json.RawMessage `json:"pendingAction"`
		JustBoughtSpaceID *int            `json:"justBoughtSpaceId"`
		BuiltThisStop     bool            `json:"builtThisStop"`
		ReconnectGrace    *ReconnectGrace `json:"reconnectGrace"`
		PendingTrades     []PendingTrade  `json:"pendingTrades"`
		NextTradeID       int             `json:"nextTradeId"`
		TradesEnabled     bool            `json:"tradesEnabled"`
	}
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	*s = GameState{
		Phase: raw.Phase, Players: raw.Players, TurnOrder: raw.TurnOrder, CurrentPlayer: raw.CurrentPlayer,
		Board: raw.Board, ChanceDeck: raw.ChanceDeck, CommunityDeck: raw.CommunityDeck, FreeParkingPot: raw.FreeParkingPot,
		Dice: raw.Dice, DoublesCount: raw.DoublesCount, LastMoveSteps: raw.LastMoveSteps, EventLog: raw.EventLog,
		JustBoughtSpaceID: raw.JustBoughtSpaceID, BuiltThisStop: raw.BuiltThisStop, ReconnectGrace: raw.ReconnectGrace,
		PendingTrades: raw.PendingTrades, NextTradeID: raw.NextTradeID, TradesEnabled: raw.TradesEnabled,
	}
	if len(raw.PendingAction) == 0 || string(raw.PendingAction) == "null" {
		return nil
	}
	var header struct {
		Type PendingActionType `json:"type"`
	}
	if err := json.Unmarshal(raw.PendingAction, &header); err != nil {
		return err
	}
	switch header.Type {
	case PendingActionTypeBuyProperty:
		var value PendingBuyPropertyAction
		if err := json.Unmarshal(raw.PendingAction, &value); err != nil {
			return err
		}
		pending := PendingAction(value)
		s.PendingAction = &pending
	case PendingActionTypePayRent:
		var value PendingPayRentAction
		if err := json.Unmarshal(raw.PendingAction, &value); err != nil {
			return err
		}
		pending := PendingAction(value)
		s.PendingAction = &pending
	case PendingActionTypeDrawCard:
		var value PendingDrawCardAction
		if err := json.Unmarshal(raw.PendingAction, &value); err != nil {
			return err
		}
		pending := PendingAction(value)
		s.PendingAction = &pending
	case PendingActionTypeCardEffect:
		var value PendingCardEffectAction
		if err := json.Unmarshal(raw.PendingAction, &value); err != nil {
			return err
		}
		pending := PendingAction(value)
		s.PendingAction = &pending
	case PendingActionTypeBankruptcy:
		var value PendingBankruptcyAction
		if err := json.Unmarshal(raw.PendingAction, &value); err != nil {
			return err
		}
		pending := PendingAction(value)
		s.PendingAction = &pending
	default:
		return fmt.Errorf("unknown pending action type: %q", header.Type)
	}
	return nil
}
