package gameusecase

import (
	"fmt"
	"math/rand"
	"strings"
	"sync"
	"time"

	"monopoly-game-backend/internal/data"
	"monopoly-game-backend/internal/entity"
	"monopoly-game-backend/internal/usecase/botusecase"
	"monopoly-game-backend/pkg/clock"
)

type ClientId = string

type GameServerEvents interface {
	BroadcastState(state entity.GameState)
	BroadcastLobby(players []entity.LobbyPlayer, hostPlayerID int)
	BroadcastEmoticon(playerID int, emoticon entity.Emoticon)
	Send(clientID ClientId, message entity.ServerMessage)
}

type Slot struct {
	ClientID     *ClientId
	Name         *string
	Token        string
	Connected    bool
	IsBot        bool
	GracePending bool
	Color        *string
	Avatar       *entity.PlayerAvatarData
}

type JoinOptions struct {
	Token  string
	Color  string
	Avatar *entity.PlayerAvatarData
}

type GameServerOptions struct {
	RNG           func() float64
	Code          string
	TradesEnabled bool
	SeedEnabled   bool
	AFKTimeout    time.Duration
	Clock         clock.Clock
}

const (
	BOT_STEP_MS      = 700 * time.Millisecond
	BOT_GRACE_MS     = 3 * time.Second
	AFK_TIMEOUT_MS   = 30 * time.Second
	AUTO_END_TURN_MS = 300 * time.Millisecond
)

type GameServer struct {
	mu             sync.Mutex
	state          entity.GameState
	slots          []Slot
	events         GameServerEvents
	rng            func() float64
	code           string
	hostSlotIndex  int
	botSteps       int
	botTimer       clock.Timer
	afkTimer       clock.Timer
	autoStepTimer  clock.Timer
	seedEnabled    bool
	afkTimeout     time.Duration
	clock          clock.Clock
	lastEmotionAt  map[int]time.Time
	diceTimers     []clock.Timer
	diceGeneration uint64
	eventQueue     []func()
	eventFlushing  bool
	stopped        bool
}

func NewGameServer(events GameServerEvents, opts GameServerOptions) *GameServer {
	c := opts.Clock
	if c == nil {
		c = clock.RealClock{}
	}
	rng := opts.RNG
	if rng == nil {
		rng = rand.Float64
	}
	afk := opts.AFKTimeout
	if afk == 0 {
		afk = AFK_TIMEOUT_MS
	}
	slots := make([]Slot, data.MAX_PLAYERS)
	return &GameServer{state: CreateInitialState(InitialStateOptions{TradesEnabled: opts.TradesEnabled}), slots: slots, events: events, rng: rng, code: opts.Code, seedEnabled: opts.SeedEnabled, afkTimeout: afk, clock: c, lastEmotionAt: make(map[int]time.Time)}
}

func (g *GameServer) GetState() entity.GameState {
	g.mu.Lock()
	defer func() {
		g.mu.Unlock()
		g.flushEvents()
	}()
	return cloneState(g.state)
}

func cloneState(state entity.GameState) entity.GameState {
	state.Players = append([]entity.Player{}, state.Players...)
	for i := range state.Players {
		state.Players[i].Properties = append([]int{}, state.Players[i].Properties...)
	}
	state.TurnOrder = append([]int{}, state.TurnOrder...)
	state.Board = append([]entity.Space{}, state.Board...)
	for i := range state.Board {
		state.Board[i].Price = cloneInt(state.Board[i].Price)
		state.Board[i].Rent = append([]int(nil), state.Board[i].Rent...)
		state.Board[i].HouseCost = append([]int(nil), state.Board[i].HouseCost...)
		state.Board[i].Color = cloneString(state.Board[i].Color)
		state.Board[i].Owner = cloneInt(state.Board[i].Owner)
		state.Board[i].TaxType = cloneTaxType(state.Board[i].TaxType)
	}
	state.ChanceDeck = append([]entity.Card{}, state.ChanceDeck...)
	state.CommunityDeck = append([]entity.Card{}, state.CommunityDeck...)
	state.EventLog = append([]entity.LogEntry{}, state.EventLog...)
	for i := range state.EventLog {
		if state.EventLog[i].Params != nil {
			params := state.EventLog[i].Params
			state.EventLog[i].Params = map[string]interface{}{}
			for key, value := range params {
				state.EventLog[i].Params[key] = value
			}
		}
	}
	state.PendingTrades = append([]entity.PendingTrade{}, state.PendingTrades...)
	for i := range state.PendingTrades {
		state.PendingTrades[i].OfferProperties = append([]int{}, state.PendingTrades[i].OfferProperties...)
		state.PendingTrades[i].RequestProperties = append([]int{}, state.PendingTrades[i].RequestProperties...)
	}
	state.Dice = cloneDice(state.Dice)
	state.LastMoveSteps = cloneInt(state.LastMoveSteps)
	state.JustBoughtSpaceID = cloneInt(state.JustBoughtSpaceID)
	if state.PendingAction != nil {
		pending := clonePendingAction(*state.PendingAction)
		state.PendingAction = &pending
	}
	if state.ReconnectGrace != nil {
		grace := *state.ReconnectGrace
		state.ReconnectGrace = &grace
	}
	return state
}

func cloneInt(value *int) *int {
	if value == nil {
		return nil
	}
	copy := *value
	return &copy
}

func cloneString(value *string) *string {
	if value == nil {
		return nil
	}
	copy := *value
	return &copy
}

func cloneTaxType(value *entity.TaxType) *entity.TaxType {
	if value == nil {
		return nil
	}
	copy := *value
	return &copy
}

func clonePendingAction(action entity.PendingAction) entity.PendingAction {
	switch value := action.(type) {
	case entity.PendingBuyPropertyAction:
		return value
	case entity.PendingPayRentAction:
		return value
	case entity.PendingDrawCardAction:
		return value
	case entity.PendingCardEffectAction:
		return entity.PendingCardEffectAction{Type: value.Type, Card: cloneCard(value.Card)}
	case entity.PendingBankruptcyAction:
		return value
	default:
		return action
	}
}

func cloneCard(card entity.Card) entity.Card {
	return card
}

func cloneDice(dice *[2]int) *[2]int {
	if dice == nil {
		return nil
	}
	copy := *dice
	return &copy
}

func (g *GameServer) GetCode() string {
	g.mu.Lock()
	defer func() {
		g.mu.Unlock()
		g.flushEvents()
	}()
	return g.code
}

func (g *GameServer) GetHostPlayerID() int {
	g.mu.Lock()
	defer func() {
		g.mu.Unlock()
		g.flushEvents()
	}()
	return g.hostSlotIndex
}

func (g *GameServer) GetPlayers() []entity.LobbyPlayer {
	g.mu.Lock()
	defer func() {
		g.mu.Unlock()
		g.flushEvents()
	}()
	players := g.getLobbyPlayers()
	for i := range players {
		players[i].Name = cloneString(players[i].Name)
	}
	return players
}

func (g *GameServer) Join(clientID ClientId, name string, opts JoinOptions) bool {
	g.mu.Lock()
	defer func() {
		g.mu.Unlock()
		g.flushEvents()
	}()
	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		g.sendError(clientID, "Nama tidak boleh kosong")
		return false
	}
	for i := range g.slots {
		s := &g.slots[i]
		if s.Name != nil && *s.Name == trimmed && !s.Connected {
			if s.Token != opts.Token {
				g.sendError(clientID, "Nama sudah dipakai")
				return false
			}

			id := clientID
			s.ClientID, s.Connected, s.GracePending = &id, true, false
			if g.state.Phase != entity.GamePhaseSetup {
				g.dispatchLocked(entity.SetBotControlAction{Type: entity.GameActionTypeSetBotControl, PlayerID: i, Controlled: false})
			}
			g.welcome(clientID, i)
			g.broadcastLocked()
			return true
		}
	}
	for i := range g.slots {
		s := &g.slots[i]
		if s.Name != nil && *s.Name == trimmed && s.Connected {
			if s.Token != opts.Token {
				g.sendError(clientID, "Nama sudah dipakai")
				return false
			}
			id := clientID
			s.ClientID = &id
			g.welcome(clientID, i)
			g.broadcastLocked()
			return true
		}
	}
	if g.state.Phase != entity.GamePhaseSetup {
		g.sendError(clientID, "Permainan sudah dimulai")
		return false
	}
	index := g.findSlot()
	if index < 0 {
		g.sendError(clientID, "Ruangan penuh (maks 6 pemain)")
		return false
	}
	id := clientID
	color := g.nextFreeColor()
	if opts.Color != "" && data.IsValidColor(opts.Color) && !g.isColorTaken(opts.Color, index) {
		color = opts.Color
	}
	avatar := g.nextFreeAvatar()
	if opts.Avatar != nil {
		if value, err := opts.Avatar.ToPlayerAvatar(); err == nil && data.IsValidAvatar(value) && !g.isAvatarTaken(value, index) {
			copy := *opts.Avatar
			avatar = copy
		}
	}
	g.slots[index] = Slot{ClientID: &id, Name: &trimmed, Token: opts.Token, Connected: true, Color: &color, Avatar: &avatar}
	g.welcome(clientID, index)
	g.broadcastLocked()
	return true
}

func (g *GameServer) HasClient(clientID ClientId) bool {
	g.mu.Lock()
	defer func() {
		g.mu.Unlock()
		g.flushEvents()
	}()
	return g.findClient(clientID) >= 0
}

func (g *GameServer) SetIdentity(clientID ClientId, color string, avatar *entity.PlayerAvatarData) {
	g.mu.Lock()
	defer func() {
		g.mu.Unlock()
		g.flushEvents()
	}()
	if g.state.Phase != entity.GamePhaseSetup {
		g.sendError(clientID, "Identitas hanya bisa diubah sebelum permainan dimulai")
		return
	}
	index := g.findClient(clientID)
	if index < 0 {
		return
	}
	if color != "" {
		if !data.IsValidColor(color) {
			g.sendError(clientID, "Warna tidak valid")
			return
		}
		if g.isColorTaken(color, index) {
			g.sendError(clientID, "Warna sudah dipakai")
			return
		}
	}
	if avatar != nil {
		value, err := avatar.ToPlayerAvatar()
		if err != nil || !data.IsValidAvatar(value) {
			g.sendError(clientID, "Avatar tidak valid")
			return
		}
		if g.isAvatarTaken(value, index) {
			g.sendError(clientID, "Avatar sudah dipakai")
			return
		}
	}
	if color != "" {
		g.slots[index].Color = &color
	}
	if avatar != nil {
		copy := *avatar
		g.slots[index].Avatar = &copy
	}
	g.broadcastLocked()
}

func (g *GameServer) AddBot(clientID ClientId) {
	g.mu.Lock()
	defer func() {
		g.mu.Unlock()
		g.flushEvents()
	}()
	if !g.isHost(clientID) {
		g.sendError(clientID, "Hanya host yang bisa menambah bot")
		return
	}
	if g.state.Phase != entity.GamePhaseSetup {
		g.sendError(clientID, "Bot hanya bisa ditambah sebelum permainan dimulai")
		return
	}
	index := -1
	for i, s := range g.slots {
		if s.Name == nil && !s.IsBot {
			index = i
			break
		}
	}
	if index < 0 {
		g.sendError(clientID, "Ruangan penuh (maks 6 pemain)")
		return
	}
	used := map[string]bool{}
	for _, s := range g.slots {
		if s.Name != nil {
			used[*s.Name] = true
		}
	}
	name := fmt.Sprintf("Bot %d", index+1)
	for _, candidate := range data.BOT_NAMES {
		if !used[candidate] {
			name = candidate
			break
		}
	}
	color := g.nextFreeColor()
	avatar := g.nextFreeAvatar()
	g.slots[index] = Slot{Name: &name, Connected: true, IsBot: true, Color: &color, Avatar: &avatar}
	g.broadcastLocked()
}

func (g *GameServer) RemoveBot(clientID ClientId, playerID int) {
	g.mu.Lock()
	defer func() {
		g.mu.Unlock()
		g.flushEvents()
	}()
	if !g.isHost(clientID) {
		g.sendError(clientID, "Hanya host yang bisa menghapus bot")
		return
	}
	if g.state.Phase != entity.GamePhaseSetup {
		g.sendError(clientID, "Bot hanya bisa dihapus sebelum permainan dimulai")
		return
	}
	if playerID < 0 || playerID >= len(g.slots) || !g.slots[playerID].IsBot {
		return
	}
	g.slots[playerID] = Slot{}
	g.broadcastLocked()
}

func (g *GameServer) Start(clientID ClientId) {
	g.mu.Lock()
	defer func() {
		g.mu.Unlock()
		g.flushEvents()
	}()
	if !g.isHost(clientID) {
		g.sendError(clientID, "Hanya host yang bisa memulai")
		return
	}
	if g.state.Phase != entity.GamePhaseSetup {
		return
	}
	joined := 0
	playerSlots := []int{}
	names, bots, colors, avatars := []string{}, []bool{}, []string{}, []entity.PlayerAvatarData{}
	for i, s := range g.slots {
		if s.ClientID != nil || s.IsBot {
			joined++
			playerSlots = append(playerSlots, i)
			if s.Name != nil {
				names = append(names, *s.Name)
			} else {
				names = append(names, fmt.Sprintf("P%d", joined))
			}
			bots = append(bots, s.IsBot)
			colors = append(colors, g.slotColor(s, i))
			avatars = append(avatars, g.slotAvatar(s))
		}
	}
	if joined < 2 {
		g.sendError(clientID, "Butuh minimal 2 pemain")
		return
	}
	g.dispatchLocked(entity.StartGameAction{Type: entity.GameActionTypeStartGame, PlayerCount: joined, Names: names, IsBot: bots, Colors: colors, Avatars: avatars, PlayerIDs: playerSlots})
}

func (g *GameServer) Leave(clientID ClientId) {
	g.mu.Lock()
	defer func() {
		g.mu.Unlock()
		g.flushEvents()
	}()
	index := g.findClient(clientID)
	if index < 0 {
		g.send(clientID, entity.ServerMessageLeft{Type: entity.ServerMessageTypeLeft})
		return
	}
	if g.state.Phase == entity.GamePhaseSetup {
		g.slots[index] = Slot{}
		if index == g.hostSlotIndex {
			g.hostSlotIndex = g.nextConnectedSlot(index)
		}
		human := false
		for _, s := range g.slots {
			if s.ClientID != nil || (s.Name != nil && !s.IsBot) {
				human = true
			}
		}
		if !human {
			for i, s := range g.slots {
				if s.IsBot {
					g.slots[i] = Slot{}
				}
			}
		}
		g.send(clientID, entity.ServerMessageLeft{Type: entity.ServerMessageTypeLeft})
	} else {
		g.send(clientID, entity.ServerMessageLeft{Type: entity.ServerMessageTypeLeft})
		g.disconnectGraceLocked(index)
	}
	if g.state.Phase == entity.GamePhaseSetup {
		g.broadcastLocked()
	}
}

func (g *GameServer) Disconnect(clientID ClientId) {
	g.mu.Lock()
	defer func() {
		g.mu.Unlock()
		g.flushEvents()
	}()
	index := g.findClient(clientID)
	if index < 0 {
		return
	}
	if g.state.Phase == entity.GamePhaseSetup {
		g.slots[index].Connected = false
		g.slots[index].ClientID = nil
		g.slots[index].GracePending = true
		if index == g.hostSlotIndex {
			g.hostSlotIndex = g.nextConnectedSlot(index)
		}
		g.broadcastLocked()
		return
	}
	g.disconnectGraceLocked(index)
}

func (g *GameServer) Roll(clientID ClientId, target *int) {
	g.mu.Lock()
	defer func() {
		g.mu.Unlock()
		g.flushEvents()
	}()
	if !g.isTurn(clientID) {
		g.sendError(clientID, "Bukan giliranmu")
		return
	}
	if g.state.Phase != entity.GamePhaseWaiting || g.state.PendingAction != nil || g.state.Dice != nil {
		g.sendError(clientID, "Belum bisa melempar dadu")
		return
	}
	g.clearAfkIfHumanLocked(clientID)
	g.startRollLocked(target)
}

func (g *GameServer) HandleAction(clientID ClientId, action entity.GameAction) {
	g.mu.Lock()
	defer func() {
		g.mu.Unlock()
		g.flushEvents()
	}()
	if action == nil {
		return
	}
	switch action.(type) {
	case entity.SetBotControlAction, entity.SetReconnectGraceAction:
		return
	}
	if !g.state.TradesEnabled {
		switch action.(type) {
		case entity.ProposeTradeAction, entity.AcceptTradeAction, entity.RejectTradeAction, entity.CancelTradeAction:
			g.sendError(clientID, "Fitur pertukaran tidak tersedia")
			return
		}
	}
	if roll, ok := action.(entity.RollDiceAction); ok {
		g.rollLocked(clientID, roll.Target)
		return
	}
	slot := g.findClient(clientID)
	switch a := action.(type) {
	case entity.ProposeTradeAction:
		if a.Offer.FromID != slot {
			g.sendError(clientID, "Bukan giliranmu")
			return
		}
	case entity.AcceptTradeAction:
		if !g.tradeParticipant(slot, a.TradeID, false) {
			g.sendError(clientID, "Bukan giliranmu")
			return
		}
	case entity.RejectTradeAction:
		if !g.tradeParticipant(slot, a.TradeID, false) {
			g.sendError(clientID, "Bukan giliranmu")
			return
		}
	case entity.CancelTradeAction:
		if !g.tradeParticipant(slot, a.TradeID, true) {
			g.sendError(clientID, "Bukan giliranmu")
			return
		}
	default:
		if !g.isTurn(clientID) {
			g.sendError(clientID, "Bukan giliranmu")
			return
		}
	}
	g.clearAfkIfHumanLocked(clientID)
	g.dispatchLocked(action)
}

func (g *GameServer) disconnectGraceLocked(index int) {
	if index < 0 || index >= len(g.slots) {
		return
	}
	g.slots[index].Connected = false
	g.slots[index].ClientID = nil
	g.slots[index].GracePending = true
	g.dispatchLocked(entity.SetBotControlAction{Type: entity.GameActionTypeSetBotControl, PlayerID: index, Controlled: true, Reason: entity.BotControlReasonOffline})
}

func (g *GameServer) HandleManualBotToggle(clientID ClientId) {
	g.mu.Lock()
	defer func() {
		g.mu.Unlock()
		g.flushEvents()
	}()
	index := g.findClient(clientID)
	if index < 0 || index >= len(g.state.Players) || g.slots[index].IsBot {
		return
	}
	controlled := !g.state.Players[index].BotControlled
	g.dispatchLocked(entity.SetBotControlAction{Type: entity.GameActionTypeSetBotControl, PlayerID: index, Controlled: controlled})
	if controlled {
		g.clearAfkTimerLocked()
	} else {
		g.scheduleAfkTimerLocked(index)
	}
}

func (g *GameServer) EmitEmoticon(clientID ClientId, emoticon entity.Emoticon) {
	g.mu.Lock()
	defer func() {
		g.mu.Unlock()
		g.flushEvents()
	}()
	if !entity.IsEmoticon(emoticon) || g.state.Phase == entity.GamePhaseSetup {
		return
	}
	index := g.findClient(clientID)
	if index < 0 || index >= len(g.state.Players) {
		return
	}
	now := g.clock.Now()
	if last, ok := g.lastEmotionAt[index]; ok && now.Sub(last) < time.Duration(entity.EMOTICON_COOLDOWN_MS)*time.Millisecond {
		return
	}
	g.lastEmotionAt[index] = now
	if g.events != nil {
		g.eventQueue = append(g.eventQueue, func() { g.events.BroadcastEmoticon(index, emoticon) })
	}
}

func (g *GameServer) SeedState(state entity.GameState) error {
	g.mu.Lock()
	defer func() {
		g.mu.Unlock()
		g.flushEvents()
	}()
	if !g.seedEnabled {
		return fmt.Errorf("seeding disabled")
	}
	if result := validateStateStructure(state, true); result.Kind != ValidationKindOk {

		return fmt.Errorf("%s", result.Message)
	}
	info := make([]SlotInfo, len(g.slots))
	for i, s := range g.slots {
		info[i] = SlotInfo{Name: s.Name, Connected: s.Connected, IsBot: s.IsBot}
	}
	if result := ValidateStateForRoom(state, info); result.Kind != ValidationKindOk {
		return fmt.Errorf("%s", result.Message)
	}
	g.clearBotTimerLocked()
	g.clearAfkTimerLocked()
	g.clearDiceTimersLocked()
	g.botSteps = 0
	state.TradesEnabled = g.state.TradesEnabled
	g.state = cloneState(state)
	g.clearAutoStepTimerLocked()
	g.broadcastLocked()
	g.driveBotLocked()
	g.scheduleAutoStepsLocked()
	return nil
}

func (g *GameServer) Stop() {
	g.mu.Lock()
	defer func() {
		g.mu.Unlock()
		g.flushEvents()
	}()
	g.stopped = true
	g.clearBotTimerLocked()
	g.clearAfkTimerLocked()
	g.clearAutoStepTimerLocked()
	g.clearDiceTimersLocked()
}

func (g *GameServer) dispatchLocked(action entity.GameAction) {
	if g.stopped {
		return
	}
	prev := g.state
	g.state = GameReducer(g.state, action)
	if prev.CurrentPlayer != g.state.CurrentPlayer {
		g.botSteps = 0
	}
	for _, emotion := range botusecase.DetectBotEmotions(prev, g.state) {
		now := g.clock.Now()
		if last, ok := g.lastEmotionAt[emotion.PlayerID]; ok && now.Sub(last) < time.Second {
			continue
		}
		g.lastEmotionAt[emotion.PlayerID] = now
		if g.events != nil {
			playerID, emoticon := emotion.PlayerID, emotion.Emoticon
			g.eventQueue = append(g.eventQueue, func() { g.events.BroadcastEmoticon(playerID, emoticon) })
		}
	}
	g.broadcastLocked()
	g.scheduleAutoStepsLocked()
	g.driveBotLocked()
}

func (g *GameServer) startRollLocked(target *int) {
	g.clearDiceTimersLocked()
	g.diceGeneration++
	generation := g.diceGeneration
	g.dispatchLocked(entity.RollDiceAction{Type: entity.GameActionTypeRollDice, Target: target})
	var dice [2]int
	var aimed, luck *int
	if target != nil {
		result := RollControlledDice(*target, g.rng)
		dice = result.Dice
		aimed, luck = target, &result.Luck
	} else {
		dice = [2]int{1 + int(g.rng()*6), 1 + int(g.rng()*6)}
	}
	animDuration := 500*time.Millisecond + time.Duration(dice[0]+dice[1])*150*time.Millisecond
	first := g.clock.AfterFunc(500*time.Millisecond, func() {
		g.mu.Lock()
		defer func() {
			g.mu.Unlock()
			g.flushEvents()
		}()
		if g.state.Phase != entity.GamePhaseRolling || g.stopped || generation != g.diceGeneration {
			return
		}
		g.dispatchLocked(entity.DiceAnimatedAction{Type: entity.GameActionTypeDiceAnimated, Dice: dice, Target: aimed, Luck: luck})
		second := g.clock.AfterFunc(animDuration, func() {
			g.mu.Lock()
			defer func() {
				g.mu.Unlock()
				g.flushEvents()
			}()
			if generation != g.diceGeneration || g.stopped {
				return
			}
			if g.state.Phase == entity.GamePhaseMoving {
				g.dispatchLocked(entity.ResolveSpaceAction{Type: entity.GameActionTypeResolveSpace})
			}
		})
		g.diceTimers = append(g.diceTimers, second)
	})
	g.diceTimers = []clock.Timer{first}
}

func (g *GameServer) rollLocked(clientID ClientId, target *int) {
	if !g.isTurn(clientID) {
		g.sendError(clientID, "Bukan giliranmu")
		return
	}
	if g.state.Phase != entity.GamePhaseWaiting || g.state.PendingAction != nil || g.state.Dice != nil {
		g.sendError(clientID, "Belum bisa melempar dadu")
		return
	}
	g.clearAfkIfHumanLocked(clientID)
	g.startRollLocked(target)
}

func (g *GameServer) scheduleAutoStepsLocked() {
	if g.autoStepTimer != nil {
		return
	}
	if g.state.Phase == entity.GamePhaseResolving && g.state.PendingAction == nil {
		g.autoStepTimer = g.clock.AfterFunc(200*time.Millisecond, func() {
			g.mu.Lock()
			defer func() {
				g.mu.Unlock()
				g.flushEvents()
			}()
			g.autoStepTimer = nil
			if g.state.Phase == entity.GamePhaseResolving && g.state.PendingAction == nil {
				g.dispatchLocked(entity.ResolveSpaceAction{Type: entity.GameActionTypeResolveSpace})
			}
		})
		return
	}
	if g.state.PendingAction != nil {
		if _, ok := (*g.state.PendingAction).(entity.PendingDrawCardAction); ok {
			g.autoStepTimer = g.clock.AfterFunc(300*time.Millisecond, func() {
				g.mu.Lock()
				defer func() {
					g.mu.Unlock()
					g.flushEvents()
				}()
				g.autoStepTimer = nil
				if _, ok := (*g.state.PendingAction).(entity.PendingDrawCardAction); ok {
					g.dispatchLocked(entity.DrawCardAction{Type: entity.GameActionTypeDrawCard})
				}
			})
			return
		}
	}
	if g.canAutoAdvanceTurnLocked() {
		g.autoStepTimer = g.clock.AfterFunc(AUTO_END_TURN_MS, func() {
			g.mu.Lock()
			defer func() {
				g.mu.Unlock()
				g.flushEvents()
			}()
			g.autoStepTimer = nil
			if g.canAutoAdvanceTurnLocked() {
				g.dispatchLocked(entity.EndTurnAction{Type: entity.GameActionTypeEndTurn})
			}
		})
	}
}

func (g *GameServer) canAutoAdvanceTurnLocked() bool {
	if g.state.Phase != entity.GamePhaseWaiting || g.state.PendingAction != nil || g.state.CurrentPlayer < 0 || g.state.CurrentPlayer >= len(g.state.Players) {
		return false
	}
	p, s := g.state.Players[g.state.CurrentPlayer], g.slots[g.state.CurrentPlayer]
	return !s.IsBot && s.Connected && !p.BotControlled && !p.InJail && g.state.Dice != nil && p.Money >= 0 && !CanBuildOnCurrentSpace(g.state)
}

func (g *GameServer) driveBotLocked() {
	if g.state.Phase == entity.GamePhaseSetup || g.state.Phase == entity.GamePhaseGameOver {
		g.clearBotTimerLocked()
		g.clearAfkTimerLocked()
		g.clearAutoStepTimerLocked()
		return
	}
	id := g.state.CurrentPlayer
	if id < 0 || id >= len(g.slots) || id >= len(g.state.Players) {
		g.clearBotTimerLocked()
		g.clearAfkTimerLocked()
		g.botSteps = 0
		return
	}
	s, p := g.slots[id], g.state.Players[id]
	if !s.IsBot && s.Connected && !p.BotControlled {
		g.clearBotTimerLocked()
		g.botSteps = 0
		g.scheduleAfkTimerLocked(id)
		return
	}
	g.clearAfkTimerLocked()
	if !s.IsBot && !p.BotControlled {
		g.clearBotTimerLocked()
		return
	}
	action := botusecase.DecideBotAction(g.state)
	if action == nil || g.botSteps >= 100 || g.botTimer != nil {
		return
	}
	g.botSteps++
	grace := !s.IsBot && s.GracePending
	if grace {
		g.slots[id].GracePending = false
	}
	delay := BOT_STEP_MS
	if grace {
		delay = BOT_GRACE_MS
		until := int(g.clock.Now().Add(delay).UnixMilli())
		g.state = GameReducer(g.state, entity.SetReconnectGraceAction{Type: entity.GameActionTypeSetReconnectGrace, PlayerID: id, Until: &until})
		g.broadcastLocked()
		g.scheduleAutoStepsLocked()
	}
	current := id
	g.botTimer = g.clock.AfterFunc(delay, func() {
		g.mu.Lock()
		defer func() {
			g.mu.Unlock()
			g.flushEvents()
		}()
		g.botTimer = nil
		if g.stopped || current >= len(g.slots) || (g.slots[current].IsBot == false && !g.state.Players[current].BotControlled) {
			return
		}
		next := botusecase.DecideBotAction(g.state)
		if roll, ok := next.(entity.RollDiceAction); ok {
			g.startRollLocked(roll.Target)
		} else if next != nil {
			g.dispatchLocked(next)
		}
		g.clearReconnectGraceLocked(current)
	})
}

func (g *GameServer) scheduleAfkTimerLocked(id int) {
	g.clearAfkTimerLocked()
	g.afkTimer = g.clock.AfterFunc(g.afkTimeout, func() {
		g.mu.Lock()
		defer func() {
			g.mu.Unlock()
			g.flushEvents()
		}()
		g.afkTimer = nil
		if g.state.Phase == entity.GamePhaseSetup || g.state.Phase == entity.GamePhaseGameOver || g.state.CurrentPlayer != id || id >= len(g.slots) || g.slots[id].IsBot || !g.slots[id].Connected || g.state.Players[id].BotControlled {
			return
		}
		g.dispatchLocked(entity.SetBotControlAction{Type: entity.GameActionTypeSetBotControl, PlayerID: id, Controlled: true, Reason: entity.BotControlReasonAfk})
	})
}
func (g *GameServer) clearAfkIfHumanLocked(clientID ClientId) {
	id := g.findClient(clientID)
	if id >= 0 && g.slots[id].Connected && g.state.Players[id].BotControlled {
		g.dispatchLocked(entity.SetBotControlAction{Type: entity.GameActionTypeSetBotControl, PlayerID: id, Controlled: false})
	}
}
func (g *GameServer) clearReconnectGraceLocked(id int) {
	if g.state.ReconnectGrace != nil && g.state.ReconnectGrace.PlayerID == id {
		g.dispatchLocked(entity.SetReconnectGraceAction{Type: entity.GameActionTypeSetReconnectGrace, PlayerID: id})
	}
}
func (g *GameServer) clearAutoStepTimerLocked() {
	if g.autoStepTimer != nil {
		g.autoStepTimer.Stop()
		g.autoStepTimer = nil
	}
}
func (g *GameServer) clearBotTimerLocked() {
	if g.botTimer != nil {
		g.botTimer.Stop()
		g.botTimer = nil
	}
}
func (g *GameServer) clearAfkTimerLocked() {
	if g.afkTimer != nil {
		g.afkTimer.Stop()
		g.afkTimer = nil
	}
}
func (g *GameServer) clearDiceTimersLocked() {
	g.diceGeneration++
	for _, timer := range g.diceTimers {
		timer.Stop()
	}
	g.diceTimers = nil
}

func (g *GameServer) flushEvents() {
	for {
		g.mu.Lock()
		if len(g.eventQueue) == 0 || g.eventFlushing {
			g.mu.Unlock()
			return
		}
		g.eventFlushing = true
		events := g.eventQueue
		g.eventQueue = nil
		g.mu.Unlock()
		for _, event := range events {
			event()
		}
		g.mu.Lock()
		g.eventFlushing = false
		more := len(g.eventQueue) > 0
		g.mu.Unlock()
		if !more {
			return
		}
	}
}
func (g *GameServer) welcome(clientID ClientId, id int) {
	if g.events != nil {
		message := entity.ServerMessageWelcome{Type: entity.ServerMessageTypeWelcome, PlayerID: id, HostPlayerID: g.hostSlotIndex, Players: g.getLobbyPlayers(), State: cloneState(g.state), Code: g.code}
		g.eventQueue = append(g.eventQueue, func() { g.events.Send(clientID, message) })
	}
}
func (g *GameServer) broadcastLocked() {
	if g.events != nil {
		state := cloneState(g.state)
		players := append([]entity.LobbyPlayer(nil), g.getLobbyPlayers()...)
		host := g.hostSlotIndex
		g.eventQueue = append(g.eventQueue,
			func() { g.events.BroadcastState(state) },
			func() { g.events.BroadcastLobby(players, host) },
		)
	}
}
func (g *GameServer) send(clientID ClientId, message entity.ServerMessage) {
	if g.events != nil {
		g.eventQueue = append(g.eventQueue, func() { g.events.Send(clientID, message) })
	}
}
func (g *GameServer) sendError(clientID ClientId, message string) {
	g.send(clientID, entity.ServerMessageError{Type: entity.ServerMessageTypeError, Message: message})
}
func (g *GameServer) findClient(clientID ClientId) int {
	for i, s := range g.slots {
		if s.ClientID != nil && *s.ClientID == clientID {
			return i
		}
	}
	return -1
}
func (g *GameServer) findSlot() int {
	for i, s := range g.slots {
		if s.ClientID == nil && !s.IsBot {
			return i
		}
	}
	return -1
}
func (g *GameServer) isHost(clientID ClientId) bool { return g.findClient(clientID) == g.hostSlotIndex }
func (g *GameServer) isTurn(clientID ClientId) bool {
	return g.state.Phase != entity.GamePhaseSetup && g.findClient(clientID) == g.state.CurrentPlayer
}
func (g *GameServer) nextConnectedSlot(from int) int {
	for i := 1; i <= len(g.slots); i++ {
		id := (from + i) % len(g.slots)
		if g.slots[id].Connected && !g.slots[id].IsBot {
			return id
		}
	}
	return from
}
func (g *GameServer) getLobbyPlayers() []entity.LobbyPlayer {
	out := make([]entity.LobbyPlayer, len(g.slots))
	for i, s := range g.slots {
		out[i] = entity.LobbyPlayer{ID: i, Name: s.Name, Connected: s.Connected, IsBot: s.IsBot, Color: g.slotColor(s, i), Avatar: g.slotAvatar(s)}
	}
	return out
}
func (g *GameServer) slotColor(s Slot, index int) string {
	if s.Color != nil {
		return *s.Color
	}
	return data.PLAYER_COLORS[index%len(data.PLAYER_COLORS)]
}
func (g *GameServer) slotAvatar(s Slot) entity.PlayerAvatarData {
	if s.Avatar != nil {
		return *s.Avatar
	}
	return entity.NewPresetAvatarData("cat")
}
func (g *GameServer) nextFreeColor() string {
	used := map[string]bool{}
	for _, s := range g.slots {
		if s.Color != nil {
			used[*s.Color] = true
		}
	}
	for _, c := range data.PLAYER_COLORS {
		if !used[c] {
			return c
		}
	}
	return data.PLAYER_COLORS[0]
}
func (g *GameServer) nextFreeAvatar() entity.PlayerAvatarData {
	for _, id := range data.PRESET_AVATARS {
		candidate := entity.NewPresetAvatarData(id)
		value, _ := candidate.ToPlayerAvatar()
		if !g.isAvatarTaken(value, -1) {
			return candidate
		}
	}
	return entity.NewPresetAvatarData("cat")
}
func (g *GameServer) isColorTaken(value string, except int) bool {
	norm := data.NormalizeColor(value)
	for i, s := range g.slots {
		if i != except && s.Color != nil && s.Name != nil && data.NormalizeColor(*s.Color) == norm {
			return true
		}
	}
	return false
}
func (g *GameServer) isAvatarTaken(value entity.PlayerAvatar, except int) bool {
	for i, s := range g.slots {
		if i == except || s.Name == nil || s.Avatar == nil {
			continue
		}
		other, err := s.Avatar.ToPlayerAvatar()
		if err == nil && data.IsSameAvatar(other, value) {
			return true
		}
	}
	return false
}
func (g *GameServer) tradeParticipant(slot, tradeID int, cancel bool) bool {
	for _, t := range g.state.PendingTrades {
		if t.ID != tradeID {
			continue
		}
		if cancel {
			return t.FromID == slot
		}
		return t.ToID == slot
	}
	return false
}

var _ interface {
	GetState() entity.GameState
	GetPlayers() []entity.LobbyPlayer
	GetHostPlayerID() int
	Stop()
} = (*GameServer)(nil)
