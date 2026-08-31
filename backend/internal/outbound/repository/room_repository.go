package repository

import (
	"sync"

	"monopoly-game-backend/internal/entity"
	"monopoly-game-backend/internal/usecase/roomusecase"
)

type RoomRepository interface {
	Create(code string, game roomusecase.GameServer)
	Get(code string) roomusecase.GameServer
	Delete(code string)
	List() []entity.RoomInfo
}

type InMemoryRoomRepository struct {
	mu    sync.RWMutex
	rooms map[string]roomusecase.GameServer
}

func NewInMemoryRoomRepository() *InMemoryRoomRepository {
	return &InMemoryRoomRepository{rooms: make(map[string]roomusecase.GameServer)}
}

func (r *InMemoryRoomRepository) Create(code string, game roomusecase.GameServer) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.rooms == nil {
		r.rooms = make(map[string]roomusecase.GameServer)
	}
	r.rooms[code] = game
}

func (r *InMemoryRoomRepository) Get(code string) roomusecase.GameServer {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.rooms[code]
}

func (r *InMemoryRoomRepository) Delete(code string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.rooms, code)
}

func (r *InMemoryRoomRepository) List() []entity.RoomInfo {
	r.mu.RLock()
	games := make(map[string]roomusecase.GameServer, len(r.rooms))
	for code, game := range r.rooms {
		games[code] = game
	}
	r.mu.RUnlock()

	infos := make([]entity.RoomInfo, 0, len(games))
	for code, game := range games {
		if game == nil {
			continue
		}
		players := game.GetPlayers()
		playerCount := 0
		for _, player := range players {
			if player.Name != nil {
				playerCount++
			}
		}
		if playerCount == 0 {
			continue
		}
		hostName := (*string)(nil)
		hostID := game.GetHostPlayerID()
		if hostID >= 0 && hostID < len(players) && players[hostID].Name != nil {
			name := *players[hostID].Name
			hostName = &name
		}
		state := game.GetState()
		infos = append(infos, entity.RoomInfo{Code: code, HostName: hostName, PlayerCount: playerCount, Phase: state.Phase})
	}
	return infos
}

var _ RoomRepository = (*InMemoryRoomRepository)(nil)
