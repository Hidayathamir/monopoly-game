package gameusecase

import "monopoly-game-backend/internal/entity"

func ActorEntry(key entity.LogEventKey, player entity.Player, extra map[string]interface{}) entity.LogEntry {
	params := map[string]interface{}{
		"name": player.Name,
	}
	if player.BotControlled {
		params[entity.LogParamKeyBot] = true
	}
	for k, v := range extra {
		params[k] = v
	}
	return entity.LogEntry{Key: key, Params: params}
}

func TurnEntry(players []entity.Player, nextID int) entity.LogEntry {
	p := players[nextID]
	params := map[string]interface{}{
		"name": p.Name,
	}
	if p.BotControlled {
		params[entity.LogParamKeyBot] = true
	}
	return entity.LogEntry{Key: entity.LogEventKeyTurn, Params: params}
}
