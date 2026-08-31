package botusecase

import (
	"monopoly-game-backend/internal/data"
	"monopoly-game-backend/internal/entity"
)

const BUILD_CASH_RESERVE = data.StartingMoney / 10

const (
	houseMultiplierTradeSurplus = 1.1
	lowCashTradeSurplus         = 2.0
	monopolyGainBonus           = 0.5
	monopolyLossPenalty         = 1.0
)

var buyableTypes = map[entity.SpaceType]bool{
	entity.SpaceTypeProperty: true,
	entity.SpaceTypeRailroad: true,
	entity.SpaceTypeUtility:  true,
}

func DecideBotAction(state entity.GameState) entity.GameAction {
	if state.CurrentPlayer < 0 || state.CurrentPlayer >= len(state.Players) {
		return nil
	}
	player := state.Players[state.CurrentPlayer]
	if (!player.IsBot && !player.BotControlled) || state.Phase == entity.GamePhaseGameOver {
		return nil
	}

	if state.PendingAction != nil {
		switch pending := (*state.PendingAction).(type) {
		case entity.PendingBuyPropertyAction:
			if pending.SpaceID >= 0 && pending.SpaceID < len(state.Board) {
				space := state.Board[pending.SpaceID]
				price := 0
				if space.Price != nil {
					price = *space.Price
				}
				if player.Money >= price {
					return entity.BuyPropertyAction{Type: entity.GameActionTypeBuyProperty}
				}
			}
			return entity.DeclineBuyAction{Type: entity.GameActionTypeDeclineBuy}
		case entity.PendingPayRentAction:
			if player.Money >= pending.Amount {
				return entity.PayRentAction{Type: entity.GameActionTypePayRent}
			}
			return liquidationAction(state)
		case entity.PendingDrawCardAction:
			return entity.DrawCardAction{Type: entity.GameActionTypeDrawCard}
		case entity.PendingCardEffectAction:
			return entity.ResolveCardAction{Type: entity.GameActionTypeResolveCard}
		case entity.PendingBankruptcyAction:
			return entity.DeclareBankruptcyAction{Type: entity.GameActionTypeDeclareBankruptcy}
		}
		return nil
	}

	if state.Phase != entity.GamePhaseWaiting {
		return nil
	}
	if player.InJail {
		if player.GetOutOfJailFreeCards > 0 {
			return entity.UseGetOutOfJailFreeAction{Type: entity.GameActionTypeUseGetOutOfJailFree}
		}
		if player.Money >= data.JailFine {
			return entity.PayJailFineAction{Type: entity.GameActionTypePayJailFine}
		}
		return entity.RollDiceAction{Type: entity.GameActionTypeRollDice}
	}
	if state.Dice == nil {
		return entity.RollDiceAction{Type: entity.GameActionTypeRollDice}
	}
	if action := buildAction(state); action != nil {
		return action
	}
	return entity.EndTurnAction{Type: entity.GameActionTypeEndTurn}
}

func buildAction(state entity.GameState) entity.GameAction {
	if state.CurrentPlayer < 0 || state.CurrentPlayer >= len(state.Players) {
		return nil
	}
	player := state.Players[state.CurrentPlayer]
	if player.Position < 0 || player.Position >= len(state.Board) {
		return nil
	}
	space := state.Board[player.Position]
	if space.Type != entity.SpaceTypeProperty || space.Owner == nil || *space.Owner != state.CurrentPlayer {
		return nil
	}
	if space.Houses >= data.MaxHouses || space.Mortgaged || (state.JustBoughtSpaceID != nil && space.ID == *state.JustBoughtSpaceID) {
		return nil
	}
	if state.BuiltThisStop && !isLandScarce(state) {
		return nil
	}
	cost := data.GetHouseCost(space, space.Houses)
	if cost == 0 || player.Money < cost {
		return nil
	}
	if isLandScarce(state) && player.Money-cost < BUILD_CASH_RESERVE {
		return nil
	}
	return entity.BuildHouseAction{Type: entity.GameActionTypeBuildHouse, SpaceID: space.ID}
}

func isLandScarce(state entity.GameState) bool {
	buyable, unowned := 0, 0
	for _, space := range state.Board {
		if !buyableTypes[space.Type] {
			continue
		}
		buyable++
		if space.Owner == nil {
			unowned++
		}
	}
	return unowned*4 < buyable
}

func liquidationAction(state entity.GameState) entity.GameAction {
	if state.CurrentPlayer >= 0 && state.CurrentPlayer < len(state.Players) {
		player := state.Players[state.CurrentPlayer]
		for _, id := range player.Properties {
			if id >= 0 && id < len(state.Board) && state.Board[id].Houses > 0 {
				return entity.SellHouseAction{Type: entity.GameActionTypeSellHouse, SpaceID: id}
			}
		}
		for _, id := range player.Properties {
			if id >= 0 && id < len(state.Board) && !state.Board[id].Mortgaged && state.Board[id].Houses == 0 {
				return entity.MortgageAction{Type: entity.GameActionTypeMortgage, SpaceID: id}
			}
		}
	}
	return entity.DeclareBankruptcyAction{Type: entity.GameActionTypeDeclareBankruptcy}
}

func propertyValue(space entity.Space, houseCost int) float64 {
	price := 0
	if space.Price != nil {
		price = *space.Price
	}
	multiplier := 1.0
	if space.Houses >= 1 && space.Houses <= 3 {
		multiplier = []float64{1.3, 1.6, 2}[space.Houses-1]
	} else if space.Houses >= 4 {
		multiplier = 2.5
	}
	return float64(price) + float64(space.Houses*houseCost)*multiplier
}

func tradeValue(state entity.GameState, ids []int, cash int) float64 {
	total := float64(cash)
	for _, id := range ids {
		if id >= 0 && id < len(state.Board) {
			space := state.Board[id]
			total += propertyValue(space, data.GetHouseCost(space, 0))
		}
	}
	return total
}

func monopolyBonus(state entity.GameState, offered, requested []int, playerID int) float64 {
	bonus := 0.0
	for _, id := range offered {
		if id < 0 || id >= len(state.Board) {
			continue
		}
		space := state.Board[id]
		if space.Type != entity.SpaceTypeProperty || space.Color == nil {
			continue
		}
		set := make([]entity.Space, 0)
		for _, candidate := range state.Board {
			if candidate.Type == entity.SpaceTypeProperty && candidate.Color != nil && *candidate.Color == *space.Color {
				set = append(set, candidate)
			}
		}
		ownedAfter := 0
		for _, candidate := range set {
			if (candidate.Owner != nil && *candidate.Owner == playerID || contains(offered, candidate.ID)) && !contains(requested, candidate.ID) {
				ownedAfter++
			}
		}
		if ownedAfter == len(set) && anyOwnerNot(candidateSet(set), playerID) {
			bonus += monopolyGainBonus * propertyValue(space, data.GetHouseCost(space, 0))
		}
	}
	return bonus
}

func monopolyPenalty(state entity.GameState, requested []int, playerID int) float64 {
	penalty := 0.0
	for _, id := range requested {
		if id < 0 || id >= len(state.Board) {
			continue
		}
		space := state.Board[id]
		if space.Type != entity.SpaceTypeProperty || space.Color == nil {
			continue
		}
		setSize, owned := 0, 0
		for _, candidate := range state.Board {
			if candidate.Type == entity.SpaceTypeProperty && candidate.Color != nil && *candidate.Color == *space.Color {
				setSize++
				if candidate.Owner != nil && *candidate.Owner == playerID {
					owned++
				}
			}
		}
		if owned == setSize {
			penalty += monopolyLossPenalty * propertyValue(space, data.GetHouseCost(space, 0))
		}
	}
	return penalty
}

func ShouldAcceptTrade(state entity.GameState, offer entity.TradeOffer) bool {
	if offer.ToID < 0 || offer.ToID >= len(state.Players) {
		return false
	}
	bot := state.Players[offer.ToID]
	received := tradeValue(state, offer.OfferProperties, offer.OfferCash) + monopolyBonus(state, offer.OfferProperties, offer.RequestProperties, bot.ID)
	given := tradeValue(state, offer.RequestProperties, offer.RequestCash) + monopolyPenalty(state, offer.RequestProperties, bot.ID)
	if bot.Money+offer.OfferCash-offer.RequestCash < BUILD_CASH_RESERVE {
		return received > given*lowCashTradeSurplus
	}
	return received > given*houseMultiplierTradeSurplus
}

func contains(ids []int, id int) bool {
	for _, candidate := range ids {
		if candidate == id {
			return true
		}
	}
	return false
}

func candidateSet(set []entity.Space) []entity.Space { return set }

func anyOwnerNot(set []entity.Space, playerID int) bool {
	for _, space := range set {
		if space.Owner == nil || *space.Owner != playerID {
			return true
		}
	}
	return false
}
