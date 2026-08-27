package entity

import (
	"encoding/json"
	"testing"
)

func TestGameStateJSONUnmarshalsPendingActions(t *testing.T) {
	tests := []struct {
		name string
		json string
		want func(PendingAction) bool
	}{
		{"buyProperty", `{"type":"buyProperty","spaceId":7}`, func(value PendingAction) bool {
			got, ok := value.(PendingBuyPropertyAction)
			return ok && got.SpaceID == 7
		}},
		{"payRent", `{"type":"payRent","spaceId":39,"amount":1700}`, func(value PendingAction) bool {
			got, ok := value.(PendingPayRentAction)
			return ok && got.SpaceID == 39 && got.Amount == 1700
		}},
		{"drawCard", `{"type":"drawCard","cardType":"chance"}`, func(value PendingAction) bool {
			got, ok := value.(PendingDrawCardAction)
			return ok && got.DrawType == CardTypeChance
		}},
		{"cardEffect", `{"type":"cardEffect","card":{"id":1,"type":"chance","effect":{"action":"collect","amount":50}}}`, func(value PendingAction) bool {
			got, ok := value.(PendingCardEffectAction)
			return ok && got.Card.ID == 1
		}},
		{"bankruptcy", `{"type":"bankruptcy","spaceId":39,"amount":1700}`, func(value PendingAction) bool {
			got, ok := value.(PendingBankruptcyAction)
			return ok && got.SpaceID == 39 && got.Amount == 1700
		}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			data := []byte(`{"phase":"resolving","players":[],"turnOrder":[],"board":[],"chanceDeck":[],"communityDeck":[],"pendingAction":` + test.json + `}`)
			var state GameState
			if err := json.Unmarshal(data, &state); err != nil {
				t.Fatalf("unmarshal seeded resolving state: %v", err)
			}
			if state.PendingAction == nil || !test.want(*state.PendingAction) {
				t.Fatalf("pendingAction = %#v", state.PendingAction)
			}
		})
	}
}

func TestSpaceJSONRoundTrip(t *testing.T) {
	owner := 1
	price := 200
	color := "brown"
	s := Space{
		ID:        1,
		Type:      SpaceTypeProperty,
		Price:     &price,
		Rent:      []int{10, 30, 90, 270},
		HouseCost: []int{50, 50},
		Color:     &color,
		Owner:     &owner,
		Houses:    2,
		Mortgaged: false,
	}

	data, err := json.Marshal(s)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var s2 Space
	if err := json.Unmarshal(data, &s2); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if s2.ID != s.ID {
		t.Errorf("ID: got %d, want %d", s2.ID, s.ID)
	}
	if s2.Type != s.Type {
		t.Errorf("Type: got %q, want %q", s2.Type, s.Type)
	}
	if s2.Price == nil || *s2.Price != *s.Price {
		t.Errorf("Price: got %v, want %v", s2.Price, s.Price)
	}
	if len(s2.Rent) != len(s.Rent) {
		t.Errorf("Rent len: got %d, want %d", len(s2.Rent), len(s.Rent))
	}
	if s2.Owner == nil || *s2.Owner != *s.Owner {
		t.Errorf("Owner: got %v, want %v", s2.Owner, s.Owner)
	}
	if s2.Color == nil || *s2.Color != *s.Color {
		t.Errorf("Color: got %v, want %v", s2.Color, s.Color)
	}
	if s2.Houses != s.Houses {
		t.Errorf("Houses: got %d, want %d", s2.Houses, s.Houses)
	}
	if s2.Mortgaged != s.Mortgaged {
		t.Errorf("Mortgaged: got %v, want %v", s2.Mortgaged, s.Mortgaged)
	}
}

func TestSpaceNullOwnerJSON(t *testing.T) {
	s := Space{
		ID:   5,
		Type: SpaceTypeGo,
	}
	data, err := json.Marshal(s)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	var s2 Space
	if err := json.Unmarshal(data, &s2); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if s2.Owner != nil {
		t.Errorf("Owner: got %v, want nil", s2.Owner)
	}
	if s2.Price != nil {
		t.Errorf("Price: got %v, want nil", s2.Price)
	}
}

func TestPlayerJSONIncludesZeroGetOutOfJailFreeCards(t *testing.T) {
	data, err := json.Marshal(Player{Properties: []int{}, Avatar: NewPresetAvatarData("cat")})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	var raw map[string]interface{}
	if err := json.Unmarshal(data, &raw); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	value, ok := raw["getOutOfJailFreeCards"]
	if !ok || value != float64(0) {
		t.Fatalf("getOutOfJailFreeCards = %v, want 0", value)
	}
}

func TestPlayerJSONRoundTrip(t *testing.T) {
	p := Player{
		ID:                    0,
		Name:                  "Alice",
		Money:                 1500,
		Position:              0,
		Properties:            []int{1, 3, 6},
		PassedGo:              false,
		InJail:                false,
		JailTurns:             0,
		Bankrupt:              false,
		GetOutOfJailFreeCards: 1,
		IsBot:                 false,
		BotControlled:         false,
		Afk:                   false,
		Color:                 "#e74c3c",
		Avatar:                NewPresetAvatarData("cat"),
	}

	data, err := json.Marshal(p)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var raw map[string]interface{}
	if err := json.Unmarshal(data, &raw); err != nil {
		t.Fatalf("unmarshal to raw: %v", err)
	}

	if raw["name"] != "Alice" {
		t.Errorf("name: got %v, want Alice", raw["name"])
	}
	if raw["money"].(float64) != 1500 {
		t.Errorf("money: got %v, want 1500", raw["money"])
	}
	if raw["isBot"].(bool) != false {
		t.Errorf("isBot: got %v, want false", raw["isBot"])
	}
	if raw["getOutOfJailFreeCards"].(float64) != 1 {
		t.Errorf("getOutOfJailFreeCards: got %v, want 1", raw["getOutOfJailFreeCards"])
	}
	props := raw["properties"].([]interface{})
	if len(props) != 3 {
		t.Errorf("properties len: got %d, want 3", len(props))
	}
	avatar := raw["avatar"].(map[string]interface{})
	if avatar["kind"] != "preset" {
		t.Errorf("avatar.kind: got %v, want preset", avatar["kind"])
	}
	if avatar["id"] != "cat" {
		t.Errorf("avatar.id: got %v, want cat", avatar["id"])
	}
}

func TestGameStateMinimalJSON(t *testing.T) {
	gs := GameState{
		Phase:          GamePhaseSetup,
		Players:        []Player{},
		TurnOrder:      []int{},
		CurrentPlayer:  0,
		Board:          []Space{},
		ChanceDeck:     []Card{},
		CommunityDeck:  []Card{},
		FreeParkingPot: 0,
		DoublesCount:   0,
		EventLog:       []LogEntry{},
		PendingTrades:  []PendingTrade{},
		NextTradeID:    0,
		TradesEnabled:  true,
	}

	data, err := json.Marshal(gs)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var raw map[string]interface{}
	if err := json.Unmarshal(data, &raw); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if raw["phase"] != "setup" {
		t.Errorf("phase: got %v, want setup", raw["phase"])
	}
	if raw["tradesEnabled"].(bool) != true {
		t.Errorf("tradesEnabled: got %v, want true", raw["tradesEnabled"])
	}
	if raw["dice"] != nil {
		t.Errorf("dice: got %v, want nil", raw["dice"])
	}
	if raw["pendingAction"] != nil {
		t.Errorf("pendingAction: got %v, want nil", raw["pendingAction"])
	}
	if raw["lastMoveSteps"] != nil {
		t.Errorf("lastMoveSteps: got %v, want nil", raw["lastMoveSteps"])
	}
}

func TestLogEntryJSONRoundTrip(t *testing.T) {
	le := LogEntry{
		Key: LogEventKeyRolled,
		Params: map[string]interface{}{
			"amount": float64(200),
			"bot":    true,
		},
	}

	data, err := json.Marshal(le)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var le2 LogEntry
	if err := json.Unmarshal(data, &le2); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if le2.Key != le.Key {
		t.Errorf("Key: got %q, want %q", le2.Key, le.Key)
	}
	if le2.Params["amount"].(float64) != 200 {
		t.Errorf("params.amount: got %v, want 200", le2.Params["amount"])
	}
}

func TestTradeOfferJSONRoundTrip(t *testing.T) {
	to := TradeOffer{
		FromID:            0,
		ToID:              1,
		OfferProperties:   []int{3, 6},
		OfferCash:         500,
		RequestProperties: []int{9},
		RequestCash:       200,
	}

	data, err := json.Marshal(to)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var to2 TradeOffer
	if err := json.Unmarshal(data, &to2); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if to2.FromID != to.FromID {
		t.Errorf("FromID: got %d, want %d", to2.FromID, to.FromID)
	}
	if to2.ToID != to.ToID {
		t.Errorf("ToID: got %d, want %d", to2.ToID, to.ToID)
	}
	if to2.OfferCash != 500 {
		t.Errorf("OfferCash: got %d, want 500", to2.OfferCash)
	}
	if len(to2.OfferProperties) != 2 {
		t.Errorf("OfferProperties len: got %d, want 2", len(to2.OfferProperties))
	}
}

func TestPendingTradeEmbedsTradeOffer(t *testing.T) {
	pt := PendingTrade{
		ID: 42,
		TradeOffer: TradeOffer{
			FromID:    0,
			ToID:      1,
			OfferCash: 100,
		},
	}

	data, err := json.Marshal(pt)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var raw map[string]interface{}
	if err := json.Unmarshal(data, &raw); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if raw["id"].(float64) != 42 {
		t.Errorf("id: got %v, want 42", raw["id"])
	}
	if raw["fromId"].(float64) != 0 {
		t.Errorf("fromId: got %v, want 0", raw["fromId"])
	}
	if raw["offerCash"].(float64) != 100 {
		t.Errorf("offerCash: got %v, want 100", raw["offerCash"])
	}
}

func TestReconnectGraceJSONRoundTrip(t *testing.T) {
	rg := ReconnectGrace{PlayerID: 2, Until: 1700000000}
	data, err := json.Marshal(rg)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	var rg2 ReconnectGrace
	if err := json.Unmarshal(data, &rg2); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if rg2.PlayerID != 2 || rg2.Until != 1700000000 {
		t.Errorf("got %+v, want {PlayerID:2 Until:1700000000}", rg2)
	}
}

func TestCardJSONRoundTrip(t *testing.T) {
	c := Card{
		ID:   5,
		Type: CardTypeChance,
		Effect: CardEffectCollect{
			Action: CardActionTypeCollect,
			Amount: 200,
		},
	}
	data, err := json.Marshal(c)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	var raw map[string]interface{}
	if err := json.Unmarshal(data, &raw); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if raw["id"].(float64) != 5 {
		t.Errorf("id: got %v, want 5", raw["id"])
	}
	if raw["type"] != "chance" {
		t.Errorf("type: got %v, want chance", raw["type"])
	}
	effect := raw["effect"].(map[string]interface{})
	if effect["action"] != "collect" {
		t.Errorf("effect.action: got %v, want collect", effect["action"])
	}
	if effect["amount"].(float64) != 200 {
		t.Errorf("effect.amount: got %v, want 200", effect["amount"])
	}
}
