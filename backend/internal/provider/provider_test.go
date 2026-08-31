package provider

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"monopoly-game-backend/internal/config"
	"monopoly-game-backend/internal/entity"
	wsinbound "monopoly-game-backend/internal/inbound/ws"
	"monopoly-game-backend/internal/usecase/gameusecase"
	"monopoly-game-backend/internal/usecase/roomusecase"
)

func TestNewProviderWiresRuntimeAndConfig(t *testing.T) {
	cfg := &config.Config{DistDir: "dist", TradesEnabled: true, SeedEnabled: true, AFKTimeoutMs: 1000, RoomEmptyGraceMs: 2000}
	p := NewProvider(cfg)

	if p.Config != cfg {
		t.Fatal("provider did not retain config")
	}
	if p.Clock == nil || p.RoomManager == nil || p.WSHub == nil || p.WSHandler == nil || p.HTTPHandler == nil {
		t.Fatal("provider did not construct all runtime dependencies")
	}

	_, game := p.RoomManager.Create()
	state := game.GetState()
	if !state.TradesEnabled {
		t.Fatal("provider did not forward trades configuration")
	}
}

func TestLeaveSendsActorAndPeerTheHistoricalSequence(t *testing.T) {
	p := NewProvider(&config.Config{DistDir: t.TempDir(), RoomEmptyGraceMs: 1000})
	actor, actorServer := providerWebSocketPair(t)
	peer, peerServer := providerWebSocketPair(t)
	actorID := p.WSHub.Add(actorServer)
	peerID := p.WSHub.Add(peerServer)
	code, game := p.RoomManager.Create()
	server, ok := game.(interface {
		Join(string, string, gameusecase.JoinOptions) bool
		Start(string)
		GetState() entity.GameState
		Leave(string)
	})
	if !ok {
		t.Fatal("created game does not expose leave protocol")
	}
	if !server.Join(clientID(actorID), "Alice", gameusecase.JoinOptions{}) || !server.Join(clientID(peerID), "Bob", gameusecase.JoinOptions{}) {
		t.Fatal("players did not join")
	}
	p.RoomManager.AddClient(code, clientID(actorID))
	p.RoomManager.AddClient(code, clientID(peerID))
	readProviderMessage(t, actor, entity.ServerMessageTypeWelcome)
	readProviderMessage(t, peer, entity.ServerMessageTypeWelcome)
	server.Start(clientID(actorID))
	if state := server.GetState(); state.Phase == entity.GamePhaseSetup {
		t.Fatal("game did not start")
	}
	for _, client := range []*websocket.Conn{actor, peer} {
		readProviderMessage(t, client, entity.ServerMessageTypeState)
		readProviderMessage(t, client, entity.ServerMessageTypeLobby)
	}
	server.Leave(clientID(actorID))
	if got := nextMessageType(actor, time.Second); got != entity.ServerMessageTypeLeft {
		t.Fatalf("actor first message = %q, want left", got)
	}
	if got := nextMessageType(actor, time.Second); got != entity.ServerMessageTypeState {
		t.Fatalf("actor second message = %q, want state", got)
	}
	if got := nextMessageType(actor, time.Second); got != entity.ServerMessageTypeLobby {
		t.Fatalf("actor third message = %q, want lobby", got)
	}
	for _, want := range []string{entity.ServerMessageTypeState, entity.ServerMessageTypeLobby} {
		if got := nextMessageType(peer, time.Second); got != want {
			t.Fatalf("peer message = %q, want %q", got, want)
		}
	}
	p.RoomManager.RemoveClient(clientID(actorID))
}

func readWelcomeCode(t *testing.T, client *websocket.Conn) string {
	t.Helper()
	for {
		_, data, err := client.ReadMessage()
		if err != nil {
			t.Fatal(err)
		}
		var message struct {
			Type string `json:"type"`
			Code string `json:"code"`
		}
		if err := json.Unmarshal(data, &message); err != nil {
			t.Fatal(err)
		}
		if message.Type == entity.ServerMessageTypeWelcome {
			return message.Code
		}
	}
}

func drainMessages(client *websocket.Conn) {
	_ = client.SetReadDeadline(time.Now().Add(30 * time.Millisecond))
	for {
		if _, _, err := client.ReadMessage(); err != nil {
			_ = client.SetReadDeadline(time.Time{})
			return
		}
	}
}

func messageType(t *testing.T, client *websocket.Conn, timeout time.Duration) string {
	t.Helper()
	return nextMessageType(client, timeout)
}

func nextMessageType(client *websocket.Conn, timeout time.Duration) string {
	_ = client.SetReadDeadline(time.Now().Add(timeout))
	_, data, err := client.ReadMessage()
	if err != nil {
		return ""
	}
	var message struct {
		Type string `json:"type"`
	}
	if json.Unmarshal(data, &message) != nil {
		return ""
	}
	return message.Type
}

func TestGameEventsBroadcastsToRoomClients(t *testing.T) {
	client, serverConn := providerWebSocketPair(t)
	hub := wsinbound.NewHub()
	id := hub.Add(serverConn)
	manager := providerRoomManager(t)
	code, _ := manager.Create()
	manager.AddClient(code, clientID(id))
	events := &gameEvents{hub: hub, roomManager: manager, code: code}

	events.BroadcastState(entity.GameState{
		Phase:         entity.GamePhaseSetup,
		Players:       []entity.Player{},
		TurnOrder:     []int{},
		Board:         []entity.Space{},
		ChanceDeck:    []entity.Card{},
		CommunityDeck: []entity.Card{},
		EventLog:      []entity.LogEntry{},
		PendingTrades: []entity.PendingTrade{{ID: 1}},
	})
	_, data, err := client.ReadMessage()
	if err != nil {
		t.Fatalf("read state message: %v", err)
	}
	var message struct {
		Type  string           `json:"type"`
		State entity.GameState `json:"state"`
	}
	if err := json.Unmarshal(data, &message); err != nil {
		t.Fatalf("decode state message: %v", err)
	}
	if message.Type != entity.ServerMessageTypeState || message.State.Phase != entity.GamePhaseSetup {
		t.Fatalf("unexpected state message: %s", data)
	}
	var raw struct {
		State map[string]json.RawMessage `json:"state"`
	}
	if err := json.Unmarshal(data, &raw); err != nil {
		t.Fatalf("decode raw state message: %v", err)
	}
	for _, field := range []string{"players", "turnOrder", "board", "chanceDeck", "communityDeck", "eventLog", "pendingTrades"} {
		if string(raw.State[field]) != "[]" && field != "pendingTrades" {
			t.Errorf("%s: got %s, want []", field, raw.State[field])
		}
	}
	if string(raw.State["pendingTrades"]) != `[{"id":1,"fromId":0,"toId":0,"offerProperties":[],"offerCash":0,"requestProperties":[],"requestCash":0}]` {
		t.Errorf("pendingTrades: got %s", raw.State["pendingTrades"])
	}
}

func TestGameEventsBroadcastsLobbyAndEmoticon(t *testing.T) {
	client, serverConn := providerWebSocketPair(t)
	hub := wsinbound.NewHub()
	id := hub.Add(serverConn)
	manager := providerRoomManager(t)
	code, _ := manager.Create()
	manager.AddClient(code, clientID(id))
	events := &gameEvents{hub: hub, roomManager: manager, code: code}

	events.BroadcastLobby(nil, 2)
	readProviderMessage(t, client, entity.ServerMessageTypeLobby)
	events.BroadcastEmoticon(1, "smile")
	readProviderMessage(t, client, entity.ServerMessageTypeEmoticon)
}

func providerRoomManager(t *testing.T) *roomusecase.RoomManager {
	t.Helper()
	manager := roomusecase.NewRoomManager(func(string, roomusecase.GameOptions) roomusecase.GameServer {
		return &providerTestGame{}
	}, roomusecase.Options{})
	return manager
}

type providerTestGame struct{}

func (*providerTestGame) GetState() entity.GameState       { return entity.GameState{} }
func (*providerTestGame) GetPlayers() []entity.LobbyPlayer { return nil }
func (*providerTestGame) GetHostPlayerID() int             { return 0 }
func (*providerTestGame) Stop()                            {}

func readProviderMessage(t *testing.T, client *websocket.Conn, expectedType string) {
	t.Helper()
	_, data, err := client.ReadMessage()
	if err != nil {
		t.Fatalf("read %s message: %v", expectedType, err)
	}
	var message struct {
		Type string `json:"type"`
	}
	if err := json.Unmarshal(data, &message); err != nil {
		t.Fatalf("decode %s message: %v", expectedType, err)
	}
	if message.Type != expectedType {
		t.Fatalf("expected %s message, got %s", expectedType, data)
	}
}

func providerWebSocketPair(t *testing.T) (*websocket.Conn, *websocket.Conn) {
	t.Helper()
	connections := make(chan *websocket.Conn, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := (&websocket.Upgrader{CheckOrigin: func(*http.Request) bool { return true }}).Upgrade(w, r, nil)
		if err != nil {
			t.Errorf("upgrade: %v", err)
			return
		}
		connections <- conn
	}))
	t.Cleanup(server.Close)

	url := "ws" + server.URL[len("http"):]
	client, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	t.Cleanup(func() { _ = client.Close() })
	serverConn := <-connections
	t.Cleanup(func() { _ = serverConn.Close() })
	return client, serverConn
}

func clientID(id int) string {
	return fmt.Sprintf("%d", id)
}
