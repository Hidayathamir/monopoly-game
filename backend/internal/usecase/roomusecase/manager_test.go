package roomusecase

import (
	"strings"
	"sync"
	"testing"
	"time"

	"monopoly-game-backend/internal/entity"
	"monopoly-game-backend/pkg/clock"
)

type fakeGame struct {
	state   entity.GameState
	players []entity.LobbyPlayer
	host    int
	stopped bool
}

func (g *fakeGame) GetState() entity.GameState       { return g.state }
func (g *fakeGame) GetPlayers() []entity.LobbyPlayer { return g.players }
func (g *fakeGame) GetHostPlayerID() int             { return g.host }
func (g *fakeGame) Stop()                            { g.stopped = true }

type blockingGame struct {
	fakeGame
	entered chan struct{}
	release chan struct{}
}

func (g *blockingGame) GetPlayers() []entity.LobbyPlayer {
	select {
	case <-g.entered:
	default:
		close(g.entered)
	}
	<-g.release
	return g.players
}

func namedPlayer(id int, name string, bot, connected bool) entity.LobbyPlayer {
	return entity.LobbyPlayer{ID: id, Name: &name, IsBot: bot, Connected: connected}
}

func TestRoomManagerCodeAlphabet(t *testing.T) {
	if CodeAlphabet != "ABCDEFGHJKMNPQRSTUVWXYZ23456789" {
		t.Fatalf("unexpected room code alphabet: %q", CodeAlphabet)
	}
	if CodeLength != 5 {
		t.Fatalf("unexpected room code length: %d", CodeLength)
	}
}

func TestRoomManagerCodeAndMappings(t *testing.T) {
	calls := 0
	rm := NewRoomManager(func(string, GameOptions) GameServer {
		return &fakeGame{state: entity.GameState{Phase: entity.GamePhaseSetup}}
	}, Options{RNG: func() float64 {
		value := float64(calls%len(CodeAlphabet)) / float64(len(CodeAlphabet))
		calls++
		return value
	}})

	first, game := rm.Create()
	second, _ := rm.Create()
	if len(first) != CodeLength || len(second) != CodeLength {
		t.Fatalf("invalid room code lengths: %q, %q", first, second)
	}
	for _, code := range first + second {
		if !strings.ContainsRune(CodeAlphabet, code) {
			t.Fatalf("code %q contains character outside alphabet %q", first+second, CodeAlphabet)
		}
	}
	if first == second {
		t.Fatalf("expected unique codes, got %q", first)
	}
	if rm.Get(first) != game {
		t.Fatal("Get did not return created game")
	}
	rm.AddClient(first, "c1")
	if rm.CodeFor("c1") != first || rm.GameFor("c1") != game || len(rm.roomClients[first]) != 1 {
		t.Fatal("client mapping was not recorded")
	}
	if got := rm.RemoveClient("c1"); got != first || rm.CodeFor("c1") != "" || rm.GameFor("c1") != nil || len(rm.roomClients[first]) != 0 {
		t.Fatal("client mapping was not removed")
	}
}

func TestRoomManagerForwardsOptionsAndDefaultsAFKTimeout(t *testing.T) {
	var got GameOptions
	rm := NewRoomManager(func(_ string, options GameOptions) GameServer {
		got = options
		return &fakeGame{}
	}, Options{TradesEnabled: true, SeedEnabled: true, RNG: func() float64 { return 0 }})
	rm.Create()
	if !got.TradesEnabled || !got.SeedEnabled || got.AFKTimeout != AFKTimeout {
		t.Fatalf("unexpected forwarded options: %+v", got)
	}

	got = GameOptions{}
	rm = NewRoomManager(func(_ string, options GameOptions) GameServer {
		got = options
		return &fakeGame{}
	}, Options{AFKTimeout: 11 * time.Second, RNG: func() float64 { return 0 }})
	rm.Create()
	if got.AFKTimeout != 11*time.Second {
		t.Fatalf("explicit AFK timeout was not forwarded: %v", got.AFKTimeout)
	}
}

func TestRoomManagerNilFactoryAndNilGameDoNotCreateRooms(t *testing.T) {
	rm := NewRoomManager(nil, Options{RNG: func() float64 { return 0 }})
	if code, game := rm.Create(); code != "" || game != nil || len(rm.rooms) != 0 {
		t.Fatal("nil factory should not create a room")
	}
	rm = NewRoomManager(func(string, GameOptions) GameServer { return nil }, Options{RNG: func() float64 { return 0 }})
	if code, game := rm.Create(); code != "" || game != nil || len(rm.rooms) != 0 {
		t.Fatal("nil game should not create a room")
	}
}

func TestRoomManagerRollbackCreateIsIdentityChecked(t *testing.T) {
	first := &fakeGame{state: entity.GameState{Phase: entity.GamePhaseSetup}}
	second := &fakeGame{state: entity.GameState{Phase: entity.GamePhaseSetup}}
	games := []*fakeGame{first, second}
	index := 0
	rm := NewRoomManager(func(string, GameOptions) GameServer {
		game := games[index]
		index++
		return game
	}, Options{RNG: func() float64 { return 0.2 }})
	code, game := rm.Create()
	if rm.RollbackCreate(code, second) {
		t.Fatal("rollback removed the wrong game")
	}
	if rm.Get(code) != game {
		t.Fatal("room changed after rejected rollback")
	}
	if !rm.RollbackCreate(code, game) {
		t.Fatal("rollback did not remove created room")
	}
	if rm.Get(code) != nil || !first.stopped {
		t.Fatal("created room was not stopped")
	}
}

func TestRoomManagerAddClientMovesClientAndEvaluatesPreviousRoom(t *testing.T) {
	previousGame := &fakeGame{state: entity.GameState{Phase: entity.GamePhaseSetup}}
	newGame := &fakeGame{state: entity.GameState{Phase: entity.GamePhaseSetup}}
	games := []*fakeGame{previousGame, newGame}
	index := 0
	rm := NewRoomManager(func(string, GameOptions) GameServer {
		game := games[index]
		index++
		return game
	}, Options{RNG: func() float64 { return float64(index) / float64(len(CodeAlphabet)) }})
	previousCode, _ := rm.Create()
	newCode, _ := rm.Create()
	rm.AddClient(previousCode, "c1")
	rm.AddClient(newCode, "c1")

	if rm.CodeFor("c1") != newCode || rm.GameFor("c1") != newGame {
		t.Fatal("client mapping was not moved to the new room")
	}
	if len(rm.roomClients[previousCode]) != 0 || len(rm.roomClients[newCode]) != 1 {
		t.Fatal("room membership sets were not updated")
	}
	if rm.Get(previousCode) != nil || !previousGame.stopped {
		t.Fatal("previous empty lobby was not torn down")
	}
	if rm.Get(newCode) != newGame {
		t.Fatal("new room mapping was lost")
	}
}

func TestRoomManagerCreateAndRegisterMovesClientAndEvaluatesPreviousRoom(t *testing.T) {
	previousGame := &fakeGame{state: entity.GameState{Phase: entity.GamePhaseSetup}}
	newGame := &fakeGame{state: entity.GameState{Phase: entity.GamePhaseSetup}}
	games := []*fakeGame{previousGame, newGame}
	index := 0
	rm := NewRoomManager(func(string, GameOptions) GameServer {
		game := games[index]
		index++
		return game
	}, Options{RNG: func() float64 { return float64(index) / float64(len(CodeAlphabet)) }})
	previousCode, _ := rm.Create()
	rm.AddClient(previousCode, "client-1")
	newCode, created, ok := rm.CreateAndRegister("client-1", func(game GameServer) bool {
		return game == newGame
	})
	if !ok || created != newGame {
		t.Fatal("create and register did not succeed")
	}
	if rm.CodeFor("client-1") != newCode || rm.GameFor("client-1") != newGame {
		t.Fatal("client mapping was not moved to the new room")
	}
	if len(rm.roomClients[previousCode]) != 0 || len(rm.roomClients[newCode]) != 1 {
		t.Fatal("room membership sets were not updated")
	}
	if rm.Get(previousCode) != nil || !previousGame.stopped {
		t.Fatal("previous empty lobby was not torn down")
	}
}

func TestRoomManagerList(t *testing.T) {
	var game *fakeGame
	rm := NewRoomManager(func(string, GameOptions) GameServer {
		game = &fakeGame{state: entity.GameState{Phase: entity.GamePhaseSetup}, host: 1}
		return game
	}, Options{RNG: func() float64 { return 0.1 }})
	code, _ := rm.Create()
	if len(rm.List()) != 0 {
		t.Fatal("empty room should not be listed")
	}
	game.players = []entity.LobbyPlayer{namedPlayer(42, "Alice", false, true), namedPlayer(7, "Bob", false, true)}
	list := rm.List()
	if len(list) != 1 || list[0].Code != code || list[0].HostName == nil || *list[0].HostName != "Bob" || list[0].PlayerCount != 2 || list[0].Phase != entity.GamePhaseSetup {
		t.Fatalf("unexpected room list: %+v", list)
	}
}

func TestRoomManagerTeardownUsesClockAndCanBeCancelled(t *testing.T) {
	fc := clock.NewFakeClock()
	game := &fakeGame{state: entity.GameState{Phase: entity.GamePhaseWaiting}, host: 0, players: []entity.LobbyPlayer{namedPlayer(0, "Alice", false, false)}}
	rm := NewRoomManager(func(string, GameOptions) GameServer { return game }, Options{Clock: fc, RoomEmptyGrace: time.Second, RNG: func() float64 { return 0.2 }})
	code, _ := rm.Create()
	rm.AddClient(code, "c1")
	if rm.RemoveClient("c1") != code || rm.Get(code) == nil {
		t.Fatal("room should remain during grace period")
	}
	fc.AdvanceTime(500 * time.Millisecond)
	rm.AddClient(code, "c2")
	fc.AdvanceTime(2 * time.Second)
	if rm.Get(code) == nil || game.stopped {
		t.Fatal("rejoin should cancel teardown")
	}

	game.players[0].Connected = false
	rm.RemoveClient("c2")
	fc.AdvanceTime(time.Second)
	if rm.Get(code) != nil || !game.stopped {
		t.Fatal("room should be stopped and removed after grace period")
	}
}

func TestRoomManagerRejectsStaleTeardownAfterRejoin(t *testing.T) {
	fc := clock.NewFakeClock()
	entered := make(chan struct{})
	release := make(chan struct{})
	game := &blockingGame{
		fakeGame: fakeGame{
			state:   entity.GameState{Phase: entity.GamePhaseWaiting},
			players: []entity.LobbyPlayer{namedPlayer(0, "Alice", false, false)},
		},
		entered: entered,
		release: release,
	}
	rm := NewRoomManager(func(string, GameOptions) GameServer { return game }, Options{Clock: fc, RoomEmptyGrace: time.Second, RNG: func() float64 { return 0.3 }})
	code, _ := rm.Create()
	rm.AddClient(code, "c1")

	removed := make(chan struct{})
	go func() {
		rm.RemoveClient("c1")
		close(removed)
	}()
	<-entered

	rm.AddClient(code, "c2")
	close(release)
	<-removed
	fc.AdvanceTime(2 * time.Second)

	if rm.Get(code) != game || game.stopped {
		t.Fatal("stale teardown deleted a room after rejoin")
	}
}

func TestRoomManagerConcurrentLifecycle(t *testing.T) {
	fc := clock.NewFakeClock()
	game := &fakeGame{state: entity.GameState{Phase: entity.GamePhaseWaiting}, players: []entity.LobbyPlayer{namedPlayer(0, "Alice", false, false)}}
	rm := NewRoomManager(func(string, GameOptions) GameServer { return game }, Options{Clock: fc, RoomEmptyGrace: time.Millisecond, RNG: func() float64 { return 0.3 }})
	code, _ := rm.Create()
	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			clientID := "client-" + string(rune('a'+i))
			for j := 0; j < 100; j++ {
				rm.AddClient(code, clientID)
				rm.CodeFor(clientID)
				rm.GameFor(clientID)
				rm.List()
				rm.RemoveClient(clientID)
			}
		}(i)
	}
	wg.Wait()
	fc.AdvanceTime(time.Second)
}

func TestRoomManagerDeletesEmptyLobbyImmediately(t *testing.T) {
	game := &fakeGame{state: entity.GameState{Phase: entity.GamePhaseSetup}}
	rm := NewRoomManager(func(string, GameOptions) GameServer { return game }, Options{RNG: func() float64 { return 0.3 }})
	code, _ := rm.Create()
	rm.AddClient(code, "c1")
	rm.RemoveClient("c1")
	if rm.Get(code) != nil || !game.stopped {
		t.Fatal("empty lobby should be removed immediately")
	}
}

func TestRoomManagerRejoinAfterTeardownValidationCancelsDeletion(t *testing.T) {
	fc := clock.NewFakeClock()
	game := &fakeGame{
		state:   entity.GameState{Phase: entity.GamePhaseWaiting},
		players: []entity.LobbyPlayer{namedPlayer(0, "Alice", false, false)},
	}
	validated := make(chan struct{})
	release := make(chan struct{})
	rm := NewRoomManager(func(string, GameOptions) GameServer { return game }, Options{Clock: fc, RoomEmptyGrace: time.Second, RNG: func() float64 { return 0.3 }})
	rm.beforeTeardown = func() {
		close(validated)
		<-release
	}
	code, _ := rm.Create()
	rm.AddClient(code, "c1")

	removed := make(chan struct{})
	go func() {
		rm.RemoveClient("c1")
		close(removed)
	}()
	<-validated

	rm.AddClient(code, "c2")
	close(release)
	<-removed
	fc.AdvanceTime(2 * time.Second)

	if rm.Get(code) != game || game.stopped {
		t.Fatal("room was deleted after rejoin during teardown")
	}
	if rm.CodeFor("c2") != code {
		t.Fatal("rejoin was not recorded")
	}
}

func TestRoomManagerCreateAndRegisterIsAtomic(t *testing.T) {
	game := &fakeGame{state: entity.GameState{Phase: entity.GamePhaseSetup}}
	rm := NewRoomManager(func(string, GameOptions) GameServer { return game }, Options{RNG: func() float64 { return 0.2 }})
	code, created, ok := rm.CreateAndRegister("client-1", func(g GameServer) bool {
		return g == game
	})
	if !ok || created != game || rm.CodeFor("client-1") != code || rm.GameFor("client-1") != game {
		t.Fatal("successful create and registration was not committed atomically")
	}

	failedGame := &fakeGame{state: entity.GameState{Phase: entity.GamePhaseSetup}}
	rm = NewRoomManager(func(string, GameOptions) GameServer { return failedGame }, Options{RNG: func() float64 { return 0.2 }})
	failedCode, _, ok := rm.CreateAndRegister("client-2", func(GameServer) bool { return false })
	if ok {
		t.Fatal("failed atomic create reported success")
	}
	if failedCode == "" || rm.Get(failedCode) != nil || rm.CodeFor("client-2") != "" || !failedGame.stopped {
		t.Fatalf("failed atomic create left room or client state: code=%q game=%v client=%q stopped=%v", failedCode, rm.Get(failedCode), rm.CodeFor("client-2"), failedGame.stopped)
	}
}

func TestRoomManagerCreateAndRegisterJoinCanReadRecipients(t *testing.T) {
	game := &fakeGame{state: entity.GameState{Phase: entity.GamePhaseSetup}}
	rm := NewRoomManager(func(string, GameOptions) GameServer { return game }, Options{RNG: func() float64 { return 0.2 }})

	finished := make(chan struct{})
	var code string
	go func() {
		code, _, _ = rm.CreateAndRegister("client-1", func(GameServer) bool {
			if clients := rm.ClientsFor("placeholder"); len(clients) != 0 {
				t.Errorf("unexpected recipients before registration: %v", clients)
			}
			return true
		})
		close(finished)
	}()

	select {
	case <-finished:
	case <-time.After(time.Second):
		t.Fatal("create and register deadlocked while join read recipients")
	}
	clients := rm.ClientsFor(code)
	if code == "" || len(clients) != 1 || clients[0] != "client-1" {
		t.Fatalf("registration snapshot was not published: code=%q clients=%v", code, clients)
	}
}
