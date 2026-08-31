package gameusecase

import (
	"monopoly-game-backend/internal/data"
	"monopoly-game-backend/internal/entity"
)

type CardResolution struct {
	State entity.GameState
	Log   []entity.LogEntry
}

func ResolveCardEffect(state entity.GameState, card entity.Card) CardResolution {
	effect := card.Effect
	player := state.Players[state.CurrentPlayer]

	switch e := effect.(type) {
	case entity.CardEffectCollect:
		state = UpdatePlayerMoney(state, state.CurrentPlayer, e.Amount)
		return CardResolution{
			State: state,
			Log:   []entity.LogEntry{ActorEntry(entity.LogEventKeyCardCollect, player, map[string]interface{}{entity.LogParamKeyCardId: card.ID, entity.LogParamKeyAmount: e.Amount})},
		}
	case entity.CardEffectPay:
		state = AddToFreeParking(state, e.Amount)
		state = UpdatePlayerMoney(state, state.CurrentPlayer, -e.Amount)
		return CardResolution{
			State: state,
			Log:   []entity.LogEntry{ActorEntry(entity.LogEventKeyCardPay, player, map[string]interface{}{entity.LogParamKeyCardId: card.ID, entity.LogParamKeyAmount: e.Amount})},
		}
	case entity.CardEffectGoToJail:
		state = SendPlayerToJail(state, state.CurrentPlayer)
		return CardResolution{
			State: state,
			Log:   []entity.LogEntry{ActorEntry(entity.LogEventKeyCardToJail, player, map[string]interface{}{entity.LogParamKeyCardId: card.ID})},
		}
	case entity.CardEffectGetOutOfJailFree:
		newPlayers := make([]entity.Player, len(state.Players))
		copy(newPlayers, state.Players)
		newPlayers[state.CurrentPlayer] = state.Players[state.CurrentPlayer]
		newPlayers[state.CurrentPlayer].GetOutOfJailFreeCards++
		state.Players = newPlayers
		return CardResolution{
			State: state,
			Log:   []entity.LogEntry{ActorEntry(entity.LogEventKeyGotJailCard, player, map[string]interface{}{entity.LogParamKeyCardId: card.ID})},
		}
	case entity.CardEffectGoToSpace:
		isBackward := e.SpaceID < 0
		targetSpace := e.SpaceID
		if isBackward {
			targetSpace = (player.Position + e.SpaceID + data.BoardSize) % data.BoardSize
		}
		return GoToSpace(state, state.CurrentPlayer, targetSpace, isBackward, card.ID)
	case entity.CardEffectCollectFromPlayers:
		amount := e.Amount
		actualReceived := 0
		payingPlayers := 0
		newPlayers := make([]entity.Player, len(state.Players))
		copy(newPlayers, state.Players)
		for i := range newPlayers {
			if i == state.CurrentPlayer {
				continue
			}
			paid := min(max(0, newPlayers[i].Money), amount)
			if paid > 0 {
				payingPlayers++
			}
			actualReceived += paid
			newPlayers[i].Money -= paid
		}
		newPlayers[state.CurrentPlayer].Money += actualReceived
		state.Players = newPlayers
		return CardResolution{
			State: state,
			Log:   []entity.LogEntry{ActorEntry(entity.LogEventKeyCardCollectPlayers, player, map[string]interface{}{entity.LogParamKeyCardId: card.ID, entity.LogParamKeyAmount: actualReceived, entity.LogParamKeyPerPlayer: amount, "playerCount": payingPlayers})},
		}
	case entity.CardEffectPayToPlayers:
		payAmount := e.Amount
		remainingMoney := state.Players[state.CurrentPlayer].Money
		totalPaid := 0
		paidPlayers := 0
		newPlayers := make([]entity.Player, len(state.Players))
		copy(newPlayers, state.Players)
		for i := range newPlayers {
			if i == state.CurrentPlayer {
				continue
			}
			pay := min(payAmount, remainingMoney)
			if pay > 0 {
				paidPlayers++
			}
			totalPaid += pay
			remainingMoney -= pay
			newPlayers[i].Money += pay
		}
		newPlayers[state.CurrentPlayer].Money = remainingMoney
		state.Players = newPlayers
		return CardResolution{
			State: state,
			Log:   []entity.LogEntry{ActorEntry(entity.LogEventKeyCardPayPlayers, player, map[string]interface{}{entity.LogParamKeyCardId: card.ID, entity.LogParamKeyAmount: totalPaid, entity.LogParamKeyPerPlayer: payAmount, "playerCount": paidPlayers})},
		}
	case entity.CardEffectStreetRepairs:
		totalRepairs := 0
		houseCount := 0
		hotelCount := 0
		for _, pid := range player.Properties {
			if pid < 0 || pid >= len(state.Board) {
				continue
			}
			space := state.Board[pid]
			if space.Houses == data.MaxHouses {
				hotelCount++
				totalRepairs += e.PerHotel
			} else {
				houseCount += space.Houses
				totalRepairs += space.Houses * e.PerHouse
			}
		}
		state = AddToFreeParking(state, totalRepairs)
		state = UpdatePlayerMoney(state, state.CurrentPlayer, -totalRepairs)
		return CardResolution{
			State: state,
			Log:   []entity.LogEntry{ActorEntry(entity.LogEventKeyCardStreetRepairs, player, map[string]interface{}{entity.LogParamKeyCardId: card.ID, entity.LogParamKeyAmount: totalRepairs, "houseCount": houseCount, "hotelCount": hotelCount, entity.LogParamKeyPerHouse: e.PerHouse, entity.LogParamKeyPerHotel: e.PerHotel})},
		}
	default:
		return CardResolution{State: state, Log: nil}
	}
}

func GoToSpace(state entity.GameState, playerIndex int, spaceID int, isBackward bool, cardID int) CardResolution {
	player := state.Players[playerIndex]
	log := []entity.LogEntry{}

	passesGo := !isBackward && spaceID < player.Position
	if passesGo {
		state = UpdatePlayerMoney(state, playerIndex, data.GoSalary)
		state = SetPlayerPassedGo(state, playerIndex)
		log = append(log, ActorEntry(entity.LogEventKeyPassedGo, player, map[string]interface{}{entity.LogParamKeyAmount: data.GoSalary}))
	}

	steps := 0
	if isBackward {
		steps = -((player.Position - spaceID + data.BoardSize) % data.BoardSize)
	} else {
		steps = (spaceID - player.Position + data.BoardSize) % data.BoardSize
	}

	newPlayers := make([]entity.Player, len(state.Players))
	copy(newPlayers, state.Players)
	newPlayers[playerIndex].Position = spaceID
	state.Players = newPlayers
	state.LastMoveSteps = &steps

	logKey := entity.LogEventKeyMovedForward
	if isBackward {
		logKey = entity.LogEventKeyMovedBack
	}
	log = append(log, ActorEntry(logKey, player, map[string]interface{}{entity.LogParamKeySpaceId: spaceID, entity.LogParamKeyCardId: cardID}))

	return CardResolution{State: state, Log: log}
}

func SetPlayerPassedGo(state entity.GameState, playerIndex int) entity.GameState {
	newPlayers := make([]entity.Player, len(state.Players))
	copy(newPlayers, state.Players)
	newPlayers[playerIndex].PassedGo = true
	state.Players = newPlayers
	return state
}

func UpdatePlayerMoney(state entity.GameState, playerIndex int, amount int) entity.GameState {
	newPlayers := make([]entity.Player, len(state.Players))
	copy(newPlayers, state.Players)
	newPlayers[playerIndex].Money += amount
	state.Players = newPlayers
	return state
}

func AddToFreeParking(state entity.GameState, amount int) entity.GameState {
	state.FreeParkingPot += amount
	return state
}

func SendPlayerToJail(state entity.GameState, playerIndex int) entity.GameState {
	newPlayers := make([]entity.Player, len(state.Players))
	copy(newPlayers, state.Players)
	newPlayers[playerIndex].Position = data.JailSpace
	newPlayers[playerIndex].InJail = true
	newPlayers[playerIndex].JailTurns = 0
	state.Players = newPlayers
	state.LastMoveSteps = nil
	return state
}
