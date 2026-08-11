import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { GameState } from '../types/game';
import { formatMoney } from '../utils/format';
import PropertyTooltip, { type CellSide } from './PropertyTooltip';

interface Props {
  state: GameState;
  playerColors: string[];
  onSell: (spaceId: number) => void;
  onMortgage: (spaceId: number) => void;
  onUnmortgage: (spaceId: number) => void;
  onBuild: (spaceId: number) => void;
}

function getSide(id: number): CellSide {
  if (id === 0 || id === 10 || id === 20 || id === 30) return 'corner';
  if (id <= 9) return 'bottom';
  if (id <= 19) return 'right';
  if (id <= 29) return 'left';
  return 'top';
}

const HIDE_DELAY = 400;

export default function BoardGrid({ state, playerColors, onSell, onMortgage, onUnmortgage, onBuild }: Props) {
  const { board } = state;
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [tooltipCellRect, setTooltipCellRect] = useState<DOMRect | null>(null);
  const [boardRect, setBoardRect] = useState<DOMRect | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boardGridRef = useRef<HTMLDivElement | null>(null);

  function handleEnter(id: number, e: React.MouseEvent) {
    if (timerRef.current) clearTimeout(timerRef.current);
    const board = boardGridRef.current?.closest('.game-board');
    if (board) setBoardRect(board.getBoundingClientRect());
    setTooltipCellRect((e.currentTarget as HTMLElement).getBoundingClientRect());
    setHoveredId(id);
  }

  function handleLeave() {
    timerRef.current = setTimeout(() => setHoveredId(null), HIDE_DELAY);
  }

  const portalTarget = boardGridRef.current?.closest('.game-board') as HTMLElement | null;

  return (
    <div className="board-grid" ref={boardGridRef}>
      {board.map((space) => {
        const owner = space.owner !== null ? state.players[space.owner] : null;

        return (
          <div
            key={space.id}
            className={`board-cell cell-${space.type} cell-id-${space.id}`}
            style={space.color ? { background: `${space.color}30` } : undefined}
            onMouseEnter={(e) => handleEnter(space.id, e)}
            onMouseLeave={handleLeave}
          >
            <div className="cell-name">{space.name}</div>
            {space.price && <div className="cell-price">{formatMoney(space.price)}</div>}
            {space.houses > 0 && space.houses < 5 && (
              <div className="cell-houses">{'🏠'.repeat(space.houses)}</div>
            )}
            {space.houses === 5 && <div className="cell-hotel">🏨</div>}
            {space.mortgaged && <div className="cell-mortgaged">M</div>}
            {owner && (
              <div
                className="cell-owner-bar"
                style={{ backgroundColor: playerColors[owner.id] }}
              />
            )}
          </div>
        );
      })}

      {hoveredId != null && tooltipCellRect && boardRect && portalTarget &&
        createPortal(
          <PropertyTooltip
            space={board[hoveredId]}
            state={state}
            rect={tooltipCellRect}
            boardRect={boardRect}
            side={getSide(hoveredId)}
            onSell={onSell}
            onMortgage={onMortgage}
            onUnmortgage={onUnmortgage}
            onBuild={onBuild}
          />,
          portalTarget,
        )
      }
    </div>
  );
}
