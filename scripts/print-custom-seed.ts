import { createSeededState, validateStateStructure, ValidationKind } from '../src/logic/seed'
import { GamePhase } from '../src/types/game'

const args = process.argv.slice(2)
const late = args.includes('late')
const [argName1, argName2, argMoney1, argMoney2, argCurrent] = args.filter((a) => a !== 'late')

const name1 = argName1 ?? 'P1'
const name2 = argName2 ?? 'P2'
const money1 = Number(argMoney1 ?? (late ? 900 : 1200))
const money2 = Number(argMoney2 ?? (late ? 750 : 1450))
const currentPlayer = Number(argCurrent ?? 1)

const board = late
  ? {
      // P1: Brown (1,3), Pink (11,13,14), Orange (16,18,19), Green (31,32,34), Railroads (5,25), Utility (12)
      1: { owner: 0, houses: 1 },
      3: { owner: 0, houses: 1 },
      5: { owner: 0 },
      11: { owner: 0 },
      12: { owner: 0 },
      13: { owner: 0 },
      14: { owner: 0 },
      16: { owner: 0, houses: 2 },
      18: { owner: 0, houses: 2 },
      19: { owner: 0, houses: 2 },
      25: { owner: 0 },
      31: { owner: 0 },
      32: { owner: 0 },
      34: { owner: 0 },
      // P2: Light Blue (6,8,9), Red (21,23,24), Yellow (26,27,29), Dark Blue (37,39), Railroads (15,35), Utility (28)
      6: { owner: 1, houses: 2 },
      8: { owner: 1, houses: 2 },
      9: { owner: 1, houses: 2 },
      15: { owner: 1 },
      21: { owner: 1 },
      23: { owner: 1 },
      24: { owner: 1 },
      26: { owner: 1 },
      27: { owner: 1 },
      28: { owner: 1 },
      29: { owner: 1 },
      35: { owner: 1 },
      37: { owner: 1, houses: 1 },
      39: { owner: 1, houses: 1 },
    }
  : {
      // P1: full Brown set (1, 3) + Reading Railroad (5) + Park Place (37)
      1: { owner: 0 },
      3: { owner: 0 },
      5: { owner: 0 },
      37: { owner: 0 },
      // P2: full Light Blue set (6, 8, 9) + Electric Company (12)
      6: { owner: 1 },
      8: { owner: 1 },
      9: { owner: 1 },
      12: { owner: 1 },
    }

const state = createSeededState({
  players: [
    { id: 0, name: name1, money: money1, passedGo: true },
    { id: 1, name: name2, money: money2, passedGo: true },
  ],
  board,
  currentPlayer,
  turnOrder: [1, 0],
  phase: GamePhase.Waiting,
  tradesEnabled: false,
})

const check = validateStateStructure(state)
if (check.kind !== ValidationKind.Ok) {
  console.error(`INVALID SEED: ${check.message}`)
  process.exit(1)
}

const summary = late
  ? 'All 28 buyable spaces are owned (houses on Brown/Orange for P1, Light Blue/Red/Dark Blue for P2).'
  : 'P1: Brown set + Reading RR + Park Place. P2: Light Blue set + Electric Co.'
console.log(`Late-game seed for ${name1} (id 0) vs ${name2} (id 1) — ${name2}'s turn, Waiting phase. ${summary}`)
console.log('Option A — paste into the Load Scenario panel (room code + JSON below):')
console.log(JSON.stringify(state, null, 2))
console.log()
console.log('Option B — curl (replace ROOMCODE with the 5-char code shown in the lobby):')
console.log(
  `curl -X POST http://localhost:3001/seed -H 'Content-Type: application/json' -d '${JSON.stringify({ code: 'ROOMCODE', state })}'`,
)
