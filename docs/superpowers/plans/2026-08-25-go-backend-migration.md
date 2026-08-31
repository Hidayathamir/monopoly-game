# Go Backend Migration — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-08-25-go-backend-migration-design.md`
**Source files:** `server/`, `src/logic/`, `src/types/`, `src/data/`
**Target:** `backend/` (Go, following Hidayathamir/golang-clean-architecture)

## File Map

| TS Source | Go Target | Package |
|---|---|---|
| `server/main.ts` | `cmd/server/main.go` | `main` |
| `server/http.ts` | `internal/inbound/http/handler.go` | `http` |
| `server/gameServer.ts` | `internal/usecase/gameusecase/server.go` | `gameusecase` |
| `server/roomManager.ts` | `internal/usecase/roomusecase/manager.go` | `roomusecase` |
| `src/logic/gameReducer.ts` | `internal/usecase/gameusecase/reducer.go` | `gameusecase` |
| `src/logic/build.ts` | `internal/usecase/gameusecase/build.go` | `gameusecase` |
| `src/logic/rent.ts` | `internal/usecase/gameusecase/rent.go` | `gameusecase` |
| `src/logic/cards.ts` | `internal/usecase/gameusecase/cards.go` | `gameusecase` |
| `src/logic/seed.ts` | `internal/usecase/gameusecase/seed.go` | `gameusecase` |
| `src/logic/controlledDice.ts` | `internal/usecase/gameusecase/controlled_dice.go` | `gameusecase` |
| `src/logic/logEntries.ts` | `internal/usecase/gameusecase/log_entries.go` | `gameusecase` |
| `src/logic/bot.ts` | `internal/usecase/botusecase/ai.go` | `botusecase` |
| `src/logic/emotions.ts` | `internal/usecase/botusecase/emotions.go` | `botusecase` |
| `src/types/game.ts` | `internal/entity/game_entity.go` | `entity` |
| `src/types/net.ts` | `internal/entity/net_entity.go` | `entity` |
| `src/types/emotion.ts` | `internal/entity/emotion_entity.go` | `entity` |
| `src/data/board.ts` + `board-data.json` | `internal/data/board.go` + `data/board-data.json` | `data` |
| `src/data/cards.ts` + `cards-data.json` | `internal/data/cards.go` + `data/cards-data.json` | `data` |
| `src/data/players.ts` | `internal/data/players.go` | `data` |
| `src/data/avatars.ts` | `internal/data/avatars.go` | `data` |
| `src/data/bots.ts` | `internal/data/bots.go` | `data` |
| `src/data/game-config.json` | `internal/data/config.go` (constants) | `data` |
| `src/utils/env.ts` | `pkg/env/env.go` | `env` |
| (new) | `pkg/clock/clock.go` | `clock` |
| (new) | `internal/config/config.go` | `config` |
| (new) | `internal/dto/http.go`, `ws.go` | `dto` |
| (new) | `internal/converter/converter.go` | `converter` |
| (new) | `internal/outbound/repository/room_repository.go` | `repository` |
| (new) | `internal/outbound/repository/session_repository.go` | `repository` |
| (new) | `internal/provider/provider.go` | `provider` |
| (new) | `internal/dependency_injection/*.go` | `dependency_injection` |

---

## Phase 1: Foundation

### Task 1: Initialize Go module + dependencies

**Files:** `backend/go.mod`, `backend/go.sum`

```bash
cd backend
go mod init monopoly-game-backend
go get github.com/gorilla/websocket@v1.5.3
go get github.com/google/uuid@v1.6.0
```

**Verify:** `go build ./...` compiles (even with empty packages).

---

### Task 2: Entity types — game

**Files:** `internal/entity/game_entity.go`

Port all types from `src/types/game.ts`:
- `SpaceType` — `as const` object → `const SpaceType = struct { ... }` + string type
- `CardType`, `AvatarKind`, `CardActionType`, `TaxType`, `GamePhase`, `PendingActionType`, `LogEventKey`, `LogParamKey`, `BotControlReason`, `GameActionType` — same pattern
- `Space` struct — all fields with `json:"camelCase"` tags
- `Player` struct
- `PendingAction` — interface + concrete types per `PendingActionType`
- `Card` struct
- `LogEntry` struct
- `GameState` struct — all fields
- `PendingTrade`, `TradeOffer`, `TradeSide` structs
- `TradeDecisionType` — same pattern as other const objects
- `PlayerAvatar` — interface with `PresetAvatar` and `CustomAvatar` structs

**Key rules:**
- Every `as const` object → Go struct with exported string constants + a string type alias
- Discriminated unions → interface + concrete types
- `json:"fieldName"` tags on every field
- `omitempty` where TS has optional fields

**Test:** `internal/entity/game_entity_test.go` — verify JSON round-trip for key types (GameState, Player, Space).

---

### Task 3: Entity types — net

**Files:** `internal/entity/net_entity.go`

Port from `src/types/net.ts`:
- `LobbyPlayer` struct
- `RoomInfo` struct
- `ConnectionStatus` — const object pattern
- `ClientMessageType` — const object pattern (all 10 values)
- `ServerMessageType` — const object pattern (all 6 values)
- `HttpPath` — const object pattern
- `ClientMessage` — interface + 10 concrete types (Create, Join, Start, Leave, AddBot, RemoveBot, Action, SetIdentity, ManualBotToggle, Emoticon)
- `ServerMessage` — interface + 6 concrete types (Welcome, Lobby, State, Left, Error, Emoticon)

**Key:** `ClientMessage.Action` contains a `GameAction` field — the `GameAction` interface from `game_entity.go`.

**Test:** `internal/entity/net_entity_test.go` — verify JSON round-trip for ClientMessage and ServerMessage types.

---

### Task 4: Entity types — emotion

**Files:** `internal/entity/emotion_entity.go`

Port from `src/types/emotion.ts`:
- `Emoticon` — const object pattern
- `EMOTICON_LIST`, `EMOTICON_GLYPHS`, `EMOTICON_COOLDOWN_MS`, `EMOTICON_LIFETIME_MS`, `EXPENSIVE_RENT_THRESHOLD`
- `IsEmoticon(value) bool`
- `ActiveEmotion` struct

**Test:** `internal/entity/emotion_entity_test.go`

---

### Task 5: Config

**Files:** `internal/config/config.go`

```go
type Config struct {
    Port              int
    DistDir           string
    TradesEnabled     bool
    SeedEnabled       bool
    AFKTimeoutMs      int
    RoomEmptyGraceMs  int
}

func Load() *Config { /* reads env vars */ }
```

**Test:** `internal/config/config_test.go` — verify defaults + env override.

---

### Task 6: PKG — clock

**Files:** `pkg/clock/clock.go`, `pkg/clock/real.go`, `pkg/clock/fake.go`

```go
// clock.go
type Clock interface {
    Now() time.Time
    AfterFunc(d time.Duration, f func()) Timer
}

type Timer interface {
    Stop() bool
    Reset(d time.Duration) bool
}

// real.go
type RealClock struct{}
func (RealClock) Now() time.Time { return time.Now() }
func (RealClock) AfterFunc(d time.Duration, f func()) Timer { return realTimer{time.AfterFunc(d, f)} }

// fake.go
type FakeClock struct {
    mu      sync.Mutex
    now     time.Time
    timers  []*fakeTimer
}

func NewFakeClock() *FakeClock
func (fc *FakeClock) AdvanceTime(d time.Duration)  // fires all due timers
func (fc *FakeClock) Now() time.Time
func (fc *FakeClock) AfterFunc(d time.Duration, f func()) Timer
```

**Test:** `pkg/clock/fake_test.go` — verify AdvanceTime fires timers in order, Stop/Reset work.

---

### Task 7: PKG — env helpers

**Files:** `pkg/env/env.go`

```go
func ParseEnvFlag(value string) bool { return value == "true" }
func GetEnvInt(key string, fallback int) int
func GetEnvString(key, fallback string) string
```

**Test:** `pkg/env/env_test.go`

---

### Task 8: Data — board

**Files:** `internal/data/board.go`, `data/board-data.json`

- Copy `src/data/board-data.json` to `backend/data/board-data.json`
- `go:embed` the JSON file
- Port `createInitialBoard()` → `CreateInitialBoard() []entity.Space`
- Port all constants: `GO_SALARY`, `JAIL_FINE`, `JAIL_SPACE`, `STARTING_MONEY`, `MAX_JAIL_TURNS`, `INCOME_TAX_RATE`, `SELL_RATE`, `MORTGAGED_SELL_EXTRA`, `HOUSE_SELL_RATE`, `BOARD_SIZE`, `MAX_HOUSES`
- Port `getHouseCost()`, `getTotalHouseInvestment()`

**Test:** `internal/data/board_test.go` — verify board has 40 spaces, correct types, constants match TS values.

---

### Task 9: Data — cards

**Files:** `internal/data/cards.go`, `data/cards-data.json`

- Copy `src/data/cards-data.json` to `backend/data/cards-data.json`
- `go:embed` the JSON file
- Port `CHANCE_CARDS`, `COMMUNITY_CARDS` initialization

**Test:** `internal/data/cards_test.go` — verify 16 chance cards, 16 community cards.

---

### Task 10: Data — players, avatars, bots

**Files:** `internal/data/players.go`, `internal/data/avatars.go`, `internal/data/bots.go`

Port from TS:
- `PLAYER_COLORS`, `MAX_PLAYERS`, `PLAYER_OFFSETS`
- `IsValidColor()`, `NormalizeColor()`
- `PRESET_AVATARS`, `PRESET_EMOJI`, `DEFAULT_AVATAR`, `CUSTOM_AVATAR_MAX_DATA_URL_LENGTH`, `CUSTOM_AVATAR_MAX_DIMENSION`
- `IsPresetAvatar()`, `IsCustomAvatar()`, `IsValidAvatar()`, `IsSameAvatar()`
- `BOT_NAMES`

**Test:** `internal/data/players_test.go`, `avatars_test.go`

---

## Phase 2: Game Logic Usecases (Pure Functions)

### Task 11: gameusecase — log_entries

**Files:** `internal/usecase/gameusecase/log_entries.go`

Port from `src/logic/logEntries.ts`:
- `ActorEntry(key, player, extra) LogEntry`
- `TurnEntry(players, nextId) LogEntry`

**Test:** `internal/usecase/gameusecase/log_entries_test.go`

---

### Task 12: gameusecase — rent

**Files:** `internal/usecase/gameusecase/rent.go`

Port from `src/logic/rent.ts`:
- `CalculatePropertyRent(space, dice) int`
- `calculateRailroadRent(space) int`
- `calculateUtilityRent(space, dice) int`
- `GetRailroadCount(space) int`, `SetRailroadCount(space, count) Space`
- `CalculateRailroadRentFromBoard(ownerId, board, spaceId) int`
- `CalculateUtilityRentFromBoard(ownerId, board, spaceId, dice) int`
- `IsMonopoly(ownerId, board) bool`

**Test:** `internal/usecase/gameusecase/rent_test.go` — port all cases from `src/logic/__tests__/rent.test.ts`

---

### Task 13: gameusecase — build

**Files:** `internal/usecase/gameusecase/build.go`

Port from `src/logic/build.ts`:
- `CanBuildOnCurrentSpace(state) bool`

**Test:** `internal/usecase/gameusecase/build_test.go` — port from `src/logic/__tests__/build.test.ts`

---

### Task 14: gameusecase — cards

**Files:** `internal/usecase/gameusecase/cards.go`

Port from `src/logic/cards.ts`:
- `CardResolution` struct
- `ResolveCardEffect(state, card) CardResolution`
- All helper functions (`updatePlayerMoney`, `addToFreeParking`, `sendPlayerToJail`, etc.)

**Test:** `internal/usecase/gameusecase/cards_test.go` — port from `src/logic/__tests__/cards.test.ts`

---

### Task 15: gameusecase — controlled_dice

**Files:** `internal/usecase/gameusecase/controlled_dice.go`

Port from `src/logic/controlledDice.ts`:
- `ControlledDiceResult` struct
- `DICE_FACES`, `DieFace`
- `RollControlledDice(target, rng) ControlledDiceResult`

**Test:** `internal/usecase/gameusecase/controlled_dice_test.go` — port from `src/logic/__tests__/controlledDice.test.ts`

---

### Task 16: gameusecase — seed

**Files:** `internal/usecase/gameusecase/seed.go`

Port from `src/logic/seed.ts`:
- `SeedBoardOverride`, `SeedPlayerSpec`, `SeedSpec` structs
- `CreateSeededState(spec) entity.GameState`
- `ValidateStateStructure(state) error`
- `ValidateStateForRoom(state, roomCode) error`
- `ValidationKind` constants

**Test:** `internal/usecase/gameusecase/seed_test.go` — port from `src/logic/__tests__/seed.test.ts`

---

### Task 17: gameusecase — reducer

**Files:** `internal/usecase/gameusecase/reducer.go`

Port from `src/logic/gameReducer.ts` (the largest file, ~1000 lines):
- `CreateInitialState(opts) entity.GameState`
- `GameReducer(state, action) entity.GameState`
- Every action case in the switch statement

**Strategy:** Port case-by-case, testing each group:
1. RollDice, doubles handling
2. MovePlayer, space landing
3. BuyProperty, DeclineBuy
4. PayRent, DeclineBuy (bankruptcy path)
5. DrawCard, ResolveCard
6. BuildHouse, BuildHotel, SellHouse
7. Mortgage, Unmortgage
8. EndTurn
9. LeaveJail (pay fine, use card, roll doubles)
10. ProposeTrade, AcceptTrade, DeclineTrade
11. Bankruptcy (declare, accept help)

**Test:** `internal/usecase/gameusecase/reducer_test.go` — port from `src/logic/__tests__/gameReducer.test.ts`

---

## Phase 3: Bot + Room Usecases

### Task 18: botusecase — ai

**Files:** `internal/usecase/botusecase/ai.go`

Port from `src/logic/bot.ts`:
- `BUILD_CASH_RESERVE` constant
- `DecideBotAction(state) entity.GameAction`
- `ShouldAcceptTrade(state, offer) bool`
- All helper functions (`isLandScarce`, `liquidationAction`, etc.)

**Test:** `internal/usecase/botusecase/ai_test.go` — port from `src/logic/__tests__/bot.test.ts`

---

### Task 19: botusecase — emotions

**Files:** `internal/usecase/botusecase/emotions.go`

Port from `src/logic/emotions.ts`:
- `BotEmotion` struct
- `DetectBotEmotions(prev, next) []BotEmotion`

**Test:** `internal/usecase/botusecase/emotions_test.go` — port from `src/logic/__tests__/emotions.test.ts`

---

### Task 20: roomusecase — manager

**Files:** `internal/usecase/roomusecase/manager.go`

Port from `server/roomManager.ts`:
- `RoomManager` struct (rooms, clientRoom, roomClients, teardownTimers maps)
- `Create() (code, game)`
- `Get(code) *GameServer`
- `List() []RoomInfo`
- `AddClient(code, clientId)`
- `RemoveClient(clientId)`
- `GameFor(clientId) *GameServer`
- `CodeFor(clientId) string`
- Code generation: 5-char alphanumeric, same alphabet `ABCDEFGHJKMNPQRSTUVWXYZ23456789`
- Teardown timer via Clock

**Test:** `internal/usecase/roomusecase/manager_test.go` — port from `server/__tests__/roomManager.test.ts`

---

## Phase 4: GameServer (Stateful)

### Task 21: gameusecase — server

**Files:** `internal/usecase/gameusecase/server.go`

Port from `server/gameServer.ts` (~600 lines):
- `ClientId` type
- `GameServerEvents` interface
- `Slot` struct
- `GameServer` struct (state, slots, mutex, clock, events, config)
- Constants: `BOT_STEP_MS`, `BOT_GRACE_MS`, `AFK_TIMEOUT_MS`, `AUTO_END_TURN_MS`
- Methods: `Join`, `Leave`, `Start`, `Roll`, `HandleAction`, `AddBot`, `RemoveBot`, `SetIdentity`, `EmitEmoticon`, `Disconnect`, `SeedState`, `Stop`
- Timer methods: `driveBot`, `scheduleAfkTimer`, `scheduleAutoSteps`, `startRoll`
- Helper methods: `getPlayers`, `getLobbyPlayers`, `isNameTaken`, `findSlot`, `disconnectGrace`

**Key difference from TS:** All timer callbacks use `clock.AfterFunc` and acquire `sync.Mutex`.

**Test:** `internal/usecase/gameusecase/server_test.go` — port from `server/__tests__/gameServer.test.ts` + `server/__tests__/emoticon.test.ts`

---

## Phase 5: Infrastructure

### Task 22: outbound — repositories

**Files:** `internal/outbound/repository/room_repository.go`, `internal/outbound/repository/session_repository.go`

```go
// room_repository.go
type RoomRepository interface {
    Create(code string, game *gameusecase.GameServer)
    Get(code string) *gameusecase.GameServer
    Delete(code string)
    List() []entity.RoomInfo
}

type InMemoryRoomRepository struct { /* map impl */ }

// session_repository.go
type SessionRepository interface {
    Set(clientId, roomCode string)
    GetRoomCode(clientId string) (string, bool)
    GetClients(roomCode string) []string
    Delete(clientId string)
    DeleteAll(roomCode string)
}

type InMemorySessionRepository struct { /* map impl */ }
```

**Test:** `internal/outbound/repository/*_test.go`

---

### Task 23: DTOs

**Files:** `internal/dto/http.go`, `internal/dto/ws.go`

```go
// http.go
type ConfigResponse struct { SeedEnabled bool `json:"seedEnabled"` }
type RoomInfoDTO struct { ... }
type SeedRequest struct { ... }
type SeedResponse struct { OK bool `json:"ok"` }

// ws.go
type ClientMessageDTO struct { Type string `json:"type"` /* + all fields as optional */ }
type ServerMessageDTO struct { Type string `json:"type"` /* + all fields as optional */ }
```

These DTOs are used for HTTP request/response parsing and WS message routing.

---

### Task 24: Converter

**Files:** `internal/converter/converter.go`

```go
func ToRoomInfoDTO(code string, game *gameusecase.GameServer) dto.RoomInfoDTO
func ToLobbyPlayerDTO(p entity.Player) dto.LobbyPlayerDTO
func ToServerMessageDTO(msg entity.ServerMessage) dto.ServerMessageDTO
```

---

## Phase 6: Delivery Layer

### Task 25: WS Hub

**Files:** `internal/inbound/ws/hub.go`

```go
type Hub struct {
    mu      sync.Mutex
    clients map[int]*Conn
    nextID  int
}

type Conn struct {
    ID   int
    Conn *websocket.Conn
}

func NewHub() *Hub
func (h *Hub) Add(conn *websocket.Conn) int
func (h *Hub) Remove(id int)
func (h *Hub) Send(id int, msg entity.ServerMessage)
func (h *Hub) GetConn(id int) *Conn
```

---

### Task 26: WS Handler

**Files:** `internal/inbound/ws/handler.go`

```go
type Handler struct {
    hub          *Hub
    roomManager  *roomusecase.Manager
    upgrades     *websocket.Upgrader
}

func NewHandler(hub *Hub, rm *roomusecase.Manager) *Handler
func (h *Handler) HandleWS(w http.ResponseWriter, r *http.Request)
```

Message routing:
- Parse raw JSON → `ClientMessageDTO`
- Route by `type` field to `RoomManager` methods
- On WS close → cleanup + disconnect

---

### Task 27: HTTP Handler

**Files:** `internal/inbound/http/handler.go`

```go
type Handler struct {
    distDir     string
    roomManager *roomusecase.Manager
    seedEnabled bool
}

func NewHandler(distDir string, rm *roomusecase.Manager, seedEnabled bool) *Handler
func (h *Handler) HandleConfig(w http.ResponseWriter, r *http.Request)
func (h *Handler) HandleRooms(w http.ResponseWriter, r *http.Request)
func (h *Handler) HandleSeed(w http.ResponseWriter, r *http.Request)
func (h *Handler) HandleStatic(w http.ResponseWriter, r *http.Request)
```

Static file serving:
- Resolve path relative to `distDir`
- Path traversal protection
- MIME type detection
- SPA fallback: if file not found and Accept contains text/html → serve `index.html`

**Test:** `internal/inbound/http/handler_test.go` — port from `server/__tests__/http.test.ts`

---

## Phase 7: Wiring + Entry

### Task 28: Provider

**Files:** `internal/provider/provider.go`

```go
type Provider struct {
    Config       *config.Config
    Clock        clock.Clock
    RoomManager  *roomusecase.Manager
    WSHub        *ws.Hub
    WSHandler    *ws.Handler
    HTTPHandler  *http.Handler
}

func NewProvider(cfg *config.Config) *Provider
```

---

### Task 29: Dependency Injection

**Files:**
- `internal/dependency_injection/repository_dependency_injection.go`
- `internal/dependency_injection/usecase_dependency_injection.go`
- `internal/dependency_injection/http_dependency_injection.go`
- `internal/dependency_injection/ws_dependency_injection.go`

Each file wires its layer's dependencies:

```go
// repository_dependency_injection.go
func NewRoomRepository() repository.RoomRepository { return repository.NewInMemoryRoomRepository() }
func NewSessionRepository() repository.SessionRepository { return repository.NewInMemorySessionRepository() }

// usecase_dependency_injection.go
func NewRoomManager(roomRepo, sessionRepo, clock, events) *roomusecase.Manager { ... }

// http_dependency_injection.go
func NewHTTPHandler(distDir, roomManager, seedEnabled) *http.Handler { ... }

// ws_dependency_injection.go
func NewWSHandler(hub, roomManager) *ws.Handler { ... }
```

---

### Task 30: Main entry

**Files:** `cmd/server/main.go`

```go
func main() {
    cfg := config.Load()
    p := provider.NewProvider(cfg)

    mux := http.NewServeMux()
    mux.HandleFunc("GET /config", p.HTTPHandler.HandleConfig)
    mux.HandleFunc("GET /rooms", p.HTTPHandler.HandleRooms)
    mux.HandleFunc("POST /seed", p.HTTPHandler.HandleSeed)
    mux.HandleFunc("/", p.HTTPHandler.HandleStatic)

    server := &http.Server{
        Addr:    fmt.Sprintf(":%d", cfg.Port),
        Handler: mux,
    }
    log.Printf("Monopoli server aktif di http://0.0.0.0:%d", cfg.Port)
    server.ListenAndServe()
}
```

---

## Phase 8: Verification

### Task 31: Go tests

```bash
cd backend && go test ./...
```

All ported tests must pass.

### Task 32: Build

```bash
cd backend && go build -o monopoly-server ./cmd/server
```

Verify binary runs on port 3001.

### Task 33: E2E tests

Start Go server, run existing E2E suite:
```bash
# Terminal 1: Go server
cd backend && E2E_SEED_ENABLED=true go run ./cmd/server

# Terminal 2: E2E tests
npm run test:e2e
```

May need adapter if E2E tests expect specific startup behavior.

### Task 34: Manual smoke test

1. Open React app → create room → verify welcome message
2. Second player joins → verify lobby
3. Start game → roll dice → buy property → build house → propose trade
4. Verify all JSON messages match expected shapes

### Task 35: Cleanup (after all tests pass)

- Delete `server/` directory
- Update `package.json` scripts: `"server": "cd backend && go run ./cmd/server"`
- Update AGENTS.md server commands

---

## Commit Strategy

After each task (or small group of related tasks), commit:
```
git add -A && git commit -m "feat(backend): [task description]"
```

Suggested commit groups:
1. `feat(backend): init module + dependencies`
2. `feat(backend): entity types (game, net, emotion)`
3. `feat(backend): config + pkg (clock, env)`
4. `feat(backend): data layer (board, cards, players, avatars)`
5. `feat(backend): game logic usecases (reducer, rent, build, cards, seed, dice)`
6. `feat(backend): bot usecases (ai, emotions)`
7. `feat(backend): room usecase (manager)`
8. `feat(backend): GameServer (stateful, mutex + clock)`
9. `feat(backend): infrastructure (repositories, DTOs, converter)`
10. `feat(backend): delivery layer (HTTP + WebSocket)`
11. `feat(backend): wiring + main entry`
12. `feat(backend): port all unit tests`
13. `feat(backend): verify E2E + cleanup`
