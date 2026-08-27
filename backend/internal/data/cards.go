package data

import (
	"encoding/json"
	"fmt"
	canonicaldata "monopoly-game-backend/data"
	"monopoly-game-backend/internal/entity"
)

var cardsDataJSON = canonicaldata.CardsDataJSON()

type rawCardEffect struct {
	Action   string `json:"action"`
	Amount   int    `json:"amount,omitempty"`
	SpaceID  int    `json:"spaceId,omitempty"`
	PerHouse int    `json:"perHouse,omitempty"`
	PerHotel int    `json:"perHotel,omitempty"`
}

type rawCard struct {
	ID     int           `json:"id"`
	Effect rawCardEffect `json:"effect"`
}

type cardsData struct {
	Chance    []rawCard `json:"chance"`
	Community []rawCard `json:"community"`
}

func toCardEffect(raw rawCardEffect) entity.CardEffect {
	switch raw.Action {
	case entity.CardActionTypeCollect:
		return entity.CardEffectCollect{Action: entity.CardActionTypeCollect, Amount: raw.Amount}
	case entity.CardActionTypePay:
		return entity.CardEffectPay{Action: entity.CardActionTypePay, Amount: raw.Amount}
	case entity.CardActionTypeGoToJail:
		return entity.CardEffectGoToJail{Action: entity.CardActionTypeGoToJail}
	case entity.CardActionTypeGetOutOfJailFree:
		return entity.CardEffectGetOutOfJailFree{Action: entity.CardActionTypeGetOutOfJailFree}
	case entity.CardActionTypeGoToSpace:
		return entity.CardEffectGoToSpace{Action: entity.CardActionTypeGoToSpace, SpaceID: raw.SpaceID}
	case entity.CardActionTypeCollectFromPlayers:
		return entity.CardEffectCollectFromPlayers{Action: entity.CardActionTypeCollectFromPlayers, Amount: raw.Amount}
	case entity.CardActionTypePayToPlayers:
		return entity.CardEffectPayToPlayers{Action: entity.CardActionTypePayToPlayers, Amount: raw.Amount}
	case entity.CardActionTypeStreetRepairs:
		return entity.CardEffectStreetRepairs{Action: entity.CardActionTypeStreetRepairs, PerHouse: raw.PerHouse, PerHotel: raw.PerHotel}
	default:
		panic(fmt.Sprintf("unknown card action: %s", raw.Action))
	}
}

func toCards(raws []rawCard, cardType entity.CardType) []entity.Card {
	cards := make([]entity.Card, len(raws))
	for i, raw := range raws {
		cards[i] = entity.Card{
			ID:     raw.ID,
			Type:   cardType,
			Effect: toCardEffect(raw.Effect),
		}
	}
	return cards
}

func loadCards() (cardsData, error) {
	var data cardsData
	if err := json.Unmarshal(cardsDataJSON, &data); err != nil {
		return cardsData{}, fmt.Errorf("failed to unmarshal cards-data.json: %w", err)
	}
	return data, nil
}

func mustLoadCards() cardsData {
	data, err := loadCards()
	if err != nil {
		panic(err.Error())
	}
	return data
}

//go:noinline
func init() {
	data := mustLoadCards()
	CHANCE_CARDS = toCards(data.Chance, entity.CardTypeChance)
	COMMUNITY_CARDS = toCards(data.Community, entity.CardTypeCommunity)
}

var (
	CHANCE_CARDS    []entity.Card
	COMMUNITY_CARDS []entity.Card
)
