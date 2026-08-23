import { EMOTICON_GLYPHS, EMOTICON_LIFETIME_MS, type ActiveEmotion } from '../types/emotion'
import type { GameState } from '../types/game'
import { PLAYER_OFFSETS } from '../data/players'
import { POSITIONS } from './PlayerTokens'

interface Props {
  state: GameState
  emotions: ActiveEmotion[]
}

export default function EmoticonOverlay({ state, emotions }: Props) {
  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
      {emotions.map((em) => {
        const player = state.players[em.playerId]
        if (!player) return null
        const pos = POSITIONS[player.position] ?? POSITIONS[0]
        const offset = PLAYER_OFFSETS[player.id] ?? PLAYER_OFFSETS[0]
        return (
          <div
            key={em.id}
            data-testid={`emoticon-${player.id}-${em.emoticon}`}
            className="absolute z-30 text-2xl"
            style={{
              left: `calc(${pos.x}% + ${offset.dx}px)`,
              top: `calc(${pos.y}% + ${offset.dy}px)`,
              animation: `emoticon-pop ${EMOTICON_LIFETIME_MS}ms ease-out forwards`,
            }}
          >
            {EMOTICON_GLYPHS[em.emoticon]}
          </div>
        )
      })}
    </div>
  )
}
