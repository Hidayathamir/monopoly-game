import type { PresetAvatarId } from '../data/avatars';

export const SpaceType = {
  Property: 'property',
  Railroad: 'railroad',
  Utility: 'utility',
  Chance: 'chance',
  Community: 'community',
  Tax: 'tax',
  Go: 'go',
  Jail: 'jail',
  GoToJail: 'goToJail',
  FreeParking: 'freeParking',
} as const;
export type SpaceType = (typeof SpaceType)[keyof typeof SpaceType];

export const CardType = {
  Chance: 'chance',
  Community: 'community',
} as const;
export type CardType = (typeof CardType)[keyof typeof CardType];

export const AvatarKind = {
  Preset: 'preset',
  Custom: 'custom',
} as const;
export type AvatarKind = (typeof AvatarKind)[keyof typeof AvatarKind];

export const CardActionType = {
  Collect: 'collect',
  Pay: 'pay',
  GoToJail: 'goToJail',
  GetOutOfJailFree: 'getOutOfJailFree',
  GoToSpace: 'goToSpace',
  CollectFromPlayers: 'collectFromPlayers',
  StreetRepairs: 'streetRepairs',
} as const;
export type CardActionType = (typeof CardActionType)[keyof typeof CardActionType];

export const TaxType = {
  Income: 'income',
  Luxury: 'luxury',
} as const;
export type TaxType = (typeof TaxType)[keyof typeof TaxType];

export const GamePhase = {
  Setup: 'setup',
  Waiting: 'waiting',
  Rolling: 'rolling',
  Moving: 'moving',
  Resolving: 'resolving',
  Buying: 'buying',
  Building: 'building',
  GameOver: 'gameOver',
} as const;
export type GamePhase = (typeof GamePhase)[keyof typeof GamePhase];

export const PendingActionType = {
  BuyProperty: 'buyProperty',
  PayRent: 'payRent',
  DrawCard: 'drawCard',
  CardEffect: 'cardEffect',
  Bankruptcy: 'bankruptcy',
} as const;
export type PendingActionType = (typeof PendingActionType)[keyof typeof PendingActionType];

export const GameActionType = {
  StartGame: 'START_GAME',
  RollDice: 'ROLL_DICE',
  DiceAnimated: 'DICE_ANIMATED',
  MoveToken: 'MOVE_TOKEN',
  PassGo: 'PASS_GO',
  ResolveSpace: 'RESOLVE_SPACE',
  BuyProperty: 'BUY_PROPERTY',
  DeclineBuy: 'DECLINE_BUY',
  PayRent: 'PAY_RENT',
  BuildHouse: 'BUILD_HOUSE',
  SellHouse: 'SELL_HOUSE',
  Mortgage: 'MORTGAGE',
  Unmortgage: 'UNMORTGAGE',
  SellProperty: 'SELL_PROPERTY',
  ProposeTrade: 'PROPOSE_TRADE',
  AcceptTrade: 'ACCEPT_TRADE',
  RejectTrade: 'REJECT_TRADE',
  CancelTrade: 'CANCEL_TRADE',
  DrawCard: 'DRAW_CARD',
  ResolveCard: 'RESOLVE_CARD',
  AttemptJailbreak: 'ATTEMPT_JAILBREAK',
  EndTurn: 'END_TURN',
  DeclareBankruptcy: 'DECLARE_BANKRUPTCY',
  CollectFreeParking: 'COLLECT_FREE_PARKING',
  SkipAction: 'SKIP_ACTION',
  PayJailFine: 'PAY_JAIL_FINE',
  UseGetOutOfJailFree: 'USE_GET_OUT_OF_JAIL_FREE',
  SetBotControl: 'SET_BOT_CONTROL',
  SetReconnectGrace: 'SET_RECONNECT_GRACE',
} as const;
export type GameActionType = (typeof GameActionType)[keyof typeof GameActionType];

export const BotControlReason = { Offline: 'offline', Afk: 'afk' } as const;
export type BotControlReason = (typeof BotControlReason)[keyof typeof BotControlReason];

export const LogEventKey = {
  GameStarted: 'event.gameStarted',
  Turn: 'event.turn',
  Rolled: 'event.rolled',
  RolledAimed: 'event.rolledAimed',
  PassedGo: 'event.passedGo',
  JailBreakDoubles: 'event.jailBreakDoubles',
  JailForcedOut: 'event.jailForcedOut',
  JailFailed: 'event.jailFailed',
  TripleDoubles: 'event.tripleDoubles',
  ToJail: 'event.toJail',
  FreeParkingJackpot: 'event.freeParkingJackpot',
  IncomeTax: 'event.incomeTax',
  LuxuryTax: 'event.luxuryTax',
  OwnerInJail: 'event.ownerInJail',
  MonopolyRent: 'event.monopolyRent',
  MustCircleBoard: 'event.mustCircleBoard',
  Bought: 'event.bought',
  PaidRent: 'event.paidRent',
  BuiltHouse: 'event.builtHouse',
  BuiltHotel: 'event.builtHotel',
  SoldHouse: 'event.soldHouse',
  Mortgaged: 'event.mortgaged',
  Unmortgaged: 'event.unmortgaged',
  SoldToBank: 'event.soldToBank',
  TradeProposed: 'event.tradeProposed',
  TradeAccepted: 'event.tradeAccepted',
  TradeRejected: 'event.tradeRejected',
  TradeCancelled: 'event.tradeCancelled',
  PaidJailFine: 'event.paidJailFine',
  UsedJailCard: 'event.usedJailCard',
  DoublesAgain: 'event.doublesAgain',
  CardCollect: 'event.cardCollect',
  CardPay: 'event.cardPay',
  CardToJail: 'event.cardToJail',
  GotJailCard: 'event.gotJailCard',
  CardCollectPlayers: 'event.cardCollectPlayers',
  CardStreetRepairs: 'event.cardStreetRepairs',
  MovedForward: 'event.movedForward',
  MovedBack: 'event.movedBack',
  Bankruptcy: 'event.bankruptcy',
  BankruptcyWin: 'event.bankruptcyWin',
  BankruptcyTransfer: 'event.bankruptcyTransfer',
  PlayerOffline: 'event.playerOffline',
  PlayerAfk: 'event.playerAfk',
  PlayerBack: 'event.playerBack',
  ReconnectWait: 'event.reconnectWait',
} as const;
export type LogEventKey = (typeof LogEventKey)[keyof typeof LogEventKey];

export const LogParamKey = {
  Bot: 'bot',
  SpaceId: 'spaceId',
  CardId: 'cardId',
  Amount: 'amount',
  Money: 'money',
  PerHouse: 'perHouse',
  PerHotel: 'perHotel',
  PerPlayer: 'perPlayer',
} as const;
export type LogParamKey = (typeof LogParamKey)[keyof typeof LogParamKey];

export type Player = {
  id: number;
  name: string;
  money: number;
  position: number;
  properties: number[];
  passedGo: boolean;
  inJail: boolean;
  jailTurns: number;
  bankrupt: boolean;
  getOutOfJailFreeCards: number;
  isBot: boolean;
  botControlled: boolean;
  afk: boolean;
  color: string;
  avatar: PlayerAvatar;
};

export type PlayerAvatar =
  | { kind: typeof AvatarKind.Preset; id: PresetAvatarId }
  | { kind: typeof AvatarKind.Custom; dataUrl: string };

export type Space = {
  id: number;
  type: SpaceType;
  price?: number;
  rent?: number[];
  houseCost?: number[];
  color?: string;
  owner: number | null;
  houses: number;
  mortgaged: boolean;
  taxType?: TaxType;
};

export type Card = {
  id: number;
  type: CardType;
  effect: CardEffect;
};

export type LogEntry = { key: LogEventKey; params?: Record<string, string | number | boolean> };

export type ReconnectGrace = { playerId: number; until: number };

export type CardEffect =
  | { action: typeof CardActionType.Collect; amount: number }
  | { action: typeof CardActionType.Pay; amount: number }
  | { action: typeof CardActionType.GoToJail }
  | { action: typeof CardActionType.GetOutOfJailFree }
  | { action: typeof CardActionType.GoToSpace; spaceId: number }
  | { action: typeof CardActionType.CollectFromPlayers; amount: number }
  | { action: typeof CardActionType.StreetRepairs; perHouse: number; perHotel: number };

export type GameState = {
  phase: GamePhase;
  players: Player[];
  turnOrder: number[];
  currentPlayer: number;
  board: Space[];
  chanceDeck: Card[];
  communityDeck: Card[];
  freeParkingPot: number;
  dice: [number, number] | null;
  doublesCount: number;
  lastMoveSteps: number | null;
  eventLog: LogEntry[];
  pendingAction: PendingAction | null;
  justBoughtSpaceId: number | null;
  builtThisStop: boolean;
  reconnectGrace: ReconnectGrace | null;
  pendingTrades: PendingTrade[];
  nextTradeId: number;
  tradesEnabled: boolean;
};

export type PendingAction =
  | { type: typeof PendingActionType.BuyProperty; spaceId: number }
  | { type: typeof PendingActionType.PayRent; spaceId: number; amount: number }
  | { type: typeof PendingActionType.DrawCard; cardType: CardType }
  | { type: typeof PendingActionType.CardEffect; card: Card }
  | { type: typeof PendingActionType.Bankruptcy; amount: number; spaceId: number };

export type TradeOffer = {
  fromId: number;
  toId: number;
  offerProperties: number[];
  offerCash: number;
  requestProperties: number[];
  requestCash: number;
};

export type PendingTrade = TradeOffer & { id: number };

export type GameAction =
  | { type: typeof GameActionType.StartGame; playerCount: number; names: string[]; isBot?: boolean[]; colors?: string[]; avatars?: PlayerAvatar[] }
  | { type: typeof GameActionType.RollDice; target?: number }
  | { type: typeof GameActionType.DiceAnimated; dice: [number, number]; target?: number; luck?: number }
  | { type: typeof GameActionType.MoveToken; spaces: number }
  | { type: typeof GameActionType.PassGo }
  | { type: typeof GameActionType.ResolveSpace }
  | { type: typeof GameActionType.BuyProperty }
  | { type: typeof GameActionType.DeclineBuy }
  | { type: typeof GameActionType.PayRent }
  | { type: typeof GameActionType.BuildHouse; spaceId: number }
  | { type: typeof GameActionType.SellHouse; spaceId: number }
  | { type: typeof GameActionType.Mortgage; spaceId: number }
  | { type: typeof GameActionType.Unmortgage; spaceId: number }
  | { type: typeof GameActionType.SellProperty; spaceId: number }
  | { type: typeof GameActionType.ProposeTrade; offer: TradeOffer }
  | { type: typeof GameActionType.AcceptTrade; tradeId: number }
  | { type: typeof GameActionType.RejectTrade; tradeId: number }
  | { type: typeof GameActionType.CancelTrade; tradeId: number }
  | { type: typeof GameActionType.DrawCard }
  | { type: typeof GameActionType.ResolveCard }
  | { type: typeof GameActionType.AttemptJailbreak; dice: [number, number] }
  | { type: typeof GameActionType.EndTurn }
  | { type: typeof GameActionType.DeclareBankruptcy }
  | { type: typeof GameActionType.CollectFreeParking }
  | { type: typeof GameActionType.SkipAction }
  | { type: typeof GameActionType.PayJailFine }
  | { type: typeof GameActionType.UseGetOutOfJailFree }
  | { type: typeof GameActionType.SetBotControl; playerId: number; controlled: boolean; reason?: BotControlReason }
  | { type: typeof GameActionType.SetReconnectGrace; playerId: number; until: number | null };

export type GameApi = {
  state: GameState;
  myPlayerId: number | null;
  roll: (target?: number) => void;
  buyProperty: () => void;
  declineBuy: () => void;
  payRent: () => void;
  buildHouse: (spaceId: number) => void;
  sellHouse: (spaceId: number) => void;
  mortgage: (spaceId: number) => void;
  unmortgage: (spaceId: number) => void;
  sellProperty: (spaceId: number) => void;
  proposeTrade: (offer: TradeOffer) => void;
  acceptTrade: (tradeId: number) => void;
  rejectTrade: (tradeId: number) => void;
  cancelTrade: (tradeId: number) => void;
  drawCard: () => void;
  resolveCard: () => void;
  endTurn: () => void;
  declareBankruptcy: () => void;
  skipAction: () => void;
  payJailFine: () => void;
  useGetOutOfJailFree: () => void;
  resetGame: () => void;
};
