package dependency_injection

import "monopoly-game-backend/internal/outbound/repository"

func NewRoomRepository() repository.RoomRepository {
	return repository.NewInMemoryRoomRepository()
}

func NewSessionRepository() repository.SessionRepository {
	return repository.NewInMemorySessionRepository()
}
