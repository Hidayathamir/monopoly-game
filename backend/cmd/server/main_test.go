package main

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/websocket"
	"monopoly-game-backend/internal/config"
	"monopoly-game-backend/internal/provider"
)

func TestNewMuxConfigWrongMethodMatchesNodeRawResponse(t *testing.T) {
	dir := t.TempDir()
	server := httptest.NewServer(newMux(provider.NewProvider(&config.Config{DistDir: dir})))
	defer server.Close()

	request, err := http.NewRequest(http.MethodPost, server.URL+"/config", nil)
	if err != nil {
		t.Fatal(err)
	}
	request.Header.Set("Accept", "text/html")
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	body, err := io.ReadAll(response.Body)
	if err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != http.StatusNotFound || string(body) != "Not found" || response.Header.Get("Content-Type") != "" || response.Header.Get("Allow") != "" {
		t.Fatalf("config wrong method: status=%d content-type=%q allow=%q body=%q", response.StatusCode, response.Header.Get("Content-Type"), response.Header.Get("Allow"), body)
	}
}

func TestNewMuxReservedRoutesUseStaticFallbackForWrongMethods(t *testing.T) {
	dir := t.TempDir()
	mux := newMux(provider.NewProvider(&config.Config{DistDir: dir}))
	for _, test := range []struct {
		path, method string
	}{
		{"/rooms", http.MethodPost},
		{"/seed", http.MethodGet},
	} {
		recorder := httptest.NewRecorder()
		request := httptest.NewRequest(test.method, test.path, nil)
		request.Header.Set("Accept", "text/html")
		mux.ServeHTTP(recorder, request)
		if recorder.Code != http.StatusNotFound || recorder.Body.String() != "Not found" || recorder.Header().Get("Content-Type") != "" || recorder.Header().Get("Allow") != "" {
			t.Fatalf("%s %s: status=%d content-type=%q allow=%q body=%q", test.method, test.path, recorder.Code, recorder.Header().Get("Content-Type"), recorder.Header().Get("Allow"), recorder.Body.String())
		}
	}
}

func TestNewMuxWebSocketRouteRejectsWrongMethods(t *testing.T) {
	mux := newMux(provider.NewProvider(&config.Config{DistDir: t.TempDir()}))
	recorder := httptest.NewRecorder()
	mux.ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, "/ws", nil))
	if recorder.Code != http.StatusMethodNotAllowed || recorder.Header().Get("Allow") != http.MethodGet {
		t.Fatalf("wrong websocket method: status=%d allow=%q", recorder.Code, recorder.Header().Get("Allow"))
	}
}

func TestNewMuxRegistersWebSocketRoute(t *testing.T) {
	cfg := &config.Config{DistDir: t.TempDir()}
	server := httptest.NewServer(newMux(provider.NewProvider(cfg)))
	defer server.Close()

	connection, response, err := websocket.DefaultDialer.Dial("ws"+server.URL[len("http"):]+"/ws", nil)
	if err != nil {
		if response != nil {
			response.Body.Close()
		}
		t.Fatalf("dial websocket route: %v", err)
	}
	if err := connection.Close(); err != nil {
		t.Fatalf("close websocket connection: %v", err)
	}
}
