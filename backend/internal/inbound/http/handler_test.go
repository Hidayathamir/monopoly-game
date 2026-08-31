package http

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"monopoly-game-backend/internal/entity"
	"monopoly-game-backend/internal/usecase/roomusecase"
)

type testGame struct {
	state   entity.GameState
	players []entity.LobbyPlayer
	seedErr error
	seeded  bool
}

func (g *testGame) GetState() entity.GameState       { return g.state }
func (g *testGame) GetPlayers() []entity.LobbyPlayer { return g.players }
func (g *testGame) GetHostPlayerID() int             { return 0 }
func (g *testGame) Stop()                            {}
func (g *testGame) SeedState(entity.GameState) error {
	g.seeded = true
	return g.seedErr
}

func newTestHandler(t *testing.T, seedEnabled bool, game *testGame) *Handler {
	t.Helper()
	rm := roomusecase.NewRoomManager(func(string, roomusecase.GameOptions) roomusecase.GameServer { return game }, roomusecase.Options{})
	rm.Create()
	return NewHandler(t.TempDir(), rm, seedEnabled)
}

func TestHandleConfig(t *testing.T) {
	h := newTestHandler(t, true, &testGame{})
	recorder := httptest.NewRecorder()
	h.HandleConfig(recorder, httptest.NewRequest(http.MethodGet, "/config", nil))
	if recorder.Code != http.StatusOK || recorder.Header().Get("Content-Type") != "application/json" || recorder.Body.String() != "{\"seedEnabled\":true}\n" {
		t.Fatalf("unexpected response: %d %q", recorder.Code, recorder.Body.String())
	}
}

func TestHandleRoomsUsesManagerAndConverter(t *testing.T) {
	name := "Alice"
	game := &testGame{state: entity.GameState{Phase: entity.GamePhaseSetup}, players: []entity.LobbyPlayer{{Name: &name}}}
	h := newTestHandler(t, false, game)
	recorder := httptest.NewRecorder()
	h.HandleRooms(recorder, httptest.NewRequest(http.MethodGet, "/rooms", nil))
	body := recorder.Body.String()
	if recorder.Code != http.StatusOK || !strings.Contains(body, `"hostName":"Alice"`) || !strings.Contains(body, `"playerCount":1`) {
		t.Fatalf("unexpected response: %d %s", recorder.Code, body)
	}
}

func TestHandleSeed(t *testing.T) {
	name := "Alice"
	game := &testGame{state: entity.GameState{Board: make([]entity.Space, 1)}, players: []entity.LobbyPlayer{{Name: &name}}}
	h := newTestHandler(t, false, game)
	recorder := httptest.NewRecorder()
	h.HandleSeed(recorder, httptest.NewRequest(http.MethodPost, "/seed", strings.NewReader(`{"code":"ABC12","state":{"board":[{}]}}`)))
	if recorder.Code != http.StatusForbidden {
		t.Fatalf("disabled seed status: %d", recorder.Code)
	}

	h = newTestHandler(t, true, game)
	code := h.roomManager.List()[0].Code
	body := func(state string) *strings.Reader {
		return strings.NewReader(`{"code":"` + code + `","state":` + state + `}`)
	}
	recorder = httptest.NewRecorder()
	h.HandleSeed(recorder, httptest.NewRequest(http.MethodPost, "/seed", strings.NewReader("null")))
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("null seed status: %d", recorder.Code)
	}

	recorder = httptest.NewRecorder()
	h.HandleSeed(recorder, httptest.NewRequest(http.MethodPost, "/seed", body(`{"board":[{}]}`+" trailing")))
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("trailing JSON status: %d", recorder.Code)
	}

	recorder = httptest.NewRecorder()
	actualStateShape := `{"phase":"waiting","players":[{"id":0,"name":"Alice","money":1500,"position":0,"properties":[],"passedGo":true,"inJail":false,"jailTurns":0,"bankrupt":false,"getOutOfJailFreeCards":0,"isBot":false,"botControlled":false,"afk":false,"color":"#E74C3C","avatar":{"kind":"preset","id":"cat"}}],"turnOrder":[0],"currentPlayer":0,"board":[{}],"chanceDeck":[{"id":0,"type":"chance","effect":{"action":"collect","amount":50}}],"communityDeck":[{"id":0,"type":"community","effect":{"action":"goToJail"}}],"freeParkingPot":0,"dice":null,"doublesCount":0,"lastMoveSteps":null,"eventLog":[],"pendingAction":null,"justBoughtSpaceId":null,"builtThisStop":false,"reconnectGrace":null,"pendingTrades":[],"nextTradeId":0,"tradesEnabled":false}`
	actualStateShape = strings.Replace(actualStateShape, `"board":[{}]`, `"board":[`+strings.TrimSuffix(strings.Repeat(`{},`, 40), `,`)+`]`, 1)
	h.HandleSeed(recorder, httptest.NewRequest(http.MethodPost, "/seed", body(actualStateShape)))
	if recorder.Code != http.StatusOK || !game.seeded {
		t.Fatalf("actual TS seed response: %d %q", recorder.Code, recorder.Body.String())
	}

	recorder = httptest.NewRecorder()
	h.HandleSeed(recorder, httptest.NewRequest(http.MethodPost, "/seed", body(strings.Replace(actualStateShape, `"action":"collect"`, `"action":"unknown"`, 1))))
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("invalid card effect status: %d", recorder.Code)
	}

	game.seedErr = os.ErrInvalid
	recorder = httptest.NewRecorder()
	h.HandleSeed(recorder, httptest.NewRequest(http.MethodPost, "/seed", body(actualStateShape)))
	if recorder.Code != http.StatusBadRequest || recorder.Body.String() != `{"message":"invalid argument"}`+"\n" {
		t.Fatalf("seed error status: %d %q", recorder.Code, recorder.Body.String())
	}

	recorder = httptest.NewRecorder()
	h.HandleSeed(recorder, httptest.NewRequest(http.MethodPost, "/seed", strings.NewReader(`{"code":"ABC12","state":{"board":[]}}`)))
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("seed validation status: %d", recorder.Code)
	}

	recorder = httptest.NewRecorder()
	h.HandleSeed(recorder, httptest.NewRequest(http.MethodPost, "/seed", strings.NewReader(`{"code":"ZZZZZ","state":{"board":[{}]}}`)))
	if recorder.Code != http.StatusBadRequest || recorder.Body.String() != `{"message":"board must have 40 spaces, got 1"}`+"\n" {
		t.Fatalf("structural seed status: %d %q", recorder.Code, recorder.Body.String())
	}

	recorder = httptest.NewRecorder()
	h.HandleSeed(recorder, httptest.NewRequest(http.MethodPost, "/seed", strings.NewReader(`{"code":"ZZZZZ","state":{"board":[]}}`)))
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("missing room seed status: %d", recorder.Code)
	}
}

func TestHandleMethods(t *testing.T) {
	h := newTestHandler(t, false, &testGame{})
	for _, test := range []struct {
		name    string
		handler func(http.ResponseWriter, *http.Request)
		method  string
		allow   string
	}{
		{"config", h.HandleConfig, http.MethodPost, http.MethodGet},
		{"rooms", h.HandleRooms, http.MethodPost, http.MethodGet},
		{"seed", h.HandleSeed, http.MethodGet, http.MethodPost},
	} {
		t.Run(test.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			test.handler(recorder, httptest.NewRequest(test.method, "/", nil))
			if recorder.Code != http.StatusMethodNotAllowed || recorder.Header().Get("Allow") != test.allow {
				t.Fatalf("method response: %d %q", recorder.Code, recorder.Header().Get("Allow"))
			}
		})
	}
}

func TestHandleStaticTraversalMIMEAndSPAFallback(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "index.html"), []byte("<html>hello</html>"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "app.js"), []byte("console.log(1)"), 0o644); err != nil {
		t.Fatal(err)
	}
	h := NewHandler(dir, nil, false)

	recorder := httptest.NewRecorder()
	h.HandleStatic(recorder, httptest.NewRequest(http.MethodGet, "/app.js", nil))
	if recorder.Code != http.StatusOK || recorder.Header().Get("Content-Type") != "text/javascript; charset=utf-8" {
		t.Fatalf("MIME response: %d %q", recorder.Code, recorder.Header().Get("Content-Type"))
	}

	recorder = httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/game/room", nil)
	request.Header.Set("Accept", "text/html")
	h.HandleStatic(recorder, request)
	if recorder.Code != http.StatusOK || recorder.Body.String() != "<html>hello</html>" {
		t.Fatalf("SPA response: %d %q", recorder.Code, recorder.Body.String())
	}

	recorder = httptest.NewRecorder()
	h.HandleStatic(recorder, httptest.NewRequest(http.MethodGet, "/../../etc/passwd", nil))
	if recorder.Code < http.StatusBadRequest {
		t.Fatalf("traversal status: %d", recorder.Code)
	}

	recorder = httptest.NewRecorder()
	h.HandleStatic(recorder, httptest.NewRequest(http.MethodGet, "/", nil))
	if recorder.Code != http.StatusOK || recorder.Body.String() != "<html>hello</html>" {
		t.Fatalf("root response: %d %q", recorder.Code, recorder.Body.String())
	}

	recorder = httptest.NewRecorder()
	h.HandleStatic(recorder, httptest.NewRequest(http.MethodGet, "/missing.css", nil))
	if recorder.Code != http.StatusNotFound {
		t.Fatalf("missing static response: %d", recorder.Code)
	}

	broken := filepath.Join(t.TempDir(), "broken")
	if err := os.WriteFile(broken, []byte("not a directory"), 0o644); err != nil {
		t.Fatal(err)
	}
	h = NewHandler(filepath.Join(broken, "dist"), nil, false)
	recorder = httptest.NewRecorder()
	h.HandleStatic(recorder, httptest.NewRequest(http.MethodGet, "/app.js", nil))
	if recorder.Code != http.StatusInternalServerError {
		t.Fatalf("static filesystem failure: %d", recorder.Code)
	}

	outside := filepath.Join(t.TempDir(), "outside.js")
	if err := os.WriteFile(outside, []byte("outside"), 0o644); err != nil {
		t.Fatal(err)
	}
	link := filepath.Join(dir, "outside.js")
	if err := os.Symlink(outside, link); err != nil {
		t.Fatal(err)
	}
	recorder = httptest.NewRecorder()
	h = NewHandler(dir, nil, false)
	h.HandleStatic(recorder, httptest.NewRequest(http.MethodGet, "/outside.js", nil))
	if recorder.Code != http.StatusForbidden {
		t.Fatalf("symlink traversal status: %d", recorder.Code)
	}

	symlinkDir := t.TempDir()
	symlinkOutside := filepath.Join(t.TempDir(), "outside-index.html")
	if err := os.WriteFile(symlinkOutside, []byte("outside index"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(symlinkOutside, filepath.Join(symlinkDir, "index.html")); err != nil {
		t.Fatal(err)
	}
	h = NewHandler(symlinkDir, nil, false)
	recorder = httptest.NewRecorder()
	request = httptest.NewRequest(http.MethodGet, "/client/route", nil)
	request.Header.Set("Accept", "text/html")
	h.HandleStatic(recorder, request)
	if recorder.Code != http.StatusForbidden {
		t.Fatalf("symlink SPA index status: %d", recorder.Code)
	}
}
