import { LogEventKey, type LogEventKey as LogEventKeyType } from '../types/game';
import { SoundId, type SoundId as SoundIdType } from './soundEngine';

export function soundForLogKey(key: LogEventKeyType): SoundIdType | null {
  switch (key) {
    case LogEventKey.Rolled:
    case LogEventKey.RolledAimed:
    case LogEventKey.DoublesAgain:
    case LogEventKey.JailFailed:
      return SoundId.DiceLand;
    case LogEventKey.PassedGo:
    case LogEventKey.CardCollect:
    case LogEventKey.CardCollectPlayers:
    case LogEventKey.FreeParkingJackpot:
    case LogEventKey.PaidJailFine:
    case LogEventKey.UsedJailCard:
    case LogEventKey.JailBreakDoubles:
      return SoundId.MoneyGain;
    case LogEventKey.PaidRent:
    case LogEventKey.CardPay:
    case LogEventKey.IncomeTax:
    case LogEventKey.LuxuryTax:
    case LogEventKey.CardStreetRepairs:
    case LogEventKey.SoldHouse:
    case LogEventKey.SoldToBank:
    case LogEventKey.BankruptcyTransfer:
      return SoundId.MoneyLoss;
    case LogEventKey.Bought:
      return SoundId.Buy;
    case LogEventKey.BuiltHouse:
    case LogEventKey.BuiltHotel:
      return SoundId.Build;
    case LogEventKey.MovedForward:
    case LogEventKey.MovedBack:
    case LogEventKey.GotJailCard:
      return SoundId.Card;
    case LogEventKey.ToJail:
    case LogEventKey.CardToJail:
      return SoundId.Jail;
    case LogEventKey.TradeProposed:
    case LogEventKey.TradeAccepted:
      return SoundId.Trade;
    case LogEventKey.Bankruptcy:
      return SoundId.Bankruptcy;
    case LogEventKey.BankruptcyWin:
      return SoundId.Win;
    case LogEventKey.GameStarted:
      return SoundId.GameStart;
    default:
      return null;
  }
}