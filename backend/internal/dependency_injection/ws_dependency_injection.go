package dependency_injection

import (
	wsinbound "monopoly-game-backend/internal/inbound/ws"
	"monopoly-game-backend/internal/usecase/roomusecase"
)

func NewWSHandler(hub *wsinbound.Hub, roomManager *roomusecase.RoomManager) *wsinbound.Handler {
	return wsinbound.NewHandler(hub, roomManager)
}
