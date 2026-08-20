import { describe, it, expect } from 'vitest'
import { soundForLogKey } from '../soundMap'
import { SoundId } from '../soundEngine'
import { LogEventKey } from '../../types/game'

describe('soundForLogKey', () => {
  const cases: Array<[LogEventKey, SoundId | null]> = [
    [LogEventKey.GameStarted, SoundId.GameStart],
    [LogEventKey.Rolled, SoundId.DiceRoll],
    [LogEventKey.RolledAimed, SoundId.DiceRoll],
    [LogEventKey.DoublesAgain, SoundId.DiceRoll],
    [LogEventKey.JailFailed, SoundId.DiceRoll],
    [LogEventKey.Bought, SoundId.Buy],
    [LogEventKey.BuiltHouse, SoundId.Build],
    [LogEventKey.BuiltHotel, SoundId.Build],
    [LogEventKey.PaidRent, SoundId.MoneyLoss],
    [LogEventKey.CardPay, SoundId.MoneyLoss],
    [LogEventKey.IncomeTax, SoundId.MoneyLoss],
    [LogEventKey.LuxuryTax, SoundId.MoneyLoss],
    [LogEventKey.CardStreetRepairs, SoundId.MoneyLoss],
    [LogEventKey.SoldHouse, SoundId.MoneyLoss],
    [LogEventKey.SoldToBank, SoundId.MoneyLoss],
    [LogEventKey.BankruptcyTransfer, SoundId.MoneyLoss],
    [LogEventKey.PassedGo, SoundId.MoneyGain],
    [LogEventKey.CardCollect, SoundId.MoneyGain],
    [LogEventKey.CardCollectPlayers, SoundId.MoneyGain],
    [LogEventKey.FreeParkingJackpot, SoundId.MoneyGain],
    [LogEventKey.PaidJailFine, SoundId.MoneyGain],
    [LogEventKey.UsedJailCard, SoundId.MoneyGain],
    [LogEventKey.JailBreakDoubles, SoundId.MoneyGain],
    [LogEventKey.ToJail, SoundId.Jail],
    [LogEventKey.CardToJail, SoundId.Jail],
    [LogEventKey.TradeProposed, SoundId.Trade],
    [LogEventKey.TradeAccepted, SoundId.Trade],
    [LogEventKey.Bankruptcy, SoundId.Bankruptcy],
    [LogEventKey.BankruptcyWin, SoundId.Win],
    [LogEventKey.MovedForward, SoundId.Card],
    [LogEventKey.MovedBack, SoundId.Card],
    [LogEventKey.GotJailCard, SoundId.Card],
    [LogEventKey.Turn, null],
    [LogEventKey.TripleDoubles, null],
    [LogEventKey.JailForcedOut, null],
    [LogEventKey.OwnerInJail, null],
    [LogEventKey.MonopolyRent, null],
    [LogEventKey.MustCircleBoard, null],
    [LogEventKey.Mortgaged, null],
    [LogEventKey.Unmortgaged, null],
    [LogEventKey.TradeRejected, null],
    [LogEventKey.TradeCancelled, null],
    [LogEventKey.PlayerOffline, null],
    [LogEventKey.PlayerBack, null],
    [LogEventKey.ReconnectWait, null],
  ]

  it.each(cases)('maps %s', (key, expected) => {
    expect(soundForLogKey(key)).toBe(expected)
  })

  it('returns a SoundId or null for every log key (exhaustive)', () => {
    for (const key of Object.values(LogEventKey)) {
      const sound = soundForLogKey(key)
      expect(sound === null || Object.values(SoundId).includes(sound)).toBe(true)
    }
  })
})