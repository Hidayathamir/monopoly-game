package entity

// LobbyPlayer represents a player in the lobby (pre-game).
type LobbyPlayer struct {
	ID        int              `json:"id"`
	Name      *string          `json:"name"`
	Connected bool             `json:"connected"`
	IsBot     bool             `json:"isBot"`
	Color     string           `json:"color"`
	Avatar    PlayerAvatarData `json:"avatar"`
}

// RoomInfo represents a public room listing.
type RoomInfo struct {
	Code        string    `json:"code"`
	HostName    *string   `json:"hostName"`
	PlayerCount int       `json:"playerCount"`
	Phase       GamePhase `json:"phase"`
}

// ConnectionStatus string constants and type
type ConnectionStatus = string

const (
	ConnectionStatusConnecting   ConnectionStatus = "connecting"
	ConnectionStatusConnected    ConnectionStatus = "connected"
	ConnectionStatusDisconnected ConnectionStatus = "disconnected"
)

// ClientMessageType string constants and type
type ClientMessageType = string

const (
	ClientMessageTypeCreate          ClientMessageType = "create"
	ClientMessageTypeJoin            ClientMessageType = "join"
	ClientMessageTypeStart           ClientMessageType = "start"
	ClientMessageTypeLeave           ClientMessageType = "leave"
	ClientMessageTypeAddBot          ClientMessageType = "addBot"
	ClientMessageTypeRemoveBot       ClientMessageType = "removeBot"
	ClientMessageTypeAction          ClientMessageType = "action"
	ClientMessageTypeSetIdentity     ClientMessageType = "setIdentity"
	ClientMessageTypeManualBotToggle ClientMessageType = "manualBotToggle"
	ClientMessageTypeEmoticon        ClientMessageType = "emoticon"
)

// ServerMessageType string constants and type
type ServerMessageType = string

const (
	ServerMessageTypeWelcome  ServerMessageType = "welcome"
	ServerMessageTypeLobby    ServerMessageType = "lobby"
	ServerMessageTypeState    ServerMessageType = "state"
	ServerMessageTypeLeft     ServerMessageType = "left"
	ServerMessageTypeError    ServerMessageType = "error"
	ServerMessageTypeEmoticon ServerMessageType = "emoticon"
)

// HttpPath string constants and type
type HttpPath = string

const (
	HttpPathConfig HttpPath = "/config"
	HttpPathSeed   HttpPath = "/seed"
	HttpPathRooms  HttpPath = "/rooms"
	HttpPathWs     HttpPath = "/ws"
)

// --- Client messages (discriminated union on Type) ---

// ClientMessage is the top-level interface for all client→server messages.
type ClientMessage interface {
	clientMessageType() // sealed
}

type ClientMessageCreate struct {
	Type   ClientMessageType `json:"type"`
	Name   string            `json:"name"`
	Color  string            `json:"color,omitempty"`
	Avatar *PlayerAvatarData `json:"avatar,omitempty"`
}

func (ClientMessageCreate) clientMessageType() {}

type ClientMessageJoin struct {
	Type   ClientMessageType `json:"type"`
	Code   string            `json:"code"`
	Name   string            `json:"name"`
	Color  string            `json:"color,omitempty"`
	Avatar *PlayerAvatarData `json:"avatar,omitempty"`
}

func (ClientMessageJoin) clientMessageType() {}

type ClientMessageStart struct {
	Type ClientMessageType `json:"type"`
}

func (ClientMessageStart) clientMessageType() {}

type ClientMessageLeave struct {
	Type ClientMessageType `json:"type"`
}

func (ClientMessageLeave) clientMessageType() {}

type ClientMessageAddBot struct {
	Type ClientMessageType `json:"type"`
}

func (ClientMessageAddBot) clientMessageType() {}

type ClientMessageRemoveBot struct {
	Type     ClientMessageType `json:"type"`
	PlayerID int               `json:"playerId"`
}

func (ClientMessageRemoveBot) clientMessageType() {}

type ClientMessageAction struct {
	Type   ClientMessageType `json:"type"`
	Action interface{}       `json:"action"`
}

func (ClientMessageAction) clientMessageType() {}

type ClientMessageSetIdentity struct {
	Type   ClientMessageType `json:"type"`
	Color  string            `json:"color,omitempty"`
	Avatar *PlayerAvatarData `json:"avatar,omitempty"`
}

func (ClientMessageSetIdentity) clientMessageType() {}

type ClientMessageManualBotToggle struct {
	Type ClientMessageType `json:"type"`
}

func (ClientMessageManualBotToggle) clientMessageType() {}

type ClientMessageEmoticon struct {
	Type     ClientMessageType `json:"type"`
	Emoticon Emoticon          `json:"emoticon"`
}

func (ClientMessageEmoticon) clientMessageType() {}

// --- Server messages (discriminated union on Type) ---

// ServerMessage is the top-level interface for all server→client messages.
type ServerMessage interface {
	serverMessageType() // sealed
}

type ServerMessageWelcome struct {
	Type         ServerMessageType `json:"type"`
	PlayerID     int               `json:"playerId"`
	HostPlayerID int               `json:"hostPlayerId"`
	Players      []LobbyPlayer     `json:"players"`
	State        GameState         `json:"state"`
	Code         string            `json:"code"`
}

func (ServerMessageWelcome) serverMessageType() {}

type ServerMessageLobby struct {
	Type         ServerMessageType `json:"type"`
	Players      []LobbyPlayer     `json:"players"`
	HostPlayerID int               `json:"hostPlayerId"`
}

func (ServerMessageLobby) serverMessageType() {}

type ServerMessageState struct {
	Type  ServerMessageType `json:"type"`
	State GameState         `json:"state"`
}

func (ServerMessageState) serverMessageType() {}

type ServerMessageLeft struct {
	Type ServerMessageType `json:"type"`
}

func (ServerMessageLeft) serverMessageType() {}

type ServerMessageError struct {
	Type    ServerMessageType `json:"type"`
	Message string            `json:"message"`
}

func (ServerMessageError) serverMessageType() {}

type ServerMessageEmoticon struct {
	Type     ServerMessageType `json:"type"`
	PlayerID int               `json:"playerId"`
	Emoticon Emoticon          `json:"emoticon"`
}

func (ServerMessageEmoticon) serverMessageType() {}
