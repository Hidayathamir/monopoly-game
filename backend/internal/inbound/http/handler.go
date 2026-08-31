package http

import (
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"monopoly-game-backend/internal/dto"
	"monopoly-game-backend/internal/entity"
	"monopoly-game-backend/internal/usecase/gameusecase"
	"monopoly-game-backend/internal/usecase/roomusecase"
)

var errPathOutside = errors.New("path outside dist directory")

type Handler struct {
	distDir     string
	roomManager *roomusecase.RoomManager
	seedEnabled bool
}

func NewHandler(distDir string, rm *roomusecase.RoomManager, seedEnabled bool) *Handler {
	return &Handler{distDir: distDir, roomManager: rm, seedEnabled: seedEnabled}
}

func (h *Handler) HandleConfig(w http.ResponseWriter, r *http.Request) {
	if !requireMethod(w, r, http.MethodGet) {
		return
	}
	writeJSON(w, http.StatusOK, dto.ConfigResponse{SeedEnabled: h.seedEnabled})
}

func (h *Handler) HandleRooms(w http.ResponseWriter, r *http.Request) {
	if !requireMethod(w, r, http.MethodGet) {
		return
	}
	rooms := h.roomManager.List()
	out := make([]dto.RoomInfoDTO, len(rooms))
	for i, room := range rooms {
		out[i] = dto.RoomInfoDTO{Code: room.Code, HostName: room.HostName, PlayerCount: room.PlayerCount, Phase: room.Phase}
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *Handler) HandleSeed(w http.ResponseWriter, r *http.Request) {
	if !requireMethod(w, r, http.MethodPost) {
		return
	}
	if !h.seedEnabled {
		writeJSON(w, http.StatusForbidden, map[string]string{"message": "seeding disabled"})
		return
	}
	var request *dto.SeedRequest
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16<<20))
	if err := decoder.Decode(&request); err != nil || request == nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "invalid JSON body"})
		return
	}
	var extra any
	if err := decoder.Decode(&extra); err != io.EOF {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "invalid JSON body"})
		return
	}
	if request.Code == "" || len(request.State.Board) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "code and state are required"})
		return
	}
	if result := gameusecase.ValidateStateStructure(request.State); result.Kind != gameusecase.ValidationKindOk {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": result.Message})
		return
	}
	game := h.roomManager.Get(request.Code)
	if game == nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"message": "room not found"})
		return
	}
	seeder, ok := game.(interface{ SeedState(entity.GameState) error })
	if !ok {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "invalid seed state"})
		return
	}
	if err := seeder.SeedState(request.State); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, dto.SeedResponse{OK: true})
}

func (h *Handler) HandleStatic(w http.ResponseWriter, r *http.Request) {
	path, err := h.staticPath(r.URL.Path)
	if err != nil {
		if errors.Is(err, errPathOutside) {
			w.WriteHeader(http.StatusForbidden)
		} else {
			http.Error(w, "Internal server error", http.StatusInternalServerError)
		}
		return
	}
	data, err := os.ReadFile(path)
	if err == nil {
		contentType := mime.TypeByExtension(filepath.Ext(path))
		if contentType == "" {
			contentType = "application/octet-stream"
		}
		w.Header().Set("Content-Type", contentType)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(data)
		return
	}
	if !errors.Is(err, os.ErrNotExist) {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	if strings.Contains(r.Header.Get("Accept"), "text/html") {
		indexPath, indexPathErr := h.staticPath("/index.html")
		if indexPathErr != nil {
			if errors.Is(indexPathErr, errPathOutside) {
				w.WriteHeader(http.StatusForbidden)
			} else {
				http.Error(w, "Internal server error", http.StatusInternalServerError)
			}
			return
		}
		index, indexErr := os.ReadFile(indexPath)
		if indexErr == nil {
			w.Header().Set("Content-Type", "text/html")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write(index)
			return
		}
		if !errors.Is(indexErr, os.ErrNotExist) {
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
	}
	http.Error(w, "Not found", http.StatusNotFound)
}

func (h *Handler) staticPath(requestPath string) (string, error) {
	root, err := filepath.Abs(h.distDir)
	if err != nil {
		return "", err
	}
	name := requestPath
	if name == "" || name == "/" {
		name = "/index.html"
	}
	name, err = filepath.Abs(filepath.Join(root, filepath.FromSlash(name)))
	if err != nil {
		return "", err
	}
	if err := ensureWithin(root, name); err != nil {
		if errors.Is(err, errPathOutside) {
			return "", err
		}
		return name, err
	}
	return name, nil
}

func resolveExistingPath(name string) (string, error) {
	current := name
	missing := ""
	for {
		resolved, err := filepath.EvalSymlinks(current)
		if err == nil {
			if missing == "" {
				return resolved, nil
			}
			return filepath.Join(resolved, filepath.FromSlash(missing)), nil
		}
		if !errors.Is(err, os.ErrNotExist) {
			return "", err
		}
		parent := filepath.Dir(current)
		base := filepath.Base(current)
		if parent == current {
			return "", err
		}
		if missing == "" {
			missing = base
		} else {
			missing = filepath.Join(base, missing)
		}
		current = parent
	}
}

func ensureWithin(root, name string) error {
	resolvedRoot, err := filepath.EvalSymlinks(root)
	if err != nil {
		return err
	}
	resolvedName, err := resolveExistingPath(name)
	if err != nil {
		return err
	}
	rel, err := filepath.Rel(resolvedRoot, resolvedName)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) || filepath.IsAbs(rel) {
		return errPathOutside
	}
	return nil
}

func requireMethod(w http.ResponseWriter, r *http.Request, method string) bool {
	if r.Method == method {
		return true
	}
	w.Header().Set("Allow", method)
	w.WriteHeader(http.StatusMethodNotAllowed)
	return false
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
