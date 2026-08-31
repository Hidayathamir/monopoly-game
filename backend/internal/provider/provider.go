package provider

import (
	"time"

	"monopoly-game-backend/internal/config"
	"monopoly-game-backend/internal/dependency_injection"
	"monopoly-game-backend/internal/entity"
	httpinbound "monopoly-game-backend/internal/inbound/http"
	wsinbound "monopoly-game-backend/internal/inbound/ws"
	"monopoly-game-backend/internal/usecase/roomusecase"
	"monopoly-game-backend/pkg/clock"
)

type Provider struct {
	Config      *config.Config
	Clock       clock.Clock
	RoomManager *roomusecase.RoomManager
	WSHub       *wsinbound.Hub
	WSHandler   *wsinbound.Handler
	HTTPHandler *httpinbound.Handler
}

func NewProvider(cfg *config.Config) *Provider {
	if cfg == nil {
		cfg = config.Load()
	}

	c := clock.RealClock{}
	hub := wsinbound.NewHub()
	var manager *roomusecase.RoomManager
	manager = dependency_injection.NewRoomManagerWithOptions(
		dependency_injection.NewRoomRepository(),
		dependency_injection.NewSessionRepository(),
		c,
		func(code string) roomusecase.GameEvents {
			return &gameEvents{hub: hub, roomManager: manager, code: code}
		},
		roomusecase.Options{
			TradesEnabled:  cfg.TradesEnabled,
			SeedEnabled:    cfg.SeedEnabled,
			AFKTimeout:     time.Duration(cfg.AFKTimeoutMs) * time.Millisecond,
			RoomEmptyGrace: time.Duration(cfg.RoomEmptyGraceMs) * time.Millisecond,
		},
	)
	return &Provider{
		Config:      cfg,
		Clock:       c,
		RoomManager: manager,
		WSHub:       hub,
		WSHandler:   dependency_injection.NewWSHandler(hub, manager),
		HTTPHandler: dependency_injection.NewHTTPHandler(cfg.DistDir, manager, cfg.SeedEnabled),
	}
}

type gameEvents struct {
	hub         *wsinbound.Hub
	roomManager *roomusecase.RoomManager
	code        string
}

func (e *gameEvents) BroadcastState(state entity.GameState) {
	e.broadcast(entity.ServerMessageState{Type: entity.ServerMessageTypeState, State: state})
}

func (e *gameEvents) BroadcastLobby(players []entity.LobbyPlayer, hostPlayerID int) {
	e.broadcast(entity.ServerMessageLobby{Type: entity.ServerMessageTypeLobby, Players: players, HostPlayerID: hostPlayerID})
}

func (e *gameEvents) BroadcastEmoticon(playerID int, emoticon entity.Emoticon) {
	e.broadcast(entity.ServerMessageEmoticon{Type: entity.ServerMessageTypeEmoticon, PlayerID: playerID, Emoticon: emoticon})
}

func (e *gameEvents) Send(clientID string, message entity.ServerMessage) {
	_ = e.hub.Send(clientIDInt(clientID), message)
}

func (e *gameEvents) broadcast(message entity.ServerMessage) {
	clients := e.roomManager.ClientsFor(e.code)
	ids := make([]int, 0, len(clients))
	for _, clientID := range clients {
		if id := clientIDInt(clientID); id >= 0 {
			ids = append(ids, id)
		}
	}
	e.hub.Broadcast(ids, message)
}

func clientIDInt(value string) int {
	var id int
	for _, digit := range value {
		if digit < '0' || digit > '9' {
			return -1
		}
		id = id*10 + int(digit-'0')
	}
	return id
}
