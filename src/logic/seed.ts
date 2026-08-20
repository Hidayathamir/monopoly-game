import { GamePhase, type GameState, type PendingAction, type Player, type Space } from '../types/game';
import { createInitialBoard, BOARD_SIZE, MAX_HOUSES } from '../data/board';
import { CHANCE_CARDS, COMMUNITY_CARDS } from '../data/cards';
import { MAX_PLAYERS } from '../data/players';

export type SeedBoardOverride = { owner?: number; houses?: number; mortgaged?: boolean };

export interface SeedPlayerSpec {
  id: number;
  name: string;
  money: number;
  position?: number;
  inJail?: boolean;
  jailTurns?: number;
  getOutOfJailFreeCards?: number;
  bankrupt?: boolean;
  isBot?: boolean;
  botControlled?: boolean;
  afk?: boolean;
  passedGo?: boolean;
}

export interface SeedSpec {
  players: SeedPlayerSpec[];
  board?: Partial<Record<number, SeedBoardOverride>>;
  currentPlayer: number;
  turnOrder?: number[];
  phase?: GamePhase;
  pendingAction?: PendingAction | null;
  tradesEnabled?: boolean;
}

export function createSeededState(spec: SeedSpec): GameState {
  const board: Space[] = createInitialBoard();
  for (const [idStr, override] of Object.entries(spec.board ?? {})) {
    const id = Number(idStr);
    if (override == null) continue;
    board[id] = { ...board[id], ...definedOnly(override) };
  }
  const owners = new Map<number, number[]>();
  board.forEach((space) => {
    if (space.owner === null) return;
    const list = owners.get(space.owner) ?? [];
    list.push(space.id);
    owners.set(space.owner, list);
  });
  const players: Player[] = [...spec.players]
    .sort((a, b) => a.id - b.id)
    .map((p) => ({
      id: p.id,
      name: p.name,
      money: p.money,
      position: p.position ?? 0,
      properties: owners.get(p.id) ?? [],
      passedGo: p.passedGo ?? true,
      inJail: p.inJail ?? false,
      jailTurns: p.jailTurns ?? 0,
      bankrupt: p.bankrupt ?? false,
      getOutOfJailFreeCards: p.getOutOfJailFreeCards ?? 0,
      isBot: p.isBot ?? false,
      botControlled: p.botControlled ?? false,
      afk: p.afk ?? false,
    }));
  return {
    phase: spec.phase ?? GamePhase.Waiting,
    players,
    turnOrder: spec.turnOrder ?? players.map((p) => p.id),
    currentPlayer: spec.currentPlayer,
    board,
    chanceDeck: [...CHANCE_CARDS],
    communityDeck: [...COMMUNITY_CARDS],
    freeParkingPot: 0,
    dice: null,
    doublesCount: 0,
    lastMoveSteps: null,
    eventLog: [],
    pendingAction: spec.pendingAction ?? null,
    justBoughtSpaceId: null,
    builtThisStop: false,
    reconnectGrace: null,
    pendingTrades: [],
    nextTradeId: 0,
    tradesEnabled: spec.tradesEnabled ?? false,
  };
}

function definedOnly<T extends object>(src: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(src)) {
    if (value !== undefined) out[key] = value;
  }
  return out as Partial<T>;
}

export const ValidationKind = { Ok: 'ok', Error: 'error' } as const;
export type ValidationKind = (typeof ValidationKind)[keyof typeof ValidationKind];

export type ValidationResult =
  | { kind: typeof ValidationKind.Ok }
  | { kind: typeof ValidationKind.Error; message: string };

export function validateStateStructure(state: GameState): ValidationResult {
  if (state.board.length !== BOARD_SIZE) {
    return { kind: ValidationKind.Error, message: `board must have ${BOARD_SIZE} spaces, got ${state.board.length}` };
  }
  const playerIds = state.players.map((p) => p.id);
  if (new Set(playerIds).size !== playerIds.length) {
    return { kind: ValidationKind.Error, message: 'player ids must be unique' };
  }
  if (playerIds.some((id) => id < 0 || id >= MAX_PLAYERS)) {
    return { kind: ValidationKind.Error, message: `player ids must be in 0..${MAX_PLAYERS - 1}` };
  }
  const expectedTurn = [...playerIds].sort((a, b) => a - b);
  const actualTurn = [...state.turnOrder].sort((a, b) => a - b);
  if (state.turnOrder.length !== playerIds.length || expectedTurn.some((v, i) => v !== actualTurn[i])) {
    return { kind: ValidationKind.Error, message: 'turnOrder must be a permutation of the player ids' };
  }
  if (!state.turnOrder.includes(state.currentPlayer)) {
    return { kind: ValidationKind.Error, message: 'currentPlayer must be in turnOrder' };
  }
  if (state.board.some((s) => s.owner !== null && !playerIds.includes(s.owner))) {
    return { kind: ValidationKind.Error, message: 'board has an owner that is not a player id' };
  }
  if (state.board.some((s) => s.houses < 0 || s.houses > MAX_HOUSES)) {
    return { kind: ValidationKind.Error, message: 'houses must be within 0..5' };
  }
  for (const player of state.players) {
    const owned = state.board.filter((s) => s.owner === player.id).map((s) => s.id).sort((a, b) => a - b);
    const claimed = [...player.properties].sort((a, b) => a - b);
    if (owned.length !== claimed.length || owned.some((v, i) => v !== claimed[i])) {
      return { kind: ValidationKind.Error, message: `player ${player.id} (${player.name}) properties must match its owned board spaces` };
    }
  }
  if (state.players.some((p) => !Number.isFinite(p.money) || p.money < 0)) {
    return { kind: ValidationKind.Error, message: 'player money must be a non-negative finite number' };
  }
  if (state.players.some((p) => p.position < 0 || p.position >= BOARD_SIZE)) {
    return { kind: ValidationKind.Error, message: 'player position must be within 0..39' };
  }
  if (state.phase === GamePhase.Waiting && (state.pendingAction !== null || state.dice !== null)) {
    return { kind: ValidationKind.Error, message: 'Waiting state must have pendingAction === null and dice === null' };
  }
  if (state.phase === GamePhase.Resolving && state.pendingAction === null) {
    return { kind: ValidationKind.Error, message: 'Resolving state must have a pendingAction' };
  }
  return { kind: ValidationKind.Ok };
}

export interface SlotInfo {
  name: string | null;
  connected: boolean;
  isBot: boolean;
}

export function validateStateForRoom(state: GameState, slots: SlotInfo[]): ValidationResult {
  const joined = slots.filter((s) => s.name !== null).length;
  if (state.players.length !== joined) {
    return { kind: ValidationKind.Error, message: `seed has ${state.players.length} players but the room has ${joined} joined slots` };
  }
  for (const p of state.players) {
    const slot = slots[p.id];
    if (!slot || slot.name === null) {
      return { kind: ValidationKind.Error, message: `player ${p.id} (${p.name}) has no matching joined slot` };
    }
    if (state.players[p.id] !== p) {
      return { kind: ValidationKind.Error, message: `player ${p.id} must sit at players[${p.id}] (slot index)` };
    }
  }
  const current = slots[state.currentPlayer];
  if (!current || current.name === null || (!current.connected && !current.isBot)) {
    return { kind: ValidationKind.Error, message: 'currentPlayer must be a connected client or a bot slot' };
  }
  return { kind: ValidationKind.Ok };
}