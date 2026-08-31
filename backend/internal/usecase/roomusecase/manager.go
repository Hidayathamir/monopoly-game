package roomusecase

import (
	"math/rand"
	"monopoly-game-backend/internal/entity"
	"monopoly-game-backend/pkg/clock"
	"sync"
	"sync/atomic"
	"time"
)

const (
	CodeAlphabet   = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
	CodeLength     = 5
	RoomEmptyGrace = 30 * time.Second
	AFKTimeout     = 30 * time.Second
)

type GameServer interface {
	GetState() entity.GameState
	GetPlayers() []entity.LobbyPlayer
	GetHostPlayerID() int
	Stop()
}

type GameFactory func(code string, opts GameOptions) GameServer

type GameEvents interface {
	BroadcastState(state entity.GameState)
	BroadcastLobby(players []entity.LobbyPlayer, hostPlayerID int)
	BroadcastEmoticon(playerID int, emoticon entity.Emoticon)
	Send(clientID string, message entity.ServerMessage)
}

type GameEventFactory func(code string) GameEvents

type RoomRepository interface {
	Create(code string, game GameServer)
	Get(code string) GameServer
	Delete(code string)
	List() []entity.RoomInfo
}

type SessionRepository interface {
	Set(clientID, roomCode string)
	GetRoomCode(clientID string) (string, bool)
	GetClients(roomCode string) []string
	Delete(clientID string)
	DeleteAll(roomCode string)
}

type GameOptions struct {
	TradesEnabled bool
	SeedEnabled   bool
	AFKTimeout    time.Duration
	Events        GameEvents
}

type Options struct {
	Clock             clock.Clock
	RNG               func() float64
	TradesEnabled     bool
	SeedEnabled       bool
	AFKTimeout        time.Duration
	RoomEmptyGrace    time.Duration
	RoomRepository    RoomRepository
	SessionRepository SessionRepository
	Events            GameEventFactory
}

type RoomManager struct {
	mu                 sync.Mutex
	rooms              map[string]GameServer
	clientRoom         map[string]string
	roomClients        map[string]map[string]struct{}
	teardownTimers     map[string]clock.Timer
	teardownTokens     map[string]uint64
	clock              clock.Clock
	rng                func() float64
	gameOptions        GameOptions
	roomEmptyGrace     time.Duration
	factory            GameFactory
	roomRepository     RoomRepository
	sessionRepository  SessionRepository
	events             GameEventFactory
	beforeTeardown     func()
	recipientSnapshots atomic.Value
}

func NewRoomManager(factory GameFactory, opts Options) *RoomManager {
	c := opts.Clock
	if c == nil {
		c = clock.RealClock{}
	}
	rng := opts.RNG
	if rng == nil {
		rng = rand.Float64
	}
	grace := opts.RoomEmptyGrace
	if grace == 0 {
		grace = RoomEmptyGrace
	}
	afkTimeout := opts.AFKTimeout
	if afkTimeout == 0 {
		afkTimeout = AFKTimeout
	}
	m := &RoomManager{
		rooms:             make(map[string]GameServer),
		clientRoom:        make(map[string]string),
		roomClients:       make(map[string]map[string]struct{}),
		teardownTimers:    make(map[string]clock.Timer),
		teardownTokens:    make(map[string]uint64),
		clock:             c,
		rng:               rng,
		gameOptions:       GameOptions{TradesEnabled: opts.TradesEnabled, SeedEnabled: opts.SeedEnabled, AFKTimeout: afkTimeout},
		roomEmptyGrace:    grace,
		factory:           factory,
		roomRepository:    opts.RoomRepository,
		sessionRepository: opts.SessionRepository,
		events:            opts.Events,
	}
	m.publishRecipientsLocked()
	return m
}

func (m *RoomManager) snapshotRecipientsLocked() map[string][]string {
	snapshots := make(map[string][]string, len(m.roomClients))
	for code, clients := range m.roomClients {
		snapshot := make([]string, 0, len(clients))
		for clientID := range clients {
			snapshot = append(snapshot, clientID)
		}
		snapshots[code] = snapshot
	}
	return snapshots
}

func (m *RoomManager) publishRecipientsLocked() {
	m.recipientSnapshots.Store(m.snapshotRecipientsLocked())
}

func (m *RoomManager) Create() (string, GameServer) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.createLocked()
}

func (m *RoomManager) CreateAndRegister(clientID string, join func(GameServer) bool) (string, GameServer, bool) {
	m.mu.Lock()
	code, game := m.createLocked()
	if game == nil || join == nil || !join(game) {
		if game != nil {
			m.deleteRoomLocked(code, game)
		}
		m.mu.Unlock()
		if game != nil {
			game.Stop()
		}
		return code, game, false
	}
	previous := m.clientRoom[clientID]
	if previous != "" && previous != code {
		delete(m.roomClients[previous], clientID)
	}
	m.clientRoom[clientID] = code
	m.roomClients[code][clientID] = struct{}{}
	if m.sessionRepository != nil {
		m.sessionRepository.Set(clientID, code)
	}
	m.publishRecipientsLocked()
	m.clearTeardownLocked(code)

	var previousGame GameServer
	if previous != "" && previous != code && len(m.roomClients[previous]) == 0 {
		previousGame = m.rooms[previous]
	}
	m.mu.Unlock()
	if previousGame != nil {
		m.evaluateTeardown(previous, previousGame)
	}
	return code, game, true
}

func (m *RoomManager) createLocked() (string, GameServer) {
	if m.factory == nil {
		return "", nil
	}
	code := m.generateCode()
	gameOptions := m.gameOptions
	if m.events != nil {
		gameOptions.Events = m.events(code)
	}
	game := m.factory(code, gameOptions)
	if game == nil {
		return "", nil
	}
	m.rooms[code] = game
	m.roomClients[code] = make(map[string]struct{})
	if m.roomRepository != nil {
		m.roomRepository.Create(code, game)
	}
	return code, game
}

func (m *RoomManager) Get(code string) GameServer {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.rooms[code]
}

func (m *RoomManager) List() []entity.RoomInfo {
	m.mu.Lock()
	games := make(map[string]GameServer, len(m.rooms))
	for code, game := range m.rooms {
		games[code] = game
	}
	m.mu.Unlock()

	infos := make([]entity.RoomInfo, 0, len(games))
	for code, game := range games {
		if game == nil {
			continue
		}
		players := game.GetPlayers()
		var hostName *string
		hostSlot := game.GetHostPlayerID()
		playerCount := 0
		for index, player := range players {
			if index == hostSlot && player.Name != nil {
				name := *player.Name
				hostName = &name
			}
			if player.Name != nil {
				playerCount++
			}
		}
		if playerCount == 0 {
			continue
		}
		infos = append(infos, entity.RoomInfo{Code: code, HostName: hostName, PlayerCount: playerCount, Phase: game.GetState().Phase})
	}
	return infos
}

func (m *RoomManager) AddClient(code, clientID string) {
	m.mu.Lock()
	previous := m.clientRoom[clientID]
	if previous != "" && previous != code {
		delete(m.roomClients[previous], clientID)
	}
	m.clientRoom[clientID] = code
	if clients := m.roomClients[code]; clients != nil {
		clients[clientID] = struct{}{}
	}
	if m.sessionRepository != nil {
		m.sessionRepository.Set(clientID, code)
	}
	m.publishRecipientsLocked()
	m.clearTeardownLocked(code)
	var previousGame GameServer
	if previous != "" && previous != code && len(m.roomClients[previous]) == 0 {
		previousGame = m.rooms[previous]
	}
	m.mu.Unlock()
	if previousGame != nil {
		m.evaluateTeardown(previous, previousGame)
	}
}

func (m *RoomManager) RemoveClient(clientID string) string {
	code, game, empty := m.removeClient(clientID)
	if empty && game != nil {
		m.evaluateTeardown(code, game)
	}
	return code
}

func (m *RoomManager) RemoveClientBeforeLeave(clientID string) (string, GameServer) {
	code, game, _ := m.removeClient(clientID)
	return code, game
}

func (m *RoomManager) EvaluateTeardown(code string, game GameServer) {
	if code != "" && game != nil {
		m.evaluateTeardown(code, game)
	}
}

func (m *RoomManager) removeClient(clientID string) (string, GameServer, bool) {
	m.mu.Lock()
	code := m.clientRoom[clientID]
	if code == "" {
		m.mu.Unlock()
		return "", nil, false
	}
	delete(m.roomClients[code], clientID)
	delete(m.clientRoom, clientID)
	if m.sessionRepository != nil {
		m.sessionRepository.Delete(clientID)
	}
	m.publishRecipientsLocked()
	game := m.rooms[code]
	empty := len(m.roomClients[code]) == 0
	m.mu.Unlock()
	return code, game, empty
}

func (m *RoomManager) GameFor(clientID string) GameServer {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.rooms[m.clientRoom[clientID]]
}

func (m *RoomManager) CodeFor(clientID string) string {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.clientRoom[clientID]
}

func (m *RoomManager) ClientsFor(code string) []string {
	value := m.recipientSnapshots.Load()
	if value == nil {
		return nil
	}
	snapshots := value.(map[string][]string)
	return append([]string(nil), snapshots[code]...)
}

func (m *RoomManager) RollbackCreate(code string, game GameServer) bool {
	m.mu.Lock()
	if !m.deleteRoomLocked(code, game) {
		m.mu.Unlock()
		return false
	}
	m.mu.Unlock()
	game.Stop()
	return true
}

func (m *RoomManager) evaluateTeardown(code string, game GameServer) {
	players := game.GetPlayers()
	hasNamedHuman := false
	hasConnectedHuman := false
	for _, player := range players {
		if !player.IsBot && player.Name != nil {
			hasNamedHuman = true
		}
		if !player.IsBot && player.Connected {
			hasConnectedHuman = true
		}
	}
	if m.beforeTeardown != nil {
		m.beforeTeardown()
	}
	m.mu.Lock()
	if m.rooms[code] != game || len(m.roomClients[code]) != 0 {
		m.clearTeardownLocked(code)
		m.mu.Unlock()
		return
	}
	if !hasNamedHuman {
		m.deleteRoomLocked(code, game)
		m.mu.Unlock()
		game.Stop()
		return
	}
	m.clearTeardownLocked(code)
	if hasConnectedHuman {
		m.mu.Unlock()
		return
	}
	m.teardownTokens[code]++
	token := m.teardownTokens[code]
	grace := m.roomEmptyGrace
	m.mu.Unlock()

	timer := m.clock.AfterFunc(grace, func() { m.teardown(code, token, game) })
	m.mu.Lock()
	if m.teardownTokens[code] == token && m.rooms[code] == game && len(m.roomClients[code]) == 0 {
		m.teardownTimers[code] = timer
		m.mu.Unlock()
		return
	}
	m.mu.Unlock()
	timer.Stop()
}

func (m *RoomManager) clearTeardownLocked(code string) {
	if timer := m.teardownTimers[code]; timer != nil {
		timer.Stop()
		delete(m.teardownTimers, code)
	}
	m.teardownTokens[code]++
}

func (m *RoomManager) teardown(code string, token uint64, expected GameServer) {
	m.mu.Lock()
	if m.teardownTokens[code] != token || m.rooms[code] != expected || len(m.roomClients[code]) != 0 {
		m.mu.Unlock()
		return
	}
	m.deleteRoomLocked(code, expected)
	m.mu.Unlock()
	expected.Stop()
}

func (m *RoomManager) deleteRoom(code string, expected GameServer) {
	m.mu.Lock()
	if !m.deleteRoomLocked(code, expected) {
		m.mu.Unlock()
		return
	}
	m.mu.Unlock()
	expected.Stop()
}

func (m *RoomManager) deleteRoomLocked(code string, expected GameServer) bool {
	game, ok := m.rooms[code]
	if !ok || game != expected || len(m.roomClients[code]) != 0 {
		return false
	}
	m.clearTeardownLocked(code)
	delete(m.rooms, code)
	delete(m.roomClients, code)
	if m.roomRepository != nil {
		m.roomRepository.Delete(code)
	}
	if m.sessionRepository != nil {
		m.sessionRepository.DeleteAll(code)
	}
	for clientID, roomCode := range m.clientRoom {
		if roomCode == code {
			delete(m.clientRoom, clientID)
		}
	}
	m.publishRecipientsLocked()
	return true
}

func (m *RoomManager) generateCode() string {
	for {
		code := make([]byte, CodeLength)
		for i := range code {
			index := int(m.rng() * float64(len(CodeAlphabet)))
			if index < 0 {
				index = 0
			}
			if index >= len(CodeAlphabet) {
				index = len(CodeAlphabet) - 1
			}
			code[i] = CodeAlphabet[index]
		}
		value := string(code)
		if _, exists := m.rooms[value]; !exists {
			return value
		}
	}
}
