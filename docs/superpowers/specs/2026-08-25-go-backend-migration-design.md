# Node.js to Go Backend Migration — Design Spec

## Goal

Migrate the existing Node.js WebSocket game server (`server/`) to Go (`backend/`), preserving 100% behavioral and protocol parity so the React client works unchanged.

## Architecture

### Concurrency Model: Mutex-per-Room

Each `GameServer` instance holds a `sync.Mutex` protecting its mutable state (game state, slots, timers). Timer callbacks (`time.AfterFunc`) acquire the lock before mutating. This mirrors the Node.js single-threaded model and is the lowest-risk path to behavioral parity.

### Clock Interface for Testability

A `Clock` interface abstracts time operations:
- `Now() time.Time`
- `AfterFunc(d time.Duration, f func()) Timer`

Real implementation uses `time.AfterFunc`. Fake implementation tracks time manually for deterministic tests (replaces `vi.useFakeTimers()`).

### GameAction: Interface + Concrete Types

TypeScript's discriminated unions (`{ type: "ROLL_DICE", target?: number }`) map to Go interfaces with concrete struct implementations. Custom `MarshalJSON`/`UnmarshalJSON` produce the exact `{ type: "...", ...fields }` JSON shape the React client expects.

### Static Files: Serve from Disk at Runtime

The Go server serves `dist/` from disk at runtime via the `DIST_DIR` env var, matching current behavior. No `go:embed` for dist/ — dev-friendly, no rebuild needed for frontend changes.

## File Structure

Following the [Hidayathamir/golang-clean-architecture](https://github.com/Hidayathamir/golang-clean-architecture) project layout:

```
backend/
├── cmd/
│   └── server/
│       └── main.go                 # entry, env config, DI wiring
├── internal/
│   ├── config/
│   │   └── config.go               # Config struct loaded from env vars
│   ├── converter/
│   │   └── converter.go            # entity ↔ DTO conversion helpers
│   ├── dependency_injection/
│   │   ├── http_dependency_injection.go      # wires HTTP handlers
│   │   ├── ws_dependency_injection.go        # wires WebSocket handlers
│   │   ├── usecase_dependency_injection.go   # wires usecases
│   │   └── repository_dependency_injection.go # wires repositories
│   ├── dto/
│   │   ├── http.go                 # HTTP request/response DTOs (SeedRequest, etc.)
│   │   └── ws.go                   # WS message DTOs (ClientMessageDTO, ServerMessageDTO)
│   ├── entity/
│   │   ├── game_entity.go          # GameState, Player, Space, Card, PendingAction, etc.
│   │   ├── action_entity.go        # GameAction interface + concrete types
│   │   ├── net_entity.go           # ClientMessage, ServerMessage, LobbyPlayer, RoomInfo
│   │   ├── emotion_entity.go       # Emoticon, ActiveEmotion
│   │   └── avatar_entity.go        # PlayerAvatar interface + PresetAvatar/CustomAvatar
│   ├── inbound/
│   │   ├── http/
│   │   │   └── handler.go          # /config, /rooms, /seed, static dist/ SPA fallback
│   │   └── ws/
│   │       ├── handler.go          # WebSocket upgrade + message routing
│   │       └── hub.go              # Client registry (clientId → conn)
│   ├── mock/                       # test mocks (Clock, repositories)
│   ├── outbound/
│   │   └── repository/
│   │       ├── room_repository.go  # RoomRepository interface + in-memory impl
│   │       └── session_repository.go # SessionRepository (clientId→roomId mapping)
│   ├── provider/
│   │   └── provider.go             # DI providers (constructs all dependencies)
│   ├── usecase/
│   │   ├── gameusecase/
│   │   │   ├── reducer.go          # GameReducer (pure, every action case)
│   │   │   ├── server.go           # GameServer (stateful, mutex + Clock)
│   │   │   ├── build.go            # CanBuildOnCurrentSpace
│   │   │   ├── rent.go             # Rent calculation functions
│   │   │   ├── cards.go            # ResolveCardEffect
│   │   │   ├── seed.go             # ValidateStateStructure, ValidateStateForRoom
│   │   │   ├── controlled_dice.go  # RollControlledDice
│   │   │   └── log_entries.go      # ActorEntry, TurnEntry
│   │   ├── botusecase/
│   │   │   ├── ai.go               # DecideBotAction, ShouldAcceptTrade
│   │   │   └── emotions.go         # DetectBotEmotions
│   │   └── roomusecase/
│   │       └── manager.go          # RoomManager (create, list, teardown)
│   └── pkg/
│       ├── clock/
│       │   ├── clock.go            # Clock interface
│       │   ├── real.go             # RealClock
│       │   └── fake.go             # FakeClock for tests
│       └── env/
│           └── env.go              # parseEnvFlag, getEnv helpers
├── go.mod
├── go.sum
└── data/                           # game data files (go:embed)
    ├── board-data.json
    └── cards-data.json
```

## Key Design Decisions

### 1. JSON Field Naming

All Go structs use explicit `json:"fieldName"` tags matching the TypeScript camelCase names exactly. This ensures the React client (`src/net/client.ts`) receives identical JSON.

### 2. WebSocket Protocol

Every message type from `src/types/net.ts` must round-trip identically:
- Client messages: `create`, `join`, `start`, `leave`, `addBot`, `removeBot`, `action`, `setIdentity`, `manualBotToggle`, `emoticon`
- Server messages: `welcome`, `lobby`, `state`, `left`, `error`, `emoticon`

### 3. HTTP Endpoints

| Endpoint | Method | Response |
|---|---|---|
| `/config` | GET | `{ seedEnabled: boolean }` |
| `/rooms` | GET | `[{ code, hostName, playerCount, phase }]` |
| `/seed` | POST | `{ ok: true }` or error (gated by `E2E_SEED_ENABLED`) |
| `/` and `/*` | GET | Static files from `DIST_DIR`, SPA fallback to `index.html` |

### 4. Environment Variables

| Var | Default | Note |
|---|---|---|
| `PORT` | 3001 | |
| `DIST_DIR` | `dist` | |
| `TRADES_ENABLED` | `true` | Set `'false'` to disable |
| `E2E_SEED_ENABLED` | `false` | |
| `AFK_TIMEOUT_MS` | 30000 | |
| `ROOM_EMPTY_GRACE_MS` | 30000 | |

### 5. GameServer Timer Flow

The GameServer owns all timers via the Clock interface:
- `driveBots()` — schedules bot action at 700ms (or 3000ms for grace turns)
- `scheduleAfkTimer()` — fires after AFK_TIMEOUT_MS
- `scheduleAutoSteps()` — auto-resolve, auto-draw-card, auto-end-turn
- `startRoll()` — dice animation delay (500ms) then resolve

All timer callbacks acquire `sync.Mutex` before mutating state.

### 6. Clean Architecture Layers (per reference repo)

| Layer | Path | Responsibility |
|---|---|---|
| `entity` | `internal/entity/` | Domain types (GameState, Player, etc.) — no imports from other layers |
| `dto` | `internal/dto/` | Request/response DTOs for HTTP + WS |
| `converter` | `internal/converter/` | Entity ↔ DTO conversion |
| `outbound` | `internal/outbound/repository/` | Data access interfaces + in-memory implementations |
| `usecase` | `internal/usecase/{domain}usecase/` | Business logic (gameusecase, botusecase, roomusecase) |
| `inbound` | `internal/inbound/{http,ws}/` | Delivery layer (HTTP handlers, WebSocket handlers) |
| `config` | `internal/config/` | Config struct loaded from env vars |
| `provider` | `internal/provider/` | Dependency injection providers |
| `dependency_injection` | `internal/dependency_injection/` | DI per layer (http, ws, usecase, repository) |
| `pkg` | `pkg/` | Shared utilities (clock, env helpers) |

### 7. Static File Serving

- Resolves `DIST_DIR` to absolute path
- Serves files with MIME type detection (html, js, css, svg, png, ico, json)
- Path traversal protection: rejects paths outside `DIST_DIR`
- SPA fallback: if file not found and `Accept: text/html`, serves `index.html`

## Behavioral Parity Checklist

- [ ] Every WebSocket message type round-trips identically in JSON
- [ ] HTTP endpoints return identical responses
- [ ] Port 3001 default, configurable via PORT env
- [ ] All env vars preserved with same defaults
- [ ] Game reducer logic is a faithful port (every action case)
- [ ] Bot AI logic is a faithful port
- [ ] Rent calculation, monopoly detection, bankruptcy all match
- [ ] Timer-based game flow (bot steps, AFK, dice animation, auto-advance) matches
- [ ] Room lifecycle (create, join, leave, disconnect, teardown) matches
- [ ] Seed endpoint validation matches
- [ ] Unit tests ported from vitest to Go testing

## Testing Strategy

### Unit Tests
Each package gets ported tests:
- `internal/usecase/gameusecase/*_test.go` — game reducer, rent, cards, seed, build, controlled dice
- `internal/usecase/botusecase/*_test.go` — bot AI, trade evaluation, emotions
- `internal/usecase/roomusecase/*_test.go` — room manager lifecycle
- `internal/inbound/http/*_test.go` — HTTP endpoints
- `internal/inbound/ws/*_test.go` — WebSocket message handling

### Timer Tests
The `FakeClock` enables deterministic timer testing:
```go
clock := pkgclock.NewFakeClock()
gs := gameusecase.NewGameServer(events, clock, ...)
gs.Roll(clientId)
clock.AdvanceTime(500 * time.Millisecond)  // dice animated
clock.AdvanceTime(5 * 150 * time.Millisecond)  // resolve space
```

### Integration
1. `go test ./...` — all Go tests pass
2. Existing E2E suite (`npm run test:e2e`) — may need adapter for Go server
3. Manual smoke test: create room → join → roll → buy → build → trade
