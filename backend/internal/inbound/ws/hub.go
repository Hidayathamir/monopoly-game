package ws

import (
	"sync"

	"github.com/gorilla/websocket"
	"monopoly-game-backend/internal/converter"
	"monopoly-game-backend/internal/entity"
)

type Hub struct {
	mu             sync.Mutex
	clients        map[int]*Conn
	nextID         int
	onWriteFailure func(int)
}

type Conn struct {
	ID      int
	Conn    *websocket.Conn
	writeMu sync.Mutex
}

func NewHub() *Hub {
	return &Hub{clients: make(map[int]*Conn)}
}

func (h *Hub) Add(conn *websocket.Conn) int {
	h.mu.Lock()
	defer h.mu.Unlock()

	id := h.nextID
	h.nextID++
	h.clients[id] = &Conn{ID: id, Conn: conn}
	return id
}

func (h *Hub) Remove(id int) {
	h.mu.Lock()
	defer h.mu.Unlock()

	delete(h.clients, id)
}

func (h *Hub) Send(id int, msg entity.ServerMessage) error {
	h.mu.Lock()
	conn, ok := h.clients[id]
	failure := h.onWriteFailure
	h.mu.Unlock()
	if !ok || conn == nil || conn.Conn == nil {
		return nil
	}
	conn.writeMu.Lock()
	err := conn.Conn.WriteJSON(converter.ToServerMessageDTO(msg))
	conn.writeMu.Unlock()
	if err != nil && failure != nil {
		go failure(id)
	}
	return err
}

func (h *Hub) Broadcast(ids []int, msg entity.ServerMessage) {
	for _, id := range ids {
		_ = h.Send(id, msg)
	}
}

func (h *Hub) SetWriteFailureHandler(handler func(int)) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.onWriteFailure = handler
}

func (h *Hub) GetConn(id int) *Conn {
	h.mu.Lock()
	defer h.mu.Unlock()

	return h.clients[id]
}
