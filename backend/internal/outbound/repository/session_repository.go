package repository

import "sync"

type SessionRepository interface {
	Set(clientID, roomCode string)
	GetRoomCode(clientID string) (string, bool)
	GetClients(roomCode string) []string
	Delete(clientID string)
	DeleteAll(roomCode string)
}

type InMemorySessionRepository struct {
	mu          sync.RWMutex
	clientRooms map[string]string
	roomClients map[string]map[string]struct{}
}

func NewInMemorySessionRepository() *InMemorySessionRepository {
	return &InMemorySessionRepository{
		clientRooms: make(map[string]string),
		roomClients: make(map[string]map[string]struct{}),
	}
}

func (r *InMemorySessionRepository) Set(clientID, roomCode string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.clientRooms == nil {
		r.clientRooms = make(map[string]string)
	}
	if r.roomClients == nil {
		r.roomClients = make(map[string]map[string]struct{})
	}
	if previousRoom, ok := r.clientRooms[clientID]; ok && previousRoom != roomCode {
		delete(r.roomClients[previousRoom], clientID)
		if len(r.roomClients[previousRoom]) == 0 {
			delete(r.roomClients, previousRoom)
		}
	}
	r.clientRooms[clientID] = roomCode
	if r.roomClients[roomCode] == nil {
		r.roomClients[roomCode] = make(map[string]struct{})
	}
	r.roomClients[roomCode][clientID] = struct{}{}
}

func (r *InMemorySessionRepository) GetRoomCode(clientID string) (string, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	roomCode, ok := r.clientRooms[clientID]
	return roomCode, ok
}

func (r *InMemorySessionRepository) GetClients(roomCode string) []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	clients := make([]string, 0, len(r.roomClients[roomCode]))
	for clientID := range r.roomClients[roomCode] {
		clients = append(clients, clientID)
	}
	return clients
}

func (r *InMemorySessionRepository) Delete(clientID string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	roomCode, ok := r.clientRooms[clientID]
	if !ok {
		return
	}
	delete(r.clientRooms, clientID)
	delete(r.roomClients[roomCode], clientID)
	if len(r.roomClients[roomCode]) == 0 {
		delete(r.roomClients, roomCode)
	}
}

func (r *InMemorySessionRepository) DeleteAll(roomCode string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for clientID := range r.roomClients[roomCode] {
		delete(r.clientRooms, clientID)
	}
	delete(r.roomClients, roomCode)
}

var _ SessionRepository = (*InMemorySessionRepository)(nil)
