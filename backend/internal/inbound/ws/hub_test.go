package ws

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/gorilla/websocket"
	"monopoly-game-backend/internal/entity"
)

func newTestWebSocket(t *testing.T) (*websocket.Conn, *websocket.Conn) {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(httpHandler(t)))
	t.Cleanup(server.Close)

	url := "ws" + server.URL[len("http"):]
	client, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	t.Cleanup(func() { client.Close() })

	serverConn := <-connections
	t.Cleanup(func() { serverConn.Close() })
	return client, serverConn
}

var connections = make(chan *websocket.Conn, 1)

func httpHandler(t *testing.T) func(http.ResponseWriter, *http.Request) {
	t.Helper()
	return func(w http.ResponseWriter, r *http.Request) {
		upgrader := websocket.Upgrader{CheckOrigin: func(*http.Request) bool { return true }}
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Errorf("upgrade: %v", err)
			return
		}
		connections <- conn
	}
}

func TestHubAddGetRemove(t *testing.T) {
	hub := NewHub()
	client, serverConn := newTestWebSocket(t)

	id := hub.Add(serverConn)
	conn := hub.GetConn(id)
	if conn == nil || conn.ID != id || conn.Conn != serverConn {
		t.Fatalf("unexpected connection: %+v", conn)
	}
	if got := hub.Add(nil); got != id+1 {
		t.Fatalf("expected next id %d, got %d", id+1, got)
	}
	hub.Remove(id)
	if hub.GetConn(id) != nil {
		t.Fatal("expected connection to be removed")
	}
	hub.Remove(id)
	_ = client
}

func TestHubSendWritesServerMessage(t *testing.T) {
	hub := NewHub()
	client, serverConn := newTestWebSocket(t)
	id := hub.Add(serverConn)

	message := entity.ServerMessageError{Type: entity.ServerMessageTypeError, Message: "bad move"}
	hub.Send(id, message)

	_, data, err := client.ReadMessage()
	if err != nil {
		t.Fatalf("read message: %v", err)
	}
	var got struct {
		Type    string `json:"type"`
		Message string `json:"message"`
	}
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatalf("decode message: %v", err)
	}
	if got.Type != "error" || got.Message != "bad move" {
		t.Fatalf("unexpected message: %s", data)
	}
}

func TestHubSendUnknownAndNilConnectionsAreNoOps(t *testing.T) {
	hub := NewHub()
	hub.Send(999, entity.ServerMessageLeft{Type: entity.ServerMessageTypeLeft})
	id := hub.Add(nil)
	hub.Send(id, entity.ServerMessageLeft{Type: entity.ServerMessageTypeLeft})
}

func TestHubConcurrentWritesAreSerialized(t *testing.T) {
	hub := NewHub()
	client, serverConn := newTestWebSocket(t)
	id := hub.Add(serverConn)
	const count = 20
	var wg sync.WaitGroup
	for i := 0; i < count; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_ = hub.Send(id, entity.ServerMessageLeft{Type: entity.ServerMessageTypeLeft})
		}()
	}
	wg.Wait()
	for i := 0; i < count; i++ {
		if _, _, err := client.ReadMessage(); err != nil {
			t.Fatalf("read serialized message %d: %v", i, err)
		}
	}
}

func TestHubConcurrentAccess(t *testing.T) {
	hub := NewHub()
	const count = 100
	var wg sync.WaitGroup
	for i := 0; i < count; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			id := hub.Add(nil)
			hub.GetConn(id)
			hub.Send(id, entity.ServerMessageLeft{Type: entity.ServerMessageTypeLeft})
			hub.Remove(id)
		}()
	}
	wg.Wait()
}
