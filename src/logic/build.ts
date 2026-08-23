import { SpaceType, type GameState } from '../types/game';
import { MAX_HOUSES } from '../data/board';

export function canBuildOnCurrentSpace(state: GameState): boolean {
  const player = state.players[state.currentPlayer];
  if (!player) return false;
  const space = state.board[player.position];
  if (!space || space.type !== SpaceType.Property) return false;
  if (state.dice === null) return false;
  return (
    space.owner === state.currentPlayer &&
    space.houses < MAX_HOUSES &&
    !space.mortgaged &&
    space.id !== state.justBoughtSpaceId &&
    !state.builtThisStop
  );
}