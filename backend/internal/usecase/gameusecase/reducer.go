package gameusecase

import (
	"math/rand"
	"monopoly-game-backend/internal/data"
	"monopoly-game-backend/internal/entity"
)

type InitialStateOptions struct{ TradesEnabled bool }

func CreateInitialState(opts ...InitialStateOptions) entity.GameState {
	chance := append([]entity.Card(nil), data.CHANCE_CARDS...)
	community := append([]entity.Card(nil), data.COMMUNITY_CARDS...)
	rand.Shuffle(len(chance), func(i, j int) { chance[i], chance[j] = chance[j], chance[i] })
	rand.Shuffle(len(community), func(i, j int) { community[i], community[j] = community[j], community[i] })
	trades := false
	if len(opts) > 0 {
		trades = opts[0].TradesEnabled
	}
	return entity.GameState{Phase: entity.GamePhaseSetup, Players: []entity.Player{}, TurnOrder: []int{}, Board: data.CreateInitialBoard(), ChanceDeck: chance, CommunityDeck: community, EventLog: []entity.LogEntry{}, PendingTrades: []entity.PendingTrade{}, TradesEnabled: trades}
}

func pending(v entity.PendingAction) *entity.PendingAction { return &v }
func nextPlayer(s entity.GameState) int {
	order := s.TurnOrder
	if len(order) == 0 {
		order = make([]int, len(s.Players))
		for i := range order {
			order[i] = i
		}
	}
	idx := -1
	for i, id := range order {
		if id == s.CurrentPlayer {
			idx = i
			break
		}
	}
	for i := 1; i <= len(order); i++ {
		id := order[(idx+i+len(order))%len(order)]
		if id >= 0 && id < len(s.Players) && !s.Players[id].Bankrupt {
			return id
		}
	}
	return s.CurrentPlayer
}
func clonePlayers(p []entity.Player) []entity.Player {
	q := make([]entity.Player, len(p))
	for i, player := range p {
		q[i] = player
		if player.Properties == nil {
			q[i].Properties = []int{}
		}
	}
	return q
}
func cloneBoard(b []entity.Space) []entity.Space {
	q := make([]entity.Space, len(b))
	copy(q, b)
	return q
}
func ownerID(s entity.Space) (int, bool) {
	if s.Owner == nil {
		return 0, false
	}
	return *s.Owner, true
}
func setPending(s entity.GameState, v entity.PendingAction) entity.GameState {
	s.PendingAction = pending(v)
	return s
}
func clearPending(s entity.GameState) entity.GameState { s.PendingAction = nil; return s }
func appendLog(s entity.GameState, logs ...entity.LogEntry) entity.GameState {
	s.EventLog = append(append([]entity.LogEntry{}, s.EventLog...), logs...)
	return s
}
func turnLog(s entity.GameState, id int) entity.LogEntry { return TurnEntry(s.Players, id) }

func GameReducer(state entity.GameState, action entity.GameAction) entity.GameState {
	switch a := action.(type) {
	case entity.StartGameAction:
		playerSize := a.PlayerCount
		for _, playerID := range a.PlayerIDs {
			if playerID >= playerSize {
				playerSize = playerID + 1
			}
		}
		players := make([]entity.Player, playerSize)
		for i := range players {
			players[i] = entity.Player{ID: i, Name: "", Properties: []int{}, Color: data.PLAYER_COLORS[i%len(data.PLAYER_COLORS)], Avatar: entity.NewPresetAvatarData("cat")}
		}
		order := make([]int, a.PlayerCount)
		for i := range order {
			playerID := i
			if i < len(a.PlayerIDs) {
				playerID = a.PlayerIDs[i]
			}
			name := "P" + string(rune('1'+i))
			if i < len(a.Names) && a.Names[i] != "" {
				name = a.Names[i]
			}
			color := data.PLAYER_COLORS[playerID%len(data.PLAYER_COLORS)]
			if i < len(a.Colors) && a.Colors[i] != "" {
				color = a.Colors[i]
			}
			avatar := entity.NewPresetAvatarData("cat")
			if i < len(a.Avatars) && a.Avatars[i].Kind != "" {
				avatar = a.Avatars[i]
			}
			players[playerID] = entity.Player{ID: playerID, Name: name, Money: data.StartingMoney, Properties: []int{}, Color: color, Avatar: avatar, IsBot: i < len(a.IsBot) && a.IsBot[i]}
			order[i] = playerID
		}

		rand.Shuffle(len(order), func(i, j int) { order[i], order[j] = order[j], order[i] })
		state.Phase = entity.GamePhaseWaiting
		state.Players = players
		state.TurnOrder = order
		if len(order) > 0 {
			state.CurrentPlayer = order[0]
		}
		state.EventLog = []entity.LogEntry{{Key: entity.LogEventKeyGameStarted}}
		return state
	case entity.RollDiceAction:
		state.Phase = entity.GamePhaseRolling
		state.JustBoughtSpaceID = nil
		state.BuiltThisStop = false
		return state
	case entity.DiceAnimatedAction:
		return diceAnimated(state, a.Dice, a.Target, a.Luck)
	case entity.AttemptJailbreakAction:
		return diceAnimated(state, a.Dice, nil, nil)
	case entity.MoveTokenAction, entity.PassGoAction:
		return state
	case entity.ResolveSpaceAction:
		return resolveSpace(state)
	case entity.BuyPropertyAction:
		return buyPropertyReducer(state)
	case entity.DeclineBuyAction:
		state.Phase = entity.GamePhaseWaiting
		return clearPending(state)
	case entity.PayRentAction:
		return payRentReducer(state)
	case entity.BuildHouseAction:
		return buildReducer(state, a.SpaceID)
	case entity.SellHouseAction:
		return sellHouseReducer(state, a.SpaceID)
	case entity.MortgageAction:
		return mortgageReducer(state, a.SpaceID, true)
	case entity.UnmortgageAction:
		return mortgageReducer(state, a.SpaceID, false)
	case entity.SellPropertyAction:
		return sellPropertyReducer(state, a.SpaceID)
	case entity.ProposeTradeAction:
		return proposeTrade(state, a.Offer)
	case entity.AcceptTradeAction:
		return acceptTrade(state, a.TradeID)
	case entity.RejectTradeAction:
		if !state.TradesEnabled {
			return state
		}
		return removeTrade(state, a.TradeID, entity.LogEventKeyTradeRejected)
	case entity.CancelTradeAction:
		if !state.TradesEnabled {
			return state
		}
		return removeTrade(state, a.TradeID, entity.LogEventKeyTradeCancelled)
	case entity.DrawCardAction:
		return drawCard(state)
	case entity.ResolveCardAction:
		return resolveCard(state)
	case entity.CollectFreeParkingAction:
		p := state.Players[state.CurrentPlayer]
		pot := state.FreeParkingPot
		ps := clonePlayers(state.Players)
		ps[state.CurrentPlayer].Money += pot
		state.Players = ps
		state.FreeParkingPot = 0
		return appendLog(state, ActorEntry(entity.LogEventKeyFreeParkingJackpot, p, map[string]interface{}{entity.LogParamKeyAmount: pot}))
	case entity.PayJailFineAction:
		return jailExit(state, false)
	case entity.UseGetOutOfJailFreeAction:
		return jailExit(state, true)
	case entity.SkipAction:
		state.Phase = entity.GamePhaseWaiting
		return clearPending(state)
	case entity.EndTurnAction:
		if state.Dice != nil && state.Dice[0] == state.Dice[1] {
			state.Phase = entity.GamePhaseWaiting
			state.Dice = nil
			return appendLog(state, ActorEntry(entity.LogEventKeyDoublesAgain, state.Players[state.CurrentPlayer], nil))
		}
		n := nextPlayer(state)
		state.Phase = entity.GamePhaseWaiting
		state.CurrentPlayer = n
		state.Dice = nil
		state.DoublesCount = 0
		return appendLog(state, turnLog(state, n))
	case entity.DeclareBankruptcyAction:
		return bankruptcy(state)
	case entity.SetReconnectGraceAction:
		if a.Until == nil {
			state.ReconnectGrace = nil
			return state
		}
		if state.ReconnectGrace != nil && state.ReconnectGrace.PlayerID == a.PlayerID {
			return state
		}
		state.ReconnectGrace = &entity.ReconnectGrace{PlayerID: a.PlayerID, Until: *a.Until}
		if a.PlayerID < len(state.Players) {
			return appendLog(state, entity.LogEntry{Key: entity.LogEventKeyReconnectWait, Params: map[string]interface{}{"name": state.Players[a.PlayerID].Name}})
		}
		return state
	case entity.SetBotControlAction:
		if a.PlayerID < 0 || a.PlayerID >= len(state.Players) || state.Players[a.PlayerID].BotControlled == a.Controlled {
			return state
		}
		ps := clonePlayers(state.Players)
		ps[a.PlayerID].BotControlled = a.Controlled
		ps[a.PlayerID].Afk = a.Controlled && a.Reason == entity.BotControlReasonAfk
		target := state.Players[a.PlayerID]
		state.Players = ps
		if !a.Controlled && state.ReconnectGrace != nil && state.ReconnectGrace.PlayerID == a.PlayerID {
			state.ReconnectGrace = nil
		}
		key := entity.LogEventKeyPlayerOffline
		if !a.Controlled {
			key = entity.LogEventKeyPlayerBack
		} else if a.Reason == entity.BotControlReasonAfk {
			key = entity.LogEventKeyPlayerAfk
		}
		return appendLog(state, entity.LogEntry{Key: key, Params: map[string]interface{}{"name": target.Name}})
	default:
		return state
	}
}

func diceAnimated(s entity.GameState, dice [2]int, target, luck *int) entity.GameState {
	p := s.Players[s.CurrentPlayer]
	doubles := dice[0] == dice[1]
	if p.InJail {
		if doubles {
			ps := clonePlayers(s.Players)
			ps[s.CurrentPlayer].InJail = false
			ps[s.CurrentPlayer].JailTurns = 0
			total := dice[0] + dice[1]
			pos := (p.Position + total) % data.BoardSize
			passed := pos < p.Position
			if passed {
				ps[s.CurrentPlayer].Money += data.GoSalary
				ps[s.CurrentPlayer].PassedGo = true
			}
			s.Players = ps
			s.Phase = entity.GamePhaseMoving
			s.Dice = &dice
			s.DoublesCount = 0
			s.LastMoveSteps = &total
			key := entity.LogEventKeyJailBreakDoubles
			s = appendLog(s, ActorEntry(key, p, nil))
			if passed {
				s = appendLog(s, ActorEntry(entity.LogEventKeyPassedGo, p, map[string]interface{}{entity.LogParamKeyAmount: data.GoSalary}))
			}
			return s
		}
		turns := p.JailTurns + 1
		if turns >= data.MaxJailTurns {
			ps := clonePlayers(s.Players)
			total := dice[0] + dice[1]
			pos := (p.Position + total) % data.BoardSize
			passed := pos < p.Position
			ps[s.CurrentPlayer].InJail = false
			ps[s.CurrentPlayer].JailTurns = 0
			ps[s.CurrentPlayer].Position = pos
			if passed {
				ps[s.CurrentPlayer].Money += data.GoSalary
				ps[s.CurrentPlayer].PassedGo = true
			}
			s.Players = ps
			s.Phase = entity.GamePhaseMoving
			s.Dice = &dice
			s.DoublesCount = 0
			s.LastMoveSteps = &total
			s = appendLog(s, ActorEntry(entity.LogEventKeyJailForcedOut, p, nil))
			return s
		}
		ps := clonePlayers(s.Players)
		ps[s.CurrentPlayer].JailTurns = turns
		s.Players = ps
		n := nextPlayer(s)
		s.Phase = entity.GamePhaseWaiting
		s.CurrentPlayer = n
		s.Dice = nil
		s.DoublesCount = 0
		s.LastMoveSteps = nil
		return appendLog(s, ActorEntry(entity.LogEventKeyJailFailed, p, map[string]interface{}{"attempt": turns}), turnLog(s, n))
	}
	total := dice[0] + dice[1]
	pos := (p.Position + total) % data.BoardSize
	passed := p.Position != 0 && (pos < p.Position || pos == 0)
	ps := clonePlayers(s.Players)
	ps[s.CurrentPlayer].Position = pos
	if passed {
		ps[s.CurrentPlayer].Money += data.GoSalary
		ps[s.CurrentPlayer].PassedGo = true
	}
	s.Players = ps
	s.Dice = &dice
	s.LastMoveSteps = &total
	if doubles {
		s.DoublesCount++
	} else {
		s.DoublesCount = 0
	}
	params := map[string]interface{}{"d1": dice[0], "d2": dice[1], "total": total}
	key := entity.LogEventKeyRolled
	if target != nil && luck != nil {
		key = entity.LogEventKeyRolledAimed
		params["target"] = *target
		params["luck"] = *luck
	}
	s = appendLog(s, ActorEntry(key, p, params))
	if passed {
		s = appendLog(s, ActorEntry(entity.LogEventKeyPassedGo, p, map[string]interface{}{entity.LogParamKeyAmount: data.GoSalary}))
	}
	if doubles && s.DoublesCount >= 3 {
		ps = clonePlayers(s.Players)
		ps[s.CurrentPlayer].Position = data.JailSpace
		ps[s.CurrentPlayer].InJail = true
		ps[s.CurrentPlayer].JailTurns = 0
		s.Players = ps
		n := nextPlayer(s)
		s.Phase = entity.GamePhaseWaiting
		s.CurrentPlayer = n
		s.Dice = nil
		s.DoublesCount = 0
		s.LastMoveSteps = nil
		return appendLog(s, ActorEntry(entity.LogEventKeyTripleDoubles, p, nil), turnLog(s, n))
	}
	s.Phase = entity.GamePhaseMoving
	return s
}

func resolveSpace(s entity.GameState) entity.GameState {
	if s.CurrentPlayer < 0 || s.CurrentPlayer >= len(s.Players) {
		return s
	}
	p := s.Players[s.CurrentPlayer]
	if p.Position < 0 || p.Position >= len(s.Board) {
		return s
	}
	space := s.Board[p.Position]
	switch space.Type {
	case entity.SpaceTypeGo, entity.SpaceTypeJail:
		s.Phase = entity.GamePhaseWaiting
		return s
	case entity.SpaceTypeGoToJail:
		ps := clonePlayers(s.Players)
		ps[s.CurrentPlayer].Position = data.JailSpace
		ps[s.CurrentPlayer].InJail = true
		ps[s.CurrentPlayer].JailTurns = 0
		s.Players = ps
		n := nextPlayer(s)
		s.Phase = entity.GamePhaseWaiting
		s.CurrentPlayer = n
		s.Dice = nil
		s.DoublesCount = 0
		s.LastMoveSteps = nil
		return appendLog(s, ActorEntry(entity.LogEventKeyToJail, p, nil), turnLog(s, n))
	case entity.SpaceTypeFreeParking:
		pot := s.FreeParkingPot
		ps := clonePlayers(s.Players)
		ps[s.CurrentPlayer].Money += pot
		s.Players = ps
		s.FreeParkingPot = 0
		s.Phase = entity.GamePhaseWaiting
		return appendLog(s, ActorEntry(entity.LogEventKeyFreeParkingJackpot, p, map[string]interface{}{entity.LogParamKeyAmount: pot}))
	case entity.SpaceTypeTax:
		amount := 0
		if space.TaxType != nil && *space.TaxType == entity.TaxTypeIncome {
			amount = int(float64(p.Money) * data.IncomeTaxRate)
		} else if space.Price != nil {
			amount = *space.Price
		}
		ps := clonePlayers(s.Players)
		ps[s.CurrentPlayer].Money -= amount
		s.Players = ps
		s.FreeParkingPot += amount
		s.Phase = entity.GamePhaseWaiting
		key := entity.LogEventKeyLuxuryTax
		if space.TaxType != nil && *space.TaxType == entity.TaxTypeIncome {
			key = entity.LogEventKeyIncomeTax
		}
		return appendLog(s, ActorEntry(key, p, map[string]interface{}{entity.LogParamKeyAmount: amount}))
	case entity.SpaceTypeChance, entity.SpaceTypeCommunity:
		s.Phase = entity.GamePhaseResolving
		return setPending(s, entity.PendingDrawCardAction{Type: entity.PendingActionTypeDrawCard, DrawType: space.Type})
	case entity.SpaceTypeProperty, entity.SpaceTypeRailroad, entity.SpaceTypeUtility:
		owner, owned := ownerID(space)
		if owned && owner != s.CurrentPlayer && !space.Mortgaged {
			rent := CalculatePropertyRent(space, s.Dice)
			monopoly := false
			if space.Type == entity.SpaceTypeProperty {
				monopoly = IsMonopoly(owner, s.Board, space)
				if monopoly {
					rent *= 2
				}
			}
			if space.Type == entity.SpaceTypeRailroad {
				rent = CalculateRailroadRentFromBoard(owner, s.Board, space.ID)
			} else if space.Type == entity.SpaceTypeUtility {
				d := [2]int{1, 1}
				if s.Dice != nil {
					d = *s.Dice
				}
				rent = CalculateUtilityRentFromBoard(owner, s.Board, space.ID, d)
			}
			if owner < 0 || owner >= len(s.Players) {
				return s
			}
			current := s.Players[s.CurrentPlayer]
			landlord := s.Players[owner]
			if landlord.InJail {
				s.Phase = entity.GamePhaseWaiting
				return appendLog(s, entity.LogEntry{Key: entity.LogEventKeyOwnerInJail, Params: map[string]interface{}{"owner": landlord.Name, "name": current.Name}})
			}
			s.Phase = entity.GamePhaseResolving
			if monopoly {
				s = appendLog(s, entity.LogEntry{Key: entity.LogEventKeyMonopolyRent, Params: map[string]interface{}{"owner": landlord.Name, "name": current.Name}})
			}
			return setPending(s, entity.PendingPayRentAction{Type: entity.PendingActionTypePayRent, SpaceID: space.ID, Amount: rent})
		}
		if !owned {
			if !p.PassedGo {
				s.Phase = entity.GamePhaseWaiting
				return appendLog(s, ActorEntry(entity.LogEventKeyMustCircleBoard, p, nil))
			}
			s.Phase = entity.GamePhaseBuying
			return setPending(s, entity.PendingBuyPropertyAction{Type: entity.PendingActionTypeBuyProperty, SpaceID: space.ID})
		}
		s.Phase = entity.GamePhaseWaiting
		return s
	}
	s.Phase = entity.GamePhaseWaiting
	return s
}

func buyPropertyReducer(s entity.GameState) entity.GameState {
	if s.PendingAction == nil || s.CurrentPlayer < 0 || s.CurrentPlayer >= len(s.Players) {
		return s
	}
	if p, ok := (*s.PendingAction).(entity.PendingBuyPropertyAction); !ok || p.SpaceID < 0 || p.SpaceID >= len(s.Board) {
		return s
	}
	if s.PendingAction == nil {
		return s
	}
	p, ok := (*s.PendingAction).(entity.PendingBuyPropertyAction)
	if !ok {
		return s
	}
	space := s.Board[p.SpaceID]
	player := s.Players[s.CurrentPlayer]
	price := 0
	if space.Price != nil {
		price = *space.Price
	}
	if player.Money < price {
		return s
	}
	b := cloneBoard(s.Board)
	owner := s.CurrentPlayer
	b[p.SpaceID].Owner = &owner
	s.Board = b
	ps := clonePlayers(s.Players)
	ps[s.CurrentPlayer].Money -= price
	ps[s.CurrentPlayer].Properties = append(append([]int{}, player.Properties...), p.SpaceID)
	s.Players = ps
	s.Phase = entity.GamePhaseWaiting
	s.JustBoughtSpaceID = &p.SpaceID
	s = clearPending(s)
	return appendLog(s, ActorEntry(entity.LogEventKeyBought, player, map[string]interface{}{entity.LogParamKeySpaceId: space.ID, entity.LogParamKeyAmount: price}))
}
func payRentReducer(s entity.GameState) entity.GameState {
	if s.PendingAction == nil || s.CurrentPlayer < 0 || s.CurrentPlayer >= len(s.Players) {
		return s
	}
	if s.PendingAction == nil {
		return s
	}
	var spaceID, amount int
	switch p := (*s.PendingAction).(type) {
	case entity.PendingPayRentAction:
		spaceID, amount = p.SpaceID, p.Amount
	case entity.PendingBankruptcyAction:
		spaceID, amount = p.SpaceID, p.Amount
	default:
		return s
	}
	player := s.Players[s.CurrentPlayer]
	if player.Money < amount {
		s = setPending(s, entity.PendingBankruptcyAction{Type: entity.PendingActionTypeBankruptcy, SpaceID: spaceID, Amount: amount})
		return s
	}
	if spaceID < 0 || spaceID >= len(s.Board) {
		return s
	}
	owner, ok := ownerID(s.Board[spaceID])
	if !ok || owner < 0 || owner >= len(s.Players) || owner == s.CurrentPlayer {
		return s
	}
	ps := clonePlayers(s.Players)
	ps[s.CurrentPlayer].Money -= amount
	ps[owner].Money += amount
	s.Players = ps
	s.Phase = entity.GamePhaseWaiting
	s = clearPending(s)
	return appendLog(s, entity.LogEntry{Key: entity.LogEventKeyPaidRent, Params: map[string]interface{}{"name": player.Name, entity.LogParamKeyAmount: amount, "owner": s.Players[owner].Name}})
}
func buildReducer(s entity.GameState, id int) entity.GameState {
	if id < 0 || id >= len(s.Board) || s.CurrentPlayer < 0 || s.CurrentPlayer >= len(s.Players) || s.Players[s.CurrentPlayer].Position != id {
		return s
	}
	space := s.Board[id]
	p := s.Players[s.CurrentPlayer]
	cost := data.GetHouseCost(space, space.Houses)
	if space.Owner == nil || *space.Owner != s.CurrentPlayer || s.Dice == nil || s.PendingAction != nil || space.Houses >= data.MaxHouses || space.Mortgaged || cost == 0 || p.Money < cost || (s.JustBoughtSpaceID != nil && *s.JustBoughtSpaceID == id) {
		return s
	}
	b := cloneBoard(s.Board)
	b[id].Houses++
	s.Board = b
	ps := clonePlayers(s.Players)
	ps[s.CurrentPlayer].Money -= cost
	s.Players = ps
	s.BuiltThisStop = true
	s.Phase = entity.GamePhaseWaiting
	key := entity.LogEventKeyBuiltHouse
	if space.Houses == data.MaxHouses-1 {
		key = entity.LogEventKeyBuiltHotel
	}
	return appendLog(s, ActorEntry(key, p, map[string]interface{}{entity.LogParamKeySpaceId: id, entity.LogParamKeyAmount: cost}))
}
func sellHouseReducer(s entity.GameState, id int) entity.GameState {
	if id < 0 || id >= len(s.Board) || s.CurrentPlayer < 0 || s.CurrentPlayer >= len(s.Players) || s.Board[id].Houses <= 0 {
		return s
	}
	space := s.Board[id]
	if space.Owner == nil || *space.Owner != s.CurrentPlayer {
		return s
	}
	refund := int(float64(data.GetHouseCost(space, space.Houses-1)) * data.HouseSellRate)
	b := cloneBoard(s.Board)
	b[id].Houses--
	s.Board = b
	ps := clonePlayers(s.Players)
	ps[s.CurrentPlayer].Money += refund
	s.Players = ps
	return appendLog(s, ActorEntry(entity.LogEventKeySoldHouse, s.Players[s.CurrentPlayer], map[string]interface{}{entity.LogParamKeySpaceId: id, entity.LogParamKeyAmount: refund}))
}
func mortgageReducer(s entity.GameState, id int, mortgage bool) entity.GameState {
	if id < 0 || id >= len(s.Board) || s.CurrentPlayer < 0 || s.CurrentPlayer >= len(s.Players) {
		return s
	}
	space := s.Board[id]
	if space.Owner == nil || *space.Owner != s.CurrentPlayer {
		return s
	}
	p := s.Players[s.CurrentPlayer]
	if mortgage {
		if space.Mortgaged || space.Houses > 0 {
			return s
		}
		v := 0
		if space.Price != nil {
			v = *space.Price / 2
		}
		b := cloneBoard(s.Board)
		b[id].Mortgaged = true
		s.Board = b
		ps := clonePlayers(s.Players)
		ps[s.CurrentPlayer].Money += v
		s.Players = ps
		return appendLog(s, ActorEntry(entity.LogEventKeyMortgaged, p, map[string]interface{}{entity.LogParamKeySpaceId: id, entity.LogParamKeyAmount: v}))
	}
	if !space.Mortgaged {
		return s
	}
	v := 0
	if space.Price != nil {
		v = int(float64(*space.Price) / 2 * 1.1)
	}
	if p.Money < v {
		return s
	}
	b := cloneBoard(s.Board)
	b[id].Mortgaged = false
	s.Board = b
	ps := clonePlayers(s.Players)
	ps[s.CurrentPlayer].Money -= v
	s.Players = ps
	return appendLog(s, ActorEntry(entity.LogEventKeyUnmortgaged, p, map[string]interface{}{entity.LogParamKeySpaceId: id, entity.LogParamKeyAmount: v}))
}
func sellPropertyReducer(s entity.GameState, id int) entity.GameState {
	if id < 0 || id >= len(s.Board) {
		return s
	}
	space := s.Board[id]
	p := s.Players[s.CurrentPlayer]
	if space.Owner == nil || *space.Owner != s.CurrentPlayer || space.Houses > 0 {
		return s
	}
	price := 0
	if space.Price != nil {
		price = *space.Price
	}
	v := int(float64(price) * data.SellRate)
	if space.Mortgaged {
		v = int(float64(price) * data.MortgagedSellExtra)
	}
	b := cloneBoard(s.Board)
	b[id].Owner = nil
	b[id].Mortgaged = false
	s.Board = b
	ps := clonePlayers(s.Players)
	ps[s.CurrentPlayer].Money += v
	out := []int{}
	for _, x := range p.Properties {
		if x != id {
			out = append(out, x)
		}
	}
	ps[s.CurrentPlayer].Properties = out
	s.Players = ps
	return appendLog(s, ActorEntry(entity.LogEventKeySoldToBank, p, map[string]interface{}{entity.LogParamKeySpaceId: id, entity.LogParamKeyAmount: v}))
}

func validTrade(s entity.GameState, t entity.PendingTrade) bool {
	if t.FromID < 0 || t.ToID < 0 || t.FromID >= len(s.Players) || t.ToID >= len(s.Players) || t.FromID == t.ToID {
		return false
	}
	if s.Players[t.FromID].Bankrupt || s.Players[t.ToID].Bankrupt {
		return false
	}
	if t.OfferCash <= 0 && len(t.OfferProperties) == 0 && t.RequestCash <= 0 && len(t.RequestProperties) == 0 {
		return false
	}
	offerIDs := map[int]struct{}{}
	for _, id := range t.OfferProperties {
		if id < 0 || id >= len(s.Board) || s.Board[id].Owner == nil || *s.Board[id].Owner != t.FromID {
			return false
		}
		if _, exists := offerIDs[id]; exists {
			return false
		}
		offerIDs[id] = struct{}{}
	}
	requestIDs := map[int]struct{}{}
	for _, id := range t.RequestProperties {
		if id < 0 || id >= len(s.Board) || s.Board[id].Owner == nil || *s.Board[id].Owner != t.ToID {
			return false
		}
		if _, exists := requestIDs[id]; exists {
			return false
		}
		requestIDs[id] = struct{}{}
	}
	return s.Players[t.FromID].Money >= t.OfferCash && s.Players[t.ToID].Money >= t.RequestCash
}
func applyTrade(s entity.GameState, t entity.PendingTrade) entity.GameState {
	b := cloneBoard(s.Board)
	for _, id := range t.OfferProperties {
		x := t.ToID
		b[id].Owner = &x
	}
	for _, id := range t.RequestProperties {
		x := t.FromID
		b[id].Owner = &x
	}
	s.Board = b
	ps := clonePlayers(s.Players)
	for i := range ps {
		if ps[i].ID == t.FromID {
			ps[i].Money -= t.OfferCash - t.RequestCash
			for _, id := range t.OfferProperties {
				ps[i].Properties = removeInt(ps[i].Properties, id)
			}
			ps[i].Properties = append(ps[i].Properties, t.RequestProperties...)
		}
		if ps[i].ID == t.ToID {
			ps[i].Money += t.OfferCash - t.RequestCash
			for _, id := range t.RequestProperties {
				ps[i].Properties = removeInt(ps[i].Properties, id)
			}
			ps[i].Properties = append(ps[i].Properties, t.OfferProperties...)
		}
	}
	s.Players = ps
	return s
}
func removeInt(a []int, x int) []int {
	r := []int{}
	for _, v := range a {
		if v != x {
			r = append(r, v)
		}
	}
	return r
}
func uniquePropertyIDs(ids []int) []int {
	seen := make(map[int]struct{}, len(ids))
	unique := make([]int, 0, len(ids))
	for _, id := range ids {
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		unique = append(unique, id)
	}
	return unique
}

func shouldAcceptTrade(s entity.GameState, t entity.PendingTrade) bool {
	if t.ToID < 0 || t.ToID >= len(s.Players) {
		return false
	}
	bot := s.Players[t.ToID]
	offerProperties := uniquePropertyIDs(t.OfferProperties)
	requestProperties := uniquePropertyIDs(t.RequestProperties)
	value := func(ids []int, cash int) float64 {
		total := float64(cash)
		for _, id := range ids {
			if id >= 0 && id < len(s.Board) {
				space := s.Board[id]
				base := 0
				if space.Price != nil {
					base = *space.Price
				}
				multiplier := []float64{1, 1.3, 1.6, 2, 2.5, 2.5}
				m := 1.0
				if space.Houses >= 0 && space.Houses < len(multiplier) {
					m = multiplier[space.Houses]
				}
				houseCost := data.GetHouseCost(space, 0)
				total += float64(base) + float64(space.Houses*houseCost)*m
			}
		}
		return total
	}
	received := value(offerProperties, t.OfferCash)
	given := value(requestProperties, t.RequestCash)
	bonus := 0.0
	for _, id := range offerProperties {
		if id < 0 || id >= len(s.Board) {
			continue
		}
		space := s.Board[id]
		if space.Type != entity.SpaceTypeProperty || space.Color == nil {
			continue
		}
		setSize, ownedAfter := 0, 0
		currentlyNotOwned := false
		for _, candidate := range s.Board {
			if candidate.Type != entity.SpaceTypeProperty || candidate.Color == nil || *candidate.Color != *space.Color {
				continue
			}
			setSize++
			if candidate.Owner == nil || *candidate.Owner != bot.ID {
				currentlyNotOwned = true
			}
			if candidate.Owner != nil && *candidate.Owner == bot.ID {
				ownedAfter++
			}
			for _, requested := range requestProperties {
				if requested == candidate.ID {
					ownedAfter--
				}
			}
			for _, offered := range offerProperties {
				if offered == candidate.ID && (candidate.Owner == nil || *candidate.Owner != bot.ID) {
					ownedAfter++
				}
			}
		}
		if setSize > 0 && ownedAfter == setSize && currentlyNotOwned {
			bonus += 0.5 * value([]int{id}, 0)
		}
	}
	penalty := 0.0
	for _, id := range requestProperties {
		if id < 0 || id >= len(s.Board) {
			continue
		}
		space := s.Board[id]
		if space.Type != entity.SpaceTypeProperty || space.Color == nil {
			continue
		}
		setSize, currentlyOwned := 0, 0
		for _, candidate := range s.Board {
			if candidate.Type == entity.SpaceTypeProperty && candidate.Color != nil && *candidate.Color == *space.Color {
				setSize++
				if candidate.Owner != nil && *candidate.Owner == bot.ID {
					currentlyOwned++
				}
			}
		}
		if setSize > 0 && currentlyOwned == setSize {
			penalty += value([]int{id}, 0)
		}
	}
	totalReceived := received + bonus
	totalGiven := given + penalty
	postMoney := bot.Money + t.OfferCash - t.RequestCash
	if postMoney < data.StartingMoney/10 {
		return totalReceived > totalGiven*2
	}
	return totalReceived > totalGiven*1.1
}

func proposeTrade(s entity.GameState, o entity.TradeOffer) entity.GameState {
	if !s.TradesEnabled {
		return s
	}
	t := entity.PendingTrade{ID: s.NextTradeID, TradeOffer: o}
	if o.FromID == o.ToID || o.FromID < 0 || o.ToID < 0 || o.FromID >= len(s.Players) || o.ToID >= len(s.Players) || s.Players[o.FromID].Bankrupt || s.Players[o.ToID].Bankrupt {
		return s
	}
	if !validTrade(s, t) {
		return appendLog(s, entity.LogEntry{Key: entity.LogEventKeyTradeProposalRejected, Params: map[string]interface{}{"from": s.Players[o.FromID].Name, "to": s.Players[o.ToID].Name}})
	}
	if s.Players[o.ToID].IsBot || s.Players[o.ToID].BotControlled {
		if shouldAcceptTrade(s, t) {
			s = applyTrade(s, t)
			return appendLog(s, entity.LogEntry{Key: entity.LogEventKeyTradeAccepted, Params: map[string]interface{}{"from": s.Players[o.FromID].Name, "to": s.Players[o.ToID].Name}})
		}
		return appendLog(s, entity.LogEntry{Key: entity.LogEventKeyTradeRejected, Params: map[string]interface{}{"from": s.Players[o.FromID].Name, "to": s.Players[o.ToID].Name}})
	}
	s.PendingTrades = append(append([]entity.PendingTrade{}, s.PendingTrades...), t)
	s.NextTradeID++
	return appendLog(s, entity.LogEntry{Key: entity.LogEventKeyTradeProposed, Params: map[string]interface{}{"from": s.Players[o.FromID].Name, "to": s.Players[o.ToID].Name}})
}
func acceptTrade(s entity.GameState, id int) entity.GameState {
	if !s.TradesEnabled {
		return s
	}
	for _, t := range s.PendingTrades {
		if t.ID != id {
			continue
		}
		if !validTrade(s, t) {
			return removeTrade(s, id, entity.LogEventKeyTradeRejected)
		}
		s = applyTrade(s, t)
		return removeTrade(s, id, entity.LogEventKeyTradeAccepted)
	}
	return s
}
func removeTrade(s entity.GameState, id int, key entity.LogEventKey) entity.GameState {
	for _, t := range s.PendingTrades {
		if t.ID == id {
			s.PendingTrades = filterTrades(s.PendingTrades, id)
			params := map[string]interface{}{}
			if t.FromID >= 0 && t.FromID < len(s.Players) {
				params["from"] = s.Players[t.FromID].Name
			}
			if t.ToID >= 0 && t.ToID < len(s.Players) {
				params["to"] = s.Players[t.ToID].Name
			}
			return appendLog(s, entity.LogEntry{Key: key, Params: params})
		}
	}
	return s
}
func filterTrades(a []entity.PendingTrade, id int) []entity.PendingTrade {
	r := []entity.PendingTrade{}
	for _, t := range a {
		if t.ID != id {
			r = append(r, t)
		}
	}
	return r
}
func drawCard(s entity.GameState) entity.GameState {
	if s.PendingAction == nil {
		return s
	}
	p, ok := (*s.PendingAction).(entity.PendingDrawCardAction)
	if !ok {
		return s
	}
	deck := s.CommunityDeck
	if p.DrawType == entity.CardTypeChance {
		deck = s.ChanceDeck
	}
	if len(deck) == 0 {
		if p.DrawType == entity.CardTypeChance {
			deck = append([]entity.Card{}, data.CHANCE_CARDS...)
		} else {
			deck = append([]entity.Card{}, data.COMMUNITY_CARDS...)
		}
	}
	card := deck[0]
	deck = deck[1:]
	if p.DrawType == entity.CardTypeChance {
		s.ChanceDeck = deck
	} else {
		s.CommunityDeck = deck
	}
	s.Phase = entity.GamePhaseResolving
	return setPending(s, entity.PendingCardEffectAction{Type: entity.PendingActionTypeCardEffect, Card: card})
}
func resolveCard(s entity.GameState) entity.GameState {
	if s.PendingAction == nil {
		return s
	}
	p, ok := (*s.PendingAction).(entity.PendingCardEffectAction)
	if !ok {
		return s
	}
	old := s.Players[s.CurrentPlayer].Position
	r := ResolveCardEffect(s, p.Card)
	s = r.State
	newPos := s.Players[s.CurrentPlayer].Position
	s.Phase = entity.GamePhaseWaiting
	if old != newPos && p.Card.Effect != nil {
		s.Phase = entity.GamePhaseResolving
	}
	if _, ok := p.Card.Effect.(entity.CardEffectGoToJail); ok {
		s.Phase = entity.GamePhaseWaiting
		s.CurrentPlayer = nextPlayer(s)
		s.Dice = nil
		s = appendLog(s, turnLog(s, s.CurrentPlayer))
	}
	s.PendingAction = nil
	return appendLog(s, r.Log...)
}
func jailExit(s entity.GameState, useCard bool) entity.GameState {
	p := s.Players[s.CurrentPlayer]
	if !p.InJail {
		return s
	}
	if useCard && p.GetOutOfJailFreeCards <= 0 {
		return s
	}
	if !useCard && p.Money < data.JailFine {
		return s
	}
	ps := clonePlayers(s.Players)
	ps[s.CurrentPlayer].InJail = false
	ps[s.CurrentPlayer].JailTurns = 0
	if useCard {
		ps[s.CurrentPlayer].GetOutOfJailFreeCards--
	} else {
		ps[s.CurrentPlayer].Money -= data.JailFine
		s.FreeParkingPot += data.JailFine
	}
	s.Players = ps
	n := nextPlayer(s)
	s.CurrentPlayer = n
	s.Dice = nil
	if useCard {
		return appendLog(s, ActorEntry(entity.LogEventKeyUsedJailCard, p, nil), turnLog(s, n))
	}
	return appendLog(s, ActorEntry(entity.LogEventKeyPaidJailFine, p, map[string]interface{}{entity.LogParamKeyAmount: data.JailFine}), turnLog(s, n))
}
func bankruptcy(s entity.GameState) entity.GameState {
	if s.CurrentPlayer < 0 || s.CurrentPlayer >= len(s.Players) {
		return s
	}
	p := s.Players[s.CurrentPlayer]
	creditor := -1
	if s.PendingAction != nil {
		switch x := (*s.PendingAction).(type) {
		case entity.PendingBankruptcyAction:
			if x.SpaceID >= 0 && x.SpaceID < len(s.Board) && s.Board[x.SpaceID].Owner != nil {
				creditor = *s.Board[x.SpaceID].Owner
			}
		case entity.PendingPayRentAction:
			if x.SpaceID >= 0 && x.SpaceID < len(s.Board) && s.Board[x.SpaceID].Owner != nil {
				creditor = *s.Board[x.SpaceID].Owner
			}
		}
	}
	total := p.Money
	if total < 0 {
		total = 0
	}
	b := cloneBoard(s.Board)
	for i := range b {
		if b[i].Owner != nil && *b[i].Owner == p.ID {
			total += int(float64(data.GetTotalHouseInvestment(b[i])) * data.HouseSellRate)
			price := 0
			if b[i].Price != nil {
				price = *b[i].Price
			}
			if b[i].Mortgaged {
				total += int(float64(price) * data.MortgagedSellExtra)
			} else {
				total += int(float64(price) * data.SellRate)
			}
			b[i].Owner = nil
			b[i].Houses = 0
			b[i].Mortgaged = false
		}
	}
	ps := clonePlayers(s.Players)
	ps[s.CurrentPlayer].Money = 0
	ps[s.CurrentPlayer].Properties = []int{}
	ps[s.CurrentPlayer].Bankrupt = true
	ps[s.CurrentPlayer].GetOutOfJailFreeCards = 0
	if creditor >= 0 && creditor < len(ps) && creditor != s.CurrentPlayer {
		ps[creditor].Money += total
	} else {
		creditor = -1
	}
	s.Board = b
	s.Players = ps
	s.PendingAction = nil
	logs := []entity.LogEntry{ActorEntry(entity.LogEventKeyBankruptcy, p, nil)}
	if creditor >= 0 && creditor < len(ps) {
		logs = append(logs, entity.LogEntry{Key: entity.LogEventKeyBankruptcyTransfer, Params: map[string]interface{}{"name": p.Name, "creditor": ps[creditor].Name, entity.LogParamKeyAmount: total}})
	}
	s = appendLog(s, logs...)
	active := 0
	for _, x := range ps {
		if !x.Bankrupt {
			active++
		}
	}
	if active <= 1 {
		s.Phase = entity.GamePhaseGameOver
		winner := ""
		for _, x := range ps {
			if !x.Bankrupt {
				winner = x.Name
			}
		}
		return appendLog(s, entity.LogEntry{Key: entity.LogEventKeyBankruptcyWin, Params: map[string]interface{}{"name": p.Name, "winner": winner}})
	}
	s.Phase = entity.GamePhaseWaiting
	s.CurrentPlayer = nextPlayer(s)
	s.Dice = nil
	s.DoublesCount = 0
	s.LastMoveSteps = nil
	return appendLog(s, turnLog(s, s.CurrentPlayer))
}
