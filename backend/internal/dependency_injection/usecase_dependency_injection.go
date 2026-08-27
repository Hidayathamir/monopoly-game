package dependency_injection

import (
	"monopoly-game-backend/internal/outbound/repository"
	"monopoly-game-backend/internal/usecase/gameusecase"
	"monopoly-game-backend/internal/usecase/roomusecase"
	"monopoly-game-backend/pkg/clock"
)

func NewRoomManager(roomRepo repository.RoomRepository, sessionRepo repository.SessionRepository, c clock.Clock, events roomusecase.GameEventFactory) *roomusecase.RoomManager {
	return NewRoomManagerWithOptions(roomRepo, sessionRepo, c, events, roomusecase.Options{})
}

func NewRoomManagerWithOptions(roomRepo repository.RoomRepository, sessionRepo repository.SessionRepository, c clock.Clock, events roomusecase.GameEventFactory, options roomusecase.Options) *roomusecase.RoomManager {
	options.Clock = c
	options.RoomRepository = roomRepo
	options.SessionRepository = sessionRepo
	options.Events = events
	return roomusecase.NewRoomManager(func(code string, opts roomusecase.GameOptions) roomusecase.GameServer {
		return gameusecase.NewGameServer(opts.Events, gameusecase.GameServerOptions{
			Code:          code,
			TradesEnabled: opts.TradesEnabled,
			SeedEnabled:   opts.SeedEnabled,
			AFKTimeout:    opts.AFKTimeout,
			Clock:         c,
		})
	}, options)
}
