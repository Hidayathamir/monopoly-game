package main

import (
	"errors"
	"fmt"
	"log"
	"net/http"

	"monopoly-game-backend/internal/config"
	"monopoly-game-backend/internal/provider"
)

func newMux(p *provider.Provider) *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("/config", methodHandlerStatic(http.MethodGet, p.HTTPHandler.HandleConfig, p.HTTPHandler.HandleStatic))
	mux.HandleFunc("/rooms", methodHandlerStatic(http.MethodGet, p.HTTPHandler.HandleRooms, p.HTTPHandler.HandleStatic))
	mux.HandleFunc("/seed", methodHandlerStatic(http.MethodPost, p.HTTPHandler.HandleSeed, p.HTTPHandler.HandleStatic))
	mux.HandleFunc("/ws", methodHandler(http.MethodGet, p.WSHandler.HandleWS))
	mux.HandleFunc("/", p.HTTPHandler.HandleStatic)
	return mux
}

func methodHandler(method string, handler http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != method {
			w.Header().Set("Allow", method)
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		handler(w, r)
	}
}

func methodHandlerStatic(method string, handler, _ http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != method {
			w.Header()["Content-Type"] = []string{}
			w.WriteHeader(http.StatusNotFound)
			_, _ = w.Write([]byte("Not found"))
			return
		}
		handler(w, r)
	}
}

func main() {
	cfg := config.Load()
	p := provider.NewProvider(cfg)

	mux := newMux(p)

	server := &http.Server{
		Addr:    fmt.Sprintf(":%d", cfg.Port),
		Handler: mux,
	}
	log.Printf("Monopoli server aktif di http://0.0.0.0:%d", cfg.Port)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}
