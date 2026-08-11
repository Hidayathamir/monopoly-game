import type { ReactNode } from 'react';
import type { GameState } from '../types/game';
import BoardGrid from './BoardGrid';
import PlayerTokens from './PlayerTokens';

interface Props {
  state: GameState;
  children?: ReactNode;
  onSell: (spaceId: number) => void;
  onMortgage: (spaceId: number) => void;
  onUnmortgage: (spaceId: number) => void;
  onBuild: (spaceId: number) => void;
}

export default function GameBoard({ state, children, onSell, onMortgage, onUnmortgage, onBuild }: Props) {
  return (
    <div className="game-board-wrapper">
      <div className="game-board">
        <BoardGrid
          state={state}
          playerColors={['#E74C3C', '#3498DB', '#2ECC71', '#F39C12']}
          onSell={onSell}
          onMortgage={onMortgage}
          onUnmortgage={onUnmortgage}
          onBuild={onBuild}
        />
        <PlayerTokens state={state} playerColors={['#E74C3C', '#3498DB', '#2ECC71', '#F39C12']} />
        {children}
      </div>
    </div>
  );
}
