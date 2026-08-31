package botusecase

import "monopoly-game-backend/internal/entity"

type BotEmotion struct {
	PlayerID int             `json:"playerId"`
	Emoticon entity.Emoticon `json:"emoticon"`
}

func DetectBotEmotions(prev, next entity.GameState) []BotEmotion {
	start := len(prev.EventLog)
	emotions := make([]BotEmotion, 0)
	if start > len(next.EventLog) {
		return emotions
	}
	for _, entry := range next.EventLog[start:] {
		params := entry.Params
		switch entry.Key {
		case entity.LogEventKeyBankruptcy:
			if id := playerIDByName(next, stringParam(params, "name")); id >= 0 && isBotControlled(next, id) {
				emotions = append(emotions, BotEmotion{PlayerID: id, Emoticon: entity.EmoticonSad})
			}
		case entity.LogEventKeyPaidRent:
			id := playerIDByName(next, stringParam(params, "name"))
			if id >= 0 && isBotControlled(next, id) && numberParam(params, "amount") >= entity.EXPENSIVE_RENT_THRESHOLD {
				emotions = append(emotions, BotEmotion{PlayerID: id, Emoticon: entity.EmoticonAngry})
			}
		case entity.LogEventKeyMonopolyRent:
			if id := playerIDByName(next, stringParam(params, "owner")); id >= 0 && isBotControlled(next, id) {
				emotions = append(emotions, BotEmotion{PlayerID: id, Emoticon: entity.EmoticonProud})
			}
		case entity.LogEventKeyTradeAccepted:
			for _, name := range []string{stringParam(params, "from"), stringParam(params, "to")} {
				if id := playerIDByName(next, name); id >= 0 && isBotControlled(next, id) {
					emotions = append(emotions, BotEmotion{PlayerID: id, Emoticon: entity.EmoticonHappy})
				}
			}
		case entity.LogEventKeyDoublesAgain:
			if id := playerIDByName(next, stringParam(params, "name")); id >= 0 && isBotControlled(next, id) {
				emotions = append(emotions, BotEmotion{PlayerID: id, Emoticon: entity.EmoticonHappy})
			}
		}
	}
	return emotions
}

func isBotControlled(state entity.GameState, playerID int) bool {
	if playerID < 0 || playerID >= len(state.Players) {
		return false
	}
	player := state.Players[playerID]
	return player.IsBot || player.BotControlled
}

func playerIDByName(state entity.GameState, name string) int {
	if name == "" {
		return -1
	}
	for id, player := range state.Players {
		if player.Name == name {
			return id
		}
	}
	return -1
}

func stringParam(params map[string]interface{}, key string) string {
	if params == nil {
		return ""
	}
	value, ok := params[key].(string)
	if !ok {
		return ""
	}
	return value
}

func numberParam(params map[string]interface{}, key string) int {
	if params == nil {
		return 0
	}
	switch value := params[key].(type) {
	case int:
		return value
	case int8:
		return int(value)
	case int16:
		return int(value)
	case int32:
		return int(value)
	case int64:
		return int(value)
	case uint:
		return int(value)
	case uint8:
		return int(value)
	case uint16:
		return int(value)
	case uint32:
		return int(value)
	case uint64:
		return int(value)
	case float32:
		return int(value)
	case float64:
		return int(value)
	default:
		return 0
	}
}
