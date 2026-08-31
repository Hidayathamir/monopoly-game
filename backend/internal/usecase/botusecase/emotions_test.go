package botusecase

import (
	"reflect"
	"testing"

	"monopoly-game-backend/internal/data"
	"monopoly-game-backend/internal/entity"
)

func emotionTestState() entity.GameState {
	return entity.GameState{
		Players: []entity.Player{
			{ID: 0, Name: "Alice"},
			{ID: 1, Name: "Bob", IsBot: true},
		},
		EventLog: []entity.LogEntry{},
	}
}

func emotionPlayersWith(options func([]entity.Player) []entity.Player) []entity.Player {
	return options(emotionTestState().Players)
}

func TestDetectBotEmotions(t *testing.T) {
	cases := []struct {
		name string
		prev entity.GameState
		next entity.GameState
		want []BotEmotion
	}{
		{
			name: "bot bankruptcy is sad",
			prev: emotionTestState(),
			next: entity.GameState{Players: emotionTestState().Players, EventLog: []entity.LogEntry{{Key: entity.LogEventKeyBankruptcy, Params: map[string]interface{}{"name": "Bob"}}}},
			want: []BotEmotion{{PlayerID: 1, Emoticon: entity.EmoticonSad}},
		},
		{
			name: "human bankruptcy is ignored",
			prev: emotionTestState(),
			next: entity.GameState{Players: emotionTestState().Players, EventLog: []entity.LogEntry{{Key: entity.LogEventKeyBankruptcy, Params: map[string]interface{}{"name": "Alice"}}}},
			want: []BotEmotion{},
		},
		{
			name: "expensive rent is angry",
			prev: emotionTestState(),
			next: entity.GameState{Players: emotionTestState().Players, EventLog: []entity.LogEntry{{Key: entity.LogEventKeyPaidRent, Params: map[string]interface{}{"name": "Bob", "amount": data.StartingMoney / 5}}}},
			want: []BotEmotion{{PlayerID: 1, Emoticon: entity.EmoticonAngry}},
		},
		{
			name: "rent below threshold is ignored",
			prev: emotionTestState(),
			next: entity.GameState{Players: emotionTestState().Players, EventLog: []entity.LogEntry{{Key: entity.LogEventKeyPaidRent, Params: map[string]interface{}{"name": "Bob", "amount": entity.EXPENSIVE_RENT_THRESHOLD - 1}}}},
			want: []BotEmotion{},
		},
		{
			name: "monopoly rent is proud",
			prev: emotionTestState(),
			next: entity.GameState{Players: emotionTestState().Players, EventLog: []entity.LogEntry{{Key: entity.LogEventKeyMonopolyRent, Params: map[string]interface{}{"owner": "Bob"}}}},
			want: []BotEmotion{{PlayerID: 1, Emoticon: entity.EmoticonProud}},
		},
		{
			name: "accepted trade makes each bot party happy",
			prev: emotionTestState(),
			next: entity.GameState{Players: emotionPlayersWith(func(players []entity.Player) []entity.Player { players[0].IsBot = true; return players }), EventLog: []entity.LogEntry{{Key: entity.LogEventKeyTradeAccepted, Params: map[string]interface{}{"from": "Alice", "to": "Bob"}}}},
			want: []BotEmotion{{PlayerID: 0, Emoticon: entity.EmoticonHappy}, {PlayerID: 1, Emoticon: entity.EmoticonHappy}},
		},
		{
			name: "bot controlled bankruptcy is sad",
			prev: emotionTestState(),
			next: entity.GameState{Players: emotionPlayersWith(func(players []entity.Player) []entity.Player { players[0].BotControlled = true; return players }), EventLog: []entity.LogEntry{{Key: entity.LogEventKeyBankruptcy, Params: map[string]interface{}{"name": "Alice"}}}},
			want: []BotEmotion{{PlayerID: 0, Emoticon: entity.EmoticonSad}},
		},
		{
			name: "doubles makes bot happy",
			prev: emotionTestState(),
			next: entity.GameState{Players: emotionTestState().Players, EventLog: []entity.LogEntry{{Key: entity.LogEventKeyDoublesAgain, Params: map[string]interface{}{"name": "Bob"}}}},
			want: []BotEmotion{{PlayerID: 1, Emoticon: entity.EmoticonHappy}},
		},
		{
			name: "unrelated events are ignored",
			prev: emotionTestState(),
			next: entity.GameState{Players: emotionTestState().Players, EventLog: []entity.LogEntry{{Key: entity.LogEventKeyRolled, Params: map[string]interface{}{"name": "Bob"}}, {Key: entity.LogEventKeyTurn, Params: map[string]interface{}{"name": "Alice"}}}},
			want: []BotEmotion{},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := DetectBotEmotions(tc.prev, tc.next); !reflect.DeepEqual(got, tc.want) {
				t.Fatalf("DetectBotEmotions() = %#v, want %#v", got, tc.want)
			}
		})
	}
}

func TestDetectBotEmotionsUsesOnlyNewEntriesAndHandlesMalformedParams(t *testing.T) {
	prev := emotionTestState()
	prev.EventLog = []entity.LogEntry{{Key: entity.LogEventKeyBankruptcy, Params: map[string]interface{}{"name": "Bob"}}}
	next := prev
	next.EventLog = append(append([]entity.LogEntry{}, prev.EventLog...), entity.LogEntry{Key: entity.LogEventKeyPaidRent, Params: map[string]interface{}{"name": "Bob", "amount": "300"}})
	if got := DetectBotEmotions(prev, next); !reflect.DeepEqual(got, []BotEmotion{}) {
		t.Fatalf("malformed or old entries produced emotions: %#v", got)
	}
}
