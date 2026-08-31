package dependency_injection

import (
	"testing"

	"monopoly-game-backend/internal/entity"
	"monopoly-game-backend/internal/outbound/repository"
	"monopoly-game-backend/internal/usecase/roomusecase"
)

type testEvents struct{}

type testGame struct {
	events roomusecase.GameEvents
}

func (testGame) GetState() entity.GameState       { return entity.GameState{} }
func (testGame) GetPlayers() []entity.LobbyPlayer { return nil }
func (testGame) GetHostPlayerID() int             { return 0 }
func (testGame) Stop()                            {}

func (testEvents) BroadcastState(entity.GameState)          {}
func (testEvents) BroadcastLobby([]entity.LobbyPlayer, int) {}
func (testEvents) BroadcastEmoticon(int, entity.Emoticon)   {}
func (testEvents) Send(string, entity.ServerMessage)        {}

func TestNewRoomManagerInjectsRepositories(t *testing.T) {
	roomRepo := NewRoomRepository()
	sessionRepo := NewSessionRepository()
	manager := NewRoomManager(roomRepo, sessionRepo, nil, nil)

	code, game := manager.Create()
	if game == nil || roomRepo.Get(code) != game {
		t.Fatal("room repository was not injected")
	}

	manager.AddClient(code, "client")
	if room, ok := sessionRepo.GetRoomCode("client"); !ok || room != code {
		t.Fatal("session repository was not injected")
	}
}

func TestRoomManagerUsesPublicEventsOption(t *testing.T) {
	var received roomusecase.GameEvents
	manager := roomusecase.NewRoomManager(func(string, roomusecase.GameOptions) roomusecase.GameServer {
		return &testGame{events: received}
	}, roomusecase.Options{
		Events: func(string) roomusecase.GameEvents {
			received = testEvents{}
			return received
		},
	})

	_, game := manager.Create()
	if game.(*testGame).events == nil {
		t.Fatal("room manager ignored public events option")
	}
}

func TestNewRoomManagerCreatesPerRoomEvents(t *testing.T) {
	roomRepo := repository.NewInMemoryRoomRepository()
	sessionRepo := repository.NewInMemorySessionRepository()
	codes := make([]string, 0, 2)
	manager := NewRoomManager(roomRepo, sessionRepo, nil, func(code string) roomusecase.GameEvents {
		codes = append(codes, code)
		return testEvents{}
	})

	first, _ := manager.Create()
	second, _ := manager.Create()
	if first == second || len(codes) != 2 || codes[0] != first || codes[1] != second {
		t.Fatalf("unexpected event bindings: codes=%v rooms=%q,%q", codes, first, second)
	}
}
