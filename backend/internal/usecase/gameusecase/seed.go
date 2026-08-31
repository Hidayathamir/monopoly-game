package gameusecase

import (
	"fmt"
	"reflect"
	"sort"

	"monopoly-game-backend/internal/data"
	"monopoly-game-backend/internal/entity"
)

type SeedBoardOverride struct {
	Owner     *int
	Houses    *int
	Mortgaged *bool
}

type SeedPlayerSpec struct {
	ID                    int
	Name                  string
	Money                 int
	Position              *int
	Properties            []int
	PassedGo              *bool
	InJail                *bool
	JailTurns             *int
	Bankrupt              *bool
	GetOutOfJailFreeCards *int
	IsBot                 *bool
	BotControlled         *bool
	Afk                   *bool
	Color                 *string
	Avatar                *entity.PlayerAvatarData
}

type SeedSpec struct {
	Players       []SeedPlayerSpec
	Board         map[int]SeedBoardOverride
	CurrentPlayer int
	TurnOrder     *[]int
	Phase         *entity.GamePhase
	PendingAction *entity.PendingAction
	TradesEnabled *bool
}

const (
	ValidationKindOk    string = "ok"
	ValidationKindError string = "error"
)

type ValidationResult struct {
	Kind    string
	Message string
}

func Ok() ValidationResult {
	return ValidationResult{Kind: ValidationKindOk}
}

func Err(msg string) ValidationResult {
	return ValidationResult{Kind: ValidationKindError, Message: msg}
}

type SlotInfo struct {
	Name      *string
	Connected bool
	IsBot     bool
}

func CreateSeededState(spec SeedSpec) entity.GameState {
	board := make([]entity.Space, len(data.CreateInitialBoard()))
	copy(board, data.CreateInitialBoard())

	for id, override := range spec.Board {
		if id < 0 || id >= len(board) {
			continue
		}
		space := board[id]
		if override.Owner != nil {
			owner := *override.Owner
			space.Owner = &owner
		}
		if override.Houses != nil {
			space.Houses = *override.Houses
		}
		if override.Mortgaged != nil {
			space.Mortgaged = *override.Mortgaged
		}
		board[id] = space
	}

	owners := make(map[int][]int)
	for _, space := range board {
		if space.Owner == nil {
			continue
		}
		owners[*space.Owner] = append(owners[*space.Owner], space.ID)
	}

	specPlayers := make([]SeedPlayerSpec, len(spec.Players))
	copy(specPlayers, spec.Players)
	sort.Slice(specPlayers, func(i, j int) bool {
		return specPlayers[i].ID < specPlayers[j].ID
	})

	players := make([]entity.Player, len(specPlayers))
	for i, p := range specPlayers {
		defaultAvatar := entity.NewPresetAvatarData("cat")
		players[i] = entity.Player{
			ID:                    p.ID,
			Name:                  p.Name,
			Money:                 p.Money,
			Position:              derefOr(p.Position, 0),
			Properties:            owners[p.ID],
			PassedGo:              derefBool(p.PassedGo, true),
			InJail:                derefBool(p.InJail, false),
			JailTurns:             derefOr(p.JailTurns, 0),
			Bankrupt:              derefBool(p.Bankrupt, false),
			GetOutOfJailFreeCards: derefOr(p.GetOutOfJailFreeCards, 0),
			IsBot:                 derefBool(p.IsBot, false),
			BotControlled:         derefBool(p.BotControlled, false),
			Afk:                   derefBool(p.Afk, false),
			Color:                 derefColor(p.Color, p.ID),
			Avatar:                derefOrAvatar(p.Avatar, &defaultAvatar),
		}
	}

	turnOrder := playersToIDs(players)
	if spec.TurnOrder != nil {
		turnOrder = *spec.TurnOrder
	}

	phase := entity.GamePhaseWaiting
	if spec.Phase != nil {
		phase = *spec.Phase
	}

	tradesEnabled := false
	if spec.TradesEnabled != nil {
		tradesEnabled = *spec.TradesEnabled
	}

	chanceDeck := make([]entity.Card, len(data.CHANCE_CARDS))
	copy(chanceDeck, data.CHANCE_CARDS)
	communityDeck := make([]entity.Card, len(data.COMMUNITY_CARDS))
	copy(communityDeck, data.COMMUNITY_CARDS)

	return entity.GameState{
		Phase:             phase,
		Players:           players,
		TurnOrder:         turnOrder,
		CurrentPlayer:     spec.CurrentPlayer,
		Board:             board,
		ChanceDeck:        chanceDeck,
		CommunityDeck:     communityDeck,
		FreeParkingPot:    0,
		Dice:              nil,
		DoublesCount:      0,
		LastMoveSteps:     nil,
		EventLog:          []entity.LogEntry{},
		PendingAction:     spec.PendingAction,
		JustBoughtSpaceID: nil,
		BuiltThisStop:     false,
		ReconnectGrace:    nil,
		PendingTrades:     []entity.PendingTrade{},
		NextTradeID:       0,
		TradesEnabled:     tradesEnabled,
	}
}

func ValidateStateStructure(state entity.GameState) ValidationResult {
	return validateStateStructure(state, false)
}

func validateStateStructure(state entity.GameState, allowPlaceholders bool) ValidationResult {
	if len(state.Board) != data.BoardSize {
		return Err(fmt.Sprintf("board must have %d spaces, got %d", data.BoardSize, len(state.Board)))
	}

	if len(state.Players) > data.MAX_PLAYERS {
		return Err(fmt.Sprintf("players must have at most %d slots", data.MAX_PLAYERS))
	}

	playerIDs := make([]int, 0, len(state.Players))
	for i, p := range state.Players {
		if p.ID != i {
			return Err(fmt.Sprintf("player %d must sit at players[%d] (slot index)", p.ID, i))
		}
		if p.Name == "" {
			if !allowPlaceholders || !isEmptyPlayerSlot(p, i) {
				return Err(fmt.Sprintf("empty player slot %d is malformed", i))
			}
			continue
		}
		playerIDs = append(playerIDs, p.ID)
	}

	if !uniqueInts(playerIDs) {
		return Err("player ids must be unique")
	}

	if intSliceHasRangeOut(playerIDs, 0, data.MAX_PLAYERS) {
		return Err(fmt.Sprintf("player ids must be in 0..%d", data.MAX_PLAYERS-1))
	}

	expectedTurn := sortedInts(playerIDs)
	actualTurn := sortedInts(state.TurnOrder)
	if len(state.TurnOrder) != len(playerIDs) || !intsEqual(expectedTurn, actualTurn) {
		return Err("turnOrder must be a permutation of the player ids")
	}

	if !intsIncludes(state.TurnOrder, state.CurrentPlayer) {
		return Err("currentPlayer must be in turnOrder")
	}

	for _, s := range state.Board {
		if s.Owner != nil && !intsIncludes(playerIDs, *s.Owner) {
			return Err("board has an owner that is not a player id")
		}
	}

	for _, s := range state.Board {
		if s.Houses < 0 || s.Houses > data.MaxHouses {
			return Err("houses must be within 0..5")
		}
	}

	for _, player := range state.Players {
		owned := make([]int, 0)
		for _, s := range state.Board {
			if s.Owner != nil && *s.Owner == player.ID {
				owned = append(owned, s.ID)
			}
		}
		owned = sortedInts(owned)
		claimed := sortedInts(player.Properties)
		if !intsEqual(owned, claimed) {
			return Err(fmt.Sprintf("player %d (%s) properties must match its owned board spaces", player.ID, player.Name))
		}
	}

	for _, p := range state.Players {
		if p.Money < 0 {
			return Err("player money must be a non-negative finite number")
		}
	}

	for _, p := range state.Players {
		if p.Position < 0 || p.Position >= data.BoardSize {
			return Err("player position must be within 0..39")
		}
	}

	for _, p := range state.Players {
		if !isColorValid(p.Color) {
			return Err(fmt.Sprintf("player %d (%s) has an invalid color", p.ID, p.Name))
		}
		if !isAvatarValid(p.Avatar) {
			return Err(fmt.Sprintf("player %d (%s) has an invalid avatar", p.ID, p.Name))
		}
	}

	if state.Phase == entity.GamePhaseWaiting && state.PendingAction != nil {
		return Err("Waiting state must have pendingAction === null")
	}

	if state.Phase == entity.GamePhaseResolving && state.PendingAction == nil {
		return Err("Resolving state must have a pendingAction")
	}

	return Ok()
}

func isEmptyPlayerSlot(player entity.Player, index int) bool {
	return player.ID == index && player.Name == "" && player.Money == 0 && player.Position == 0 && len(player.Properties) == 0 && !player.PassedGo && !player.InJail && player.JailTurns == 0 && !player.Bankrupt && player.GetOutOfJailFreeCards == 0 && !player.IsBot && !player.BotControlled && !player.Afk && player.Color == data.PLAYER_COLORS[index%len(data.PLAYER_COLORS)] && reflect.DeepEqual(player.Avatar, entity.NewPresetAvatarData("cat"))
}

func ValidateStateForRoom(state entity.GameState, slots []SlotInfo) ValidationResult {
	joined := 0
	lastJoined := -1
	for i, slot := range slots {
		if slot.Name != nil {
			joined++
			lastJoined = i
		}
	}
	active := 0
	for _, player := range state.Players {
		if player.Name != "" {
			active++
		}
	}
	if active != joined {
		return Err(fmt.Sprintf("seed has %d players but the room has %d joined slots", active, joined))
	}
	if len(state.Players) < lastJoined+1 {
		return Err(fmt.Sprintf("seed has %d player slots but the room requires at least %d slots", len(state.Players), lastJoined+1))
	}

	for i, slot := range slots {
		if i >= len(state.Players) {
			continue
		}
		player := state.Players[i]
		if slot.Name == nil {
			if !isEmptyPlayerSlot(player, i) {
				return Err(fmt.Sprintf("player slot %d must be an empty placeholder", i))
			}
			continue
		}
		if player.Name != *slot.Name {
			return Err(fmt.Sprintf("player %d name does not match its joined slot", i))
		}
	}

	if len(state.TurnOrder) != joined {
		return Err("turnOrder must contain exactly the joined slot ids")
	}
	for _, id := range state.TurnOrder {
		if id < 0 || id >= len(slots) || slots[id].Name == nil {
			return Err("turnOrder must contain exactly the joined slot ids")
		}
	}

	if state.CurrentPlayer < 0 || state.CurrentPlayer >= len(slots) {
		return Err("currentPlayer must be a connected client or a bot slot")
	}
	current := slots[state.CurrentPlayer]
	if current.Name == nil || (!current.Connected && !current.IsBot) {
		return Err("currentPlayer must be a connected client or a bot slot")
	}

	return Ok()
}

func playersToIDs(players []entity.Player) []int {
	out := make([]int, len(players))
	for i, p := range players {
		out[i] = p.ID
	}
	return out
}

func derefBool(v *bool, def bool) bool {
	if v == nil {
		return def
	}
	return *v
}

func derefOr(v *int, def int) int {
	if v == nil {
		return def
	}
	return *v
}

func derefOrAvatar(v *entity.PlayerAvatarData, def *entity.PlayerAvatarData) entity.PlayerAvatarData {
	if v == nil {
		return *def
	}
	return *v
}

func derefColor(v *string, playerID int) string {
	if v == nil {
		return data.PLAYER_COLORS[playerID%len(data.PLAYER_COLORS)]
	}
	return *v
}

func uniqueInts(s []int) bool {
	seen := make(map[int]bool, len(s))
	for _, v := range s {
		if seen[v] {
			return false
		}
		seen[v] = true
	}
	return true
}

func intSliceHasRangeOut(s []int, lo, hi int) bool {
	for _, v := range s {
		if v < lo || v >= hi {
			return true
		}
	}
	return false
}

func sortedInts(s []int) []int {
	out := make([]int, len(s))
	copy(out, s)
	sort.Ints(out)
	return out
}

func intsEqual(a, b []int) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func intsIncludes(s []int, v int) bool {
	for _, x := range s {
		if x == v {
			return true
		}
	}
	return false
}

func isColorValid(color string) bool {
	for _, c := range data.PLAYER_COLORS {
		if c == color {
			return true
		}
	}
	return false
}

func isAvatarValid(av entity.PlayerAvatarData) bool {
	if av.Kind == "" || av.Data == nil {
		return false
	}
	pa, err := av.ToPlayerAvatar()
	if err != nil {
		return false
	}
	return data.IsValidAvatar(pa)
}
