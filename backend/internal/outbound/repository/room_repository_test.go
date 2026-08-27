package repository

import (
	"sync"
	"testing"
	"time"

	"monopoly-game-backend/internal/entity"
	"monopoly-game-backend/internal/usecase/roomusecase"
)

type roomGame struct {
	state   entity.GameState
	players []entity.LobbyPlayer
	hostID  int
	entered chan struct{}
	release chan struct{}
}

func (g *roomGame) GetState() entity.GameState { return g.state }
func (g *roomGame) GetPlayers() []entity.LobbyPlayer {
	if g.entered != nil {
		close(g.entered)
		<-g.release
	}
	return g.players
}
func (g *roomGame) GetHostPlayerID() int { return g.hostID }
func (g *roomGame) Stop()                {}

var _ roomusecase.GameServer = (*roomGame)(nil)

func TestInMemoryRoomRepositoryCRUDAndList(t *testing.T) {
	repo := NewInMemoryRoomRepository()
	game := &roomGame{
		state:   entity.GameState{Phase: entity.GamePhaseWaiting},
		players: []entity.LobbyPlayer{{Name: stringPointer("Host")}, {Name: nil}},
		hostID:  0,
	}
	repo.Create("ROOM1", game)

	if got := repo.Get("ROOM1"); got != game {
		t.Fatalf("Get() = %v, want stored game", got)
	}
	infos := repo.List()
	if len(infos) != 1 {
		t.Fatalf("List() length = %d, want 1", len(infos))
	}
	if infos[0].Code != "ROOM1" || infos[0].PlayerCount != 1 || infos[0].Phase != entity.GamePhaseWaiting || infos[0].HostName == nil || *infos[0].HostName != "Host" {
		t.Fatalf("List() = %+v", infos[0])
	}

	repo.Create("EMPTY", &roomGame{state: entity.GameState{Phase: entity.GamePhaseSetup}, players: []entity.LobbyPlayer{{Name: nil}}, hostID: 0})
	if len(repo.List()) != 1 {
		t.Fatal("List() included an empty room")
	}
	repo.Delete("ROOM1")
	if repo.Get("ROOM1") != nil {
		t.Fatal("Get() returned deleted room")
	}
}

func TestInMemoryRoomRepositoryListDoesNotHoldLockDuringGameReads(t *testing.T) {
	repo := NewInMemoryRoomRepository()
	entered := make(chan struct{})
	release := make(chan struct{})
	game := &roomGame{state: entity.GameState{Phase: entity.GamePhaseSetup}, players: []entity.LobbyPlayer{{Name: stringPointer("Host")}}, hostID: 0, entered: entered, release: release}
	repo.Create("ROOM", game)

	finished := make(chan struct{})
	go func() {
		repo.List()
		close(finished)
	}()
	<-entered
	repo.Delete("ROOM")
	close(release)
	select {
	case <-finished:
	case <-time.After(time.Second):
		t.Fatal("List() retained repository lock while reading game")
	}
	if repo.Get("ROOM") != nil {
		t.Fatal("Delete() did not remove room during List() game read")
	}
}

func TestInMemoryRoomRepositoryConcurrentAccess(t *testing.T) {
	repo := NewInMemoryRoomRepository()
	game := &roomGame{state: entity.GameState{Phase: entity.GamePhaseSetup}, players: []entity.LobbyPlayer{{Name: stringPointer("Host")}}, hostID: 0}
	var wg sync.WaitGroup
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			code := "ROOM"
			if i%2 == 0 {
				repo.Create(code, game)
			} else {
				repo.Get(code)
				repo.List()
			}
		}(i)
	}
	wg.Wait()
	if repo.Get("ROOM") != game {
		t.Fatal("concurrent Create() did not retain the stored game")
	}
}

func stringPointer(value string) *string { return &value }
