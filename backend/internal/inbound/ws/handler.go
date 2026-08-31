package ws

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gorilla/websocket"
	"monopoly-game-backend/internal/dto"
	"monopoly-game-backend/internal/entity"
	"monopoly-game-backend/internal/usecase/gameusecase"
	"monopoly-game-backend/internal/usecase/roomusecase"
)

type Handler struct {
	hub         *Hub
	roomManager *roomusecase.RoomManager
	upgrades    *websocket.Upgrader
}

type gameServer interface {
	Join(string, string, gameusecase.JoinOptions) bool
	Start(string)
	Leave(string)
	Disconnect(string)
	AddBot(string)
	RemoveBot(string, int)
	SetIdentity(string, string, *entity.PlayerAvatarData)
	HandleAction(string, entity.GameAction)
	HandleManualBotToggle(string)
	EmitEmoticon(string, entity.Emoticon)
	HasClient(string) bool
}

func NewHandler(hub *Hub, rm *roomusecase.RoomManager) *Handler {
	hub.SetWriteFailureHandler(func(id int) {
		if conn := hub.GetConn(id); conn != nil && conn.Conn != nil {
			_ = conn.Conn.Close()
		}
		game, _ := rm.GameFor(stringID(id)).(gameServer)
		hub.Remove(id)
		if game != nil && game.HasClient(stringID(id)) {
			game.Disconnect(stringID(id))
		}
		rm.RemoveClient(stringID(id))
	})
	return &Handler{
		hub:         hub,
		roomManager: rm,
		upgrades:    &websocket.Upgrader{},
	}
}

func (h *Handler) HandleWS(w http.ResponseWriter, r *http.Request) {
	conn, err := h.upgrades.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	clientID := h.hub.Add(conn)
	defer func() {
		game, _ := h.roomManager.GameFor(stringID(clientID)).(gameServer)
		h.hub.Remove(clientID)
		if game != nil && game.HasClient(stringID(clientID)) {
			game.Disconnect(stringID(clientID))
		}
		h.roomManager.RemoveClient(stringID(clientID))
		_ = conn.Close()
	}()

	id := stringID(clientID)
	for {
		_, data, err := conn.ReadMessage()
		if err != nil {
			return
		}
		var message dto.ClientMessageDTO
		if err := json.Unmarshal(data, &message); err != nil {
			continue
		}
		if message.Type == "" {
			continue
		}
		h.route(id, message)
	}
}

func stringID(id int) string {
	return strconv.Itoa(id)
}

func (h *Handler) sendError(clientID string, message string) {
	if id, err := strconv.Atoi(clientID); err == nil {
		_ = h.hub.Send(id, entity.ServerMessageError{Type: entity.ServerMessageTypeError, Message: message})
	}
}

func (h *Handler) sendLeft(clientID string) {
	if id, err := strconv.Atoi(clientID); err == nil {
		_ = h.hub.Send(id, entity.ServerMessageLeft{Type: entity.ServerMessageTypeLeft})
	}
}

func (h *Handler) route(clientID string, message dto.ClientMessageDTO) {
	switch message.Type {
	case entity.ClientMessageTypeCreate:
		h.roomManager.CreateAndRegister(clientID, func(createdGame roomusecase.GameServer) bool {
			game, ok := createdGame.(gameServer)
			return ok && game.Join(clientID, stringValue(message.Name), gameusecase.JoinOptions{Token: stringValue(message.Token), Color: stringValue(message.Color), Avatar: message.Avatar})
		})
	case entity.ClientMessageTypeJoin:
		game, ok := h.roomManager.Get(stringValue(message.Code)).(gameServer)
		if !ok || !game.Join(clientID, stringValue(message.Name), gameusecase.JoinOptions{Token: stringValue(message.Token), Color: stringValue(message.Color), Avatar: message.Avatar}) {
			return
		}
		h.roomManager.AddClient(stringValue(message.Code), clientID)
	case entity.ClientMessageTypeStart:
		if game, ok := h.roomManager.GameFor(clientID).(gameServer); ok {
			game.Start(clientID)
		}
	case entity.ClientMessageTypeLeave:
		game, ok := h.roomManager.GameFor(clientID).(gameServer)
		if !ok {
			h.sendLeft(clientID)
			return
		}
		code := h.roomManager.CodeFor(clientID)
		roomGame := h.roomManager.GameFor(clientID)
		game.Leave(clientID)
		h.roomManager.RemoveClient(clientID)
		h.roomManager.EvaluateTeardown(code, roomGame)

	case entity.ClientMessageTypeAddBot:
		if game, ok := h.roomManager.GameFor(clientID).(gameServer); ok {
			game.AddBot(clientID)
		}
	case entity.ClientMessageTypeRemoveBot:
		if game, ok := h.roomManager.GameFor(clientID).(gameServer); ok && message.PlayerID != nil {
			game.RemoveBot(clientID, *message.PlayerID)
		}
	case entity.ClientMessageTypeSetIdentity:
		if game, ok := h.roomManager.GameFor(clientID).(gameServer); ok {
			game.SetIdentity(clientID, stringValue(message.Color), message.Avatar)
		}
	case entity.ClientMessageTypeAction:
		if game, ok := h.roomManager.GameFor(clientID).(gameServer); ok {
			action, err := decodeAction(message.Action)
			if err != nil {
				h.sendError(clientID, err.Error())
				return
			}
			game.HandleAction(clientID, action)
		}
	case entity.ClientMessageTypeManualBotToggle:
		if game, ok := h.roomManager.GameFor(clientID).(gameServer); ok {
			game.HandleManualBotToggle(clientID)
		}
	case entity.ClientMessageTypeEmoticon:
		if game, ok := h.roomManager.GameFor(clientID).(gameServer); ok {
			game.EmitEmoticon(clientID, entity.Emoticon(stringValue(message.Emoticon)))
		}
	default:
		return
	}
}

func stringValue(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func decodeAction(data json.RawMessage) (entity.GameAction, error) {
	var header struct {
		Type entity.GameActionType `json:"type"`
	}
	if err := json.Unmarshal(data, &header); err != nil {
		return nil, err
	}
	var action entity.GameAction
	switch header.Type {
	case entity.GameActionTypeRollDice, "rollDice":
		action = &entity.RollDiceAction{}
	case entity.GameActionTypeMoveToken:
		action = &entity.MoveTokenAction{}
	case entity.GameActionTypePassGo:
		action = &entity.PassGoAction{}
	case entity.GameActionTypeResolveSpace:
		action = &entity.ResolveSpaceAction{}
	case entity.GameActionTypeBuyProperty, "buyProperty":
		action = &entity.BuyPropertyAction{}
	case entity.GameActionTypeDeclineBuy:
		action = &entity.DeclineBuyAction{}
	case entity.GameActionTypePayRent:
		action = &entity.PayRentAction{}
	case entity.GameActionTypeBuildHouse, "buildHouse":
		action = &entity.BuildHouseAction{}
	case entity.GameActionTypeSellHouse:
		action = &entity.SellHouseAction{}
	case entity.GameActionTypeMortgage:
		action = &entity.MortgageAction{}
	case entity.GameActionTypeUnmortgage:
		action = &entity.UnmortgageAction{}
	case entity.GameActionTypeSellProperty:
		action = &entity.SellPropertyAction{}
	case entity.GameActionTypeProposeTrade, "proposeTrade":
		action = &entity.ProposeTradeAction{}
	case entity.GameActionTypeAcceptTrade, "acceptTrade":
		action = &entity.AcceptTradeAction{}
	case entity.GameActionTypeRejectTrade, "rejectTrade":
		action = &entity.RejectTradeAction{}
	case entity.GameActionTypeCancelTrade:
		action = &entity.CancelTradeAction{}
	case entity.GameActionTypeDrawCard:
		action = &entity.DrawCardAction{}
	case entity.GameActionTypeResolveCard:
		action = &entity.ResolveCardAction{}
	case entity.GameActionTypeAttemptJailbreak:
		action = &entity.AttemptJailbreakAction{}
	case entity.GameActionTypeEndTurn:
		action = &entity.EndTurnAction{}
	case entity.GameActionTypeDeclareBankruptcy:
		action = &entity.DeclareBankruptcyAction{}
	case entity.GameActionTypeCollectFreeParking:
		action = &entity.CollectFreeParkingAction{}
	case entity.GameActionTypeSkipAction:
		action = &entity.SkipAction{}
	case entity.GameActionTypePayJailFine:
		action = &entity.PayJailFineAction{}
	case entity.GameActionTypeUseGetOutOfJailFree:
		action = &entity.UseGetOutOfJailFreeAction{}
	default:
		return nil, &unknownActionError{header.Type}
	}
	if err := json.Unmarshal(data, action); err != nil {
		return nil, err
	}
	switch value := action.(type) {
	case *entity.RollDiceAction:
		return *value, nil
	case *entity.MoveTokenAction:
		return *value, nil
	case *entity.PassGoAction:
		return *value, nil
	case *entity.ResolveSpaceAction:
		return *value, nil
	case *entity.BuyPropertyAction:
		return *value, nil
	case *entity.DeclineBuyAction:
		return *value, nil
	case *entity.PayRentAction:
		return *value, nil
	case *entity.BuildHouseAction:
		return *value, nil
	case *entity.SellHouseAction:
		return *value, nil
	case *entity.MortgageAction:
		return *value, nil
	case *entity.UnmortgageAction:
		return *value, nil
	case *entity.SellPropertyAction:
		return *value, nil
	case *entity.ProposeTradeAction:
		return *value, nil
	case *entity.AcceptTradeAction:
		return *value, nil
	case *entity.RejectTradeAction:
		return *value, nil
	case *entity.CancelTradeAction:
		return *value, nil
	case *entity.DrawCardAction:
		return *value, nil
	case *entity.ResolveCardAction:
		return *value, nil
	case *entity.AttemptJailbreakAction:
		return *value, nil
	case *entity.EndTurnAction:
		return *value, nil
	case *entity.DeclareBankruptcyAction:
		return *value, nil
	case *entity.CollectFreeParkingAction:
		return *value, nil
	case *entity.SkipAction:
		return *value, nil
	case *entity.PayJailFineAction:
		return *value, nil
	case *entity.UseGetOutOfJailFreeAction:
		return *value, nil
	default:
		return nil, &unknownActionError{header.Type}
	}
}

type unknownActionError struct{ action entity.GameActionType }

func (e *unknownActionError) Error() string { return "unknown game action: " + e.action }
