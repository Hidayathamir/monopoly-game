package repository

import (
	"sort"
	"sync"
	"testing"
)

func TestInMemorySessionRepositoryTracksMembership(t *testing.T) {
	repo := NewInMemorySessionRepository()
	repo.Set("client-1", "room-a")
	repo.Set("client-2", "room-a")
	repo.Set("client-1", "room-b")

	if room, ok := repo.GetRoomCode("client-1"); !ok || room != "room-b" {
		t.Fatalf("GetRoomCode(client-1) = %q, %v", room, ok)
	}
	if _, ok := repo.GetRoomCode("missing"); ok {
		t.Fatal("GetRoomCode(missing) reported a session")
	}
	clients := repo.GetClients("room-a")
	sort.Strings(clients)
	if len(clients) != 1 || clients[0] != "client-2" {
		t.Fatalf("GetClients(room-a) = %v", clients)
	}

	repo.Delete("client-2")
	if len(repo.GetClients("room-a")) != 0 {
		t.Fatal("Delete() retained client membership")
	}
	repo.DeleteAll("room-b")
	if _, ok := repo.GetRoomCode("client-1"); ok {
		t.Fatal("DeleteAll() retained client session")
	}
}

func TestInMemorySessionRepositoryConcurrentAccess(t *testing.T) {
	repo := NewInMemorySessionRepository()
	var wg sync.WaitGroup
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			clientID := "client-" + string(rune('a'+i%26))
			roomCode := "room-" + string(rune('a'+i%5))
			repo.Set(clientID, roomCode)
			repo.GetRoomCode(clientID)
			repo.GetClients(roomCode)
			if i%3 == 0 {
				repo.Delete(clientID)
			}
		}(i)
	}
	wg.Wait()
	repo.DeleteAll("room-a")
}
