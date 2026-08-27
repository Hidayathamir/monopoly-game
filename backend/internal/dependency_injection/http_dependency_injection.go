package dependency_injection

import (
	httpinbound "monopoly-game-backend/internal/inbound/http"
	"monopoly-game-backend/internal/usecase/roomusecase"
)

func NewHTTPHandler(distDir string, roomManager *roomusecase.RoomManager, seedEnabled bool) *httpinbound.Handler {
	return httpinbound.NewHandler(distDir, roomManager, seedEnabled)
}
