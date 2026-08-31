package ws

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"monopoly-game-backend/internal/dto"
	"monopoly-game-backend/internal/entity"
	httpinbound "monopoly-game-backend/internal/inbound/http"
	"monopoly-game-backend/internal/usecase/gameusecase"
	"monopoly-game-backend/internal/usecase/roomusecase"
	"monopoly-game-backend/pkg/clock"
)

type handlerGame struct {
	mu       sync.RWMutex
	players  []entity.LobbyPlayer
	current  string
	joined   chan string
	left     chan string
	toggle   chan string
	leaveFn  func(string)
	stopped  chan struct{}
	failJoin bool
}

func (g *handlerGame) GetState() entity.GameState       { return entity.GameState{} }
func (g *handlerGame) GetPlayers() []entity.LobbyPlayer { return g.players }
func (g *handlerGame) GetHostPlayerID() int             { return 0 }
func (g *handlerGame) Stop() {
	if g.stopped != nil {
		select {
		case g.stopped <- struct{}{}:
		default:
		}
	}
}
func (g *handlerGame) Join(id, name string, _ gameusecase.JoinOptions) bool {
	if g.failJoin {
		return false
	}
	g.mu.Lock()
	g.current = id
	g.mu.Unlock()
	g.joined <- id
	return true
}
func (g *handlerGame) Start(string) {}
func (g *handlerGame) Leave(id string) {
	if g.leaveFn != nil {
		g.leaveFn(id)
	}
	g.left <- id
}

func TestExplicitMidGameLeaveSchedulesRoomTeardownAfterGrace(t *testing.T) {
	name := "Alice"
	fc := clock.NewFakeClock()
	game := &handlerGame{
		players: []entity.LobbyPlayer{{Name: &name, Connected: true}},
		joined:  make(chan string, 1),
		left:    make(chan string, 1),
		stopped: make(chan struct{}, 1),
	}
	rm := roomusecase.NewRoomManager(func(string, roomusecase.GameOptions) roomusecase.GameServer { return game }, roomusecase.Options{
		Clock:          fc,
		RoomEmptyGrace: time.Second,
		RNG:            func() float64 { return 0 },
	})
	leaveSawClient := false
	game.leaveFn = func(id string) {
		leaveSawClient = rm.CodeFor(id) != ""
		game.players[0].Connected = false
	}
	h := NewHandler(NewHub(), rm)
	code, _, ok := rm.CreateAndRegister("client", func(roomusecase.GameServer) bool { return true })
	if !ok {
		t.Fatal("failed to register client")
	}

	h.route("client", dto.ClientMessageDTO{Type: entity.ClientMessageTypeLeave})
	select {
	case id := <-game.left:
		if id != "client" {
			t.Fatalf("left client = %q", id)
		}
	default:
		t.Fatal("leave was not routed")
	}
	if !leaveSawClient {
		t.Fatal("room recipient was removed before leave")
	}
	if rm.Get(code) == nil {
		t.Fatal("room was removed before grace elapsed")
	}
	fc.AdvanceTime(time.Second)
	select {
	case <-game.stopped:
	case <-time.After(time.Second):
		t.Fatal("room was not stopped after leave grace")
	}
	if rm.Get(code) != nil {
		t.Fatal("room remained after leave grace")
	}
}

func (g *handlerGame) Disconnect(id string)                                 { g.left <- id }
func (g *handlerGame) AddBot(string)                                        {}
func (g *handlerGame) RemoveBot(string, int)                                {}
func (g *handlerGame) SetIdentity(string, string, *entity.PlayerAvatarData) {}
func (g *handlerGame) HandleAction(string, entity.GameAction)               {}
func (g *handlerGame) HandleManualBotToggle(id string)                      { g.toggle <- id }
func (g *handlerGame) EmitEmoticon(string, entity.Emoticon)                 {}
func (g *handlerGame) HasClient(id string) bool {
	g.mu.RLock()
	defer g.mu.RUnlock()
	return g.current == id
}

func newHandlerTest(t *testing.T, game *handlerGame) (*Handler, *roomusecase.RoomManager, *httptest.Server) {
	t.Helper()
	rm := roomusecase.NewRoomManager(func(string, roomusecase.GameOptions) roomusecase.GameServer { return game }, roomusecase.Options{RNG: func() float64 { return 0 }})
	h := NewHandler(NewHub(), rm)
	server := httptest.NewServer(http.HandlerFunc(h.HandleWS))
	t.Cleanup(server.Close)
	return h, rm, server
}

func TestDecodeAction(t *testing.T) {
	tests := []struct {
		name string
		json string
		want func(entity.GameAction) bool
	}{
		{"roll", `{"type":"ROLL_DICE","target":7}`, func(action entity.GameAction) bool {
			got, ok := action.(entity.RollDiceAction)
			return ok && got.Target != nil && *got.Target == 7
		}},
		{"roll legacy", `{"type":"rollDice","target":7}`, func(action entity.GameAction) bool {
			got, ok := action.(entity.RollDiceAction)
			return ok && got.Target != nil && *got.Target == 7
		}},
		{"property", `{"type":"BUILD_HOUSE","spaceId":7}`, func(action entity.GameAction) bool {
			got, ok := action.(entity.BuildHouseAction)
			return ok && got.SpaceID == 7
		}},
		{"property legacy", `{"type":"buyProperty"}`, func(action entity.GameAction) bool {
			_, ok := action.(entity.BuyPropertyAction)
			return ok
		}},
		{"build legacy", `{"type":"buildHouse","spaceId":7}`, func(action entity.GameAction) bool {
			got, ok := action.(entity.BuildHouseAction)
			return ok && got.SpaceID == 7
		}},
		{"trade", `{"type":"PROPOSE_TRADE","offer":{"fromId":0,"toId":1,"offerCash":25}}`, func(action entity.GameAction) bool {
			got, ok := action.(entity.ProposeTradeAction)
			return ok && got.Offer.FromID == 0 && got.Offer.ToID == 1 && got.Offer.OfferCash == 25
		}},
		{"trade legacy", `{"type":"proposeTrade","offer":{"fromId":0,"toId":1,"offerCash":25}}`, func(action entity.GameAction) bool {
			got, ok := action.(entity.ProposeTradeAction)
			return ok && got.Offer.FromID == 0 && got.Offer.ToID == 1 && got.Offer.OfferCash == 25
		}},
		{"accept trade legacy", `{"type":"acceptTrade","tradeId":7}`, func(action entity.GameAction) bool {
			got, ok := action.(entity.AcceptTradeAction)
			return ok && got.TradeID == 7
		}},
		{"reject trade legacy", `{"type":"rejectTrade","tradeId":7}`, func(action entity.GameAction) bool {
			got, ok := action.(entity.RejectTradeAction)
			return ok && got.TradeID == 7
		}},
		{"bankruptcy", `{"type":"DECLARE_BANKRUPTCY"}`, func(action entity.GameAction) bool {
			_, ok := action.(entity.DeclareBankruptcyAction)
			return ok
		}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			action, err := decodeAction(json.RawMessage(test.json))
			if err != nil || !test.want(action) {
				t.Fatalf("decodeAction() = %#v, %v", action, err)
			}
		})
	}
	if _, err := decodeAction(json.RawMessage(`{"type":"invalid"}`)); err == nil {
		t.Fatal("expected invalid action error")
	}
}

func TestHandlerIgnoresMalformedMessageAndRemainsUsable(t *testing.T) {
	game := &handlerGame{joined: make(chan string, 1), left: make(chan string, 1), toggle: make(chan string, 1)}
	_, _, server := newHandlerTest(t, game)
	url := "ws" + server.URL[len("http"):]
	client, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer client.Close()
	if err := client.WriteMessage(websocket.TextMessage, []byte("not json")); err != nil {
		t.Fatal(err)
	}
	if err := client.WriteJSON(map[string]interface{}{"type": "create", "name": "Alice"}); err != nil {
		t.Fatal(err)
	}
	select {
	case <-game.joined:
	case <-time.After(time.Second):
		t.Fatal("connection did not remain usable after malformed message")
	}
}

func TestHandlerIgnoresEmptyMessageTypeAndRemainsUsable(t *testing.T) {
	game := &handlerGame{joined: make(chan string, 1), left: make(chan string, 1), toggle: make(chan string, 1)}
	_, _, server := newHandlerTest(t, game)
	url := "ws" + server.URL[len("http"):]
	client, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer client.Close()
	if err := client.WriteJSON(map[string]interface{}{}); err != nil {
		t.Fatal(err)
	}
	if err := client.WriteJSON(map[string]interface{}{"type": "create", "name": "Alice"}); err != nil {
		t.Fatal(err)
	}
	select {
	case <-game.joined:
	case <-time.After(time.Second):
		t.Fatal("connection did not remain usable after empty message type")
	}
}

func TestHandlerIgnoresUnknownMessageTypeAndRemainsUsable(t *testing.T) {
	game := &handlerGame{joined: make(chan string, 1), left: make(chan string, 1), toggle: make(chan string, 1)}
	_, _, server := newHandlerTest(t, game)
	url := "ws" + server.URL[len("http"):]
	client, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer client.Close()
	if err := client.WriteJSON(map[string]interface{}{"type": "unknown"}); err != nil {
		t.Fatal(err)
	}
	if err := client.WriteJSON(map[string]interface{}{"type": "create", "name": "Alice"}); err != nil {
		t.Fatal(err)
	}
	select {
	case <-game.joined:
	case <-time.After(time.Second):
		t.Fatal("connection did not remain usable after unknown message type")
	}
}

func TestExplicitLeaveWithoutSessionSendsActorLeft(t *testing.T) {
	game := &handlerGame{joined: make(chan string, 1), left: make(chan string, 1), toggle: make(chan string, 1)}
	_, _, server := newHandlerTest(t, game)
	url := "ws" + server.URL[len("http"):]
	client, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer client.Close()

	if err := client.WriteJSON(map[string]interface{}{"type": "leave"}); err != nil {
		t.Fatal(err)
	}
	_, data, err := client.ReadMessage()
	if err != nil {
		t.Fatal(err)
	}
	var message struct {
		Type string `json:"type"`
	}
	if err := json.Unmarshal(data, &message); err != nil {
		t.Fatal(err)
	}
	if message.Type != entity.ServerMessageTypeLeft {
		t.Fatalf("leave response = %q", message.Type)
	}
}

func TestExplicitLeaveRemovesClientSession(t *testing.T) {
	game := &handlerGame{joined: make(chan string, 1), left: make(chan string, 1), toggle: make(chan string, 1)}
	_, rm, server := newHandlerTest(t, game)
	url := "ws" + server.URL[len("http"):]
	client, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer client.Close()
	if err := client.WriteJSON(map[string]interface{}{"type": "create", "name": "Alice"}); err != nil {
		t.Fatal(err)
	}
	<-game.joined
	if err := client.WriteJSON(map[string]interface{}{"type": "leave"}); err != nil {
		t.Fatal(err)
	}
	select {
	case <-game.left:
	case <-time.After(time.Second):
		t.Fatal("leave was not routed")
	}
	if rm.GameFor("0") != nil {
		t.Fatal("explicit leave retained client session")
	}
}

func TestHandlerReportsInvalidAction(t *testing.T) {
	game := &handlerGame{joined: make(chan string, 1), left: make(chan string, 1), toggle: make(chan string, 1)}
	_, _, server := newHandlerTest(t, game)
	url := "ws" + server.URL[len("http"):]
	client, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer client.Close()
	if err := client.WriteJSON(map[string]interface{}{"type": "create", "name": "Alice"}); err != nil {
		t.Fatal(err)
	}
	select {
	case <-game.joined:
	case <-time.After(time.Second):
		t.Fatal("create was not routed")
	}
	if err := client.WriteJSON(map[string]interface{}{"type": "action", "action": map[string]string{"type": "UNKNOWN"}}); err != nil {
		t.Fatal(err)
	}
	_, data, err := client.ReadMessage()
	if err != nil {
		t.Fatal(err)
	}
	var response struct {
		Type    string `json:"type"`
		Message string `json:"message"`
	}
	if err := json.Unmarshal(data, &response); err != nil {
		t.Fatal(err)
	}
	if response.Type != "error" || response.Message != "unknown game action: UNKNOWN" {
		t.Fatalf("unexpected error response: %s", data)
	}
}

func TestHandlerRoutesCreateToggleAndCleansUp(t *testing.T) {
	game := &handlerGame{joined: make(chan string, 1), left: make(chan string, 1), toggle: make(chan string, 1)}
	_, _, server := newHandlerTest(t, game)
	url := "ws" + server.URL[len("http"):]
	client, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatal(err)
	}
	if err := client.WriteJSON(map[string]interface{}{"type": "create", "name": "Alice"}); err != nil {
		t.Fatal(err)
	}
	select {
	case id := <-game.joined:
		if id != "0" {
			t.Fatalf("client id = %q", id)
		}
	case <-time.After(time.Second):
		t.Fatal("create was not routed")
	}
	if err := client.WriteJSON(map[string]interface{}{"type": "manualBotToggle"}); err != nil {
		t.Fatal(err)
	}
	select {
	case id := <-game.toggle:
		if id != "0" {
			t.Fatalf("toggle id = %q", id)
		}
	case <-time.After(time.Second):
		t.Fatal("manual toggle was not routed")
	}
	_ = client.Close()
	select {
	case id := <-game.left:
		if id != "0" {
			t.Fatalf("cleanup id = %q", id)
		}
	case <-time.After(time.Second):
		t.Fatal("disconnect was not routed")
	}
}

func TestHandlerOldSocketCloseDoesNotDisconnectReplacement(t *testing.T) {
	name := "Alice"
	game := &handlerGame{players: []entity.LobbyPlayer{{ID: 0, Name: &name, Connected: true}}, joined: make(chan string, 2), left: make(chan string, 2), toggle: make(chan string, 1)}
	_, rm, server := newHandlerTest(t, game)
	url := "ws" + server.URL[len("http"):]
	oldClient, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatal(err)
	}
	if err := oldClient.WriteJSON(map[string]interface{}{"type": "create", "name": "Alice"}); err != nil {
		t.Fatal(err)
	}
	<-game.joined
	code := rm.List()[0].Code
	newClient, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatal(err)
	}
	if err := newClient.WriteJSON(map[string]interface{}{"type": "join", "code": code, "name": "Alice"}); err != nil {
		t.Fatal(err)
	}
	<-game.joined
	_ = oldClient.Close()
	select {
	case id := <-game.left:
		if id != "1" {
			t.Fatalf("replacement was disconnected by old socket: %q", id)
		}
	case <-time.After(100 * time.Millisecond):
	}
	_ = newClient.Close()
}

func TestHandlerCreateIsImmediatelyVisibleToHTTPRooms(t *testing.T) {
	name := "Alice"
	game := &handlerGame{players: []entity.LobbyPlayer{{ID: 0, Name: &name, Connected: true}}, joined: make(chan string, 1), left: make(chan string, 1), toggle: make(chan string, 1)}
	_, rm, server := newHandlerTest(t, game)
	url := "ws" + server.URL[len("http"):]
	client, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer client.Close()
	if err := client.WriteJSON(map[string]interface{}{"type": "create", "name": name}); err != nil {
		t.Fatal(err)
	}
	<-game.joined
	recorder := httptest.NewRecorder()
	httpinbound.NewHandler(t.TempDir(), rm, false).HandleRooms(recorder, httptest.NewRequest(http.MethodGet, "/rooms", nil))
	if recorder.Code != http.StatusOK || !strings.Contains(recorder.Body.String(), name) {
		t.Fatalf("room was not immediately listed: %d %s", recorder.Code, recorder.Body.String())
	}
}

func TestHandlerDoesNotRegisterFailedCreate(t *testing.T) {
	game := &handlerGame{joined: make(chan string, 1), left: make(chan string, 1), toggle: make(chan string, 1), failJoin: true}
	_, rm, server := newHandlerTest(t, game)
	url := "ws" + server.URL[len("http"):]
	client, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer client.Close()
	if err := client.WriteJSON(map[string]interface{}{"type": "create", "name": "Alice"}); err != nil {
		t.Fatal(err)
	}
	time.Sleep(20 * time.Millisecond)
	if rm.GameFor("0") != nil {
		t.Fatal("failed create registered client")
	}
	if len(rm.List()) != 0 {
		t.Fatal("failed create left an empty room")
	}
}

func TestHandlerRejectsForeignOrigin(t *testing.T) {
	h := NewHandler(NewHub(), roomusecase.NewRoomManager(nil, roomusecase.Options{}))
	server := httptest.NewServer(http.HandlerFunc(h.HandleWS))
	defer server.Close()
	url := "ws" + server.URL[len("http"):]
	header := http.Header{"Origin": []string{"https://evil.example"}}
	if _, _, err := websocket.DefaultDialer.Dial(url, header); err == nil {
		t.Fatal("expected origin rejection")
	}
}
