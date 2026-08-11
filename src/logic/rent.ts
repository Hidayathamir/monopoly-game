import { SpaceType, type Space, type Player } from '../types/game';

export function calculatePropertyRent(space: Space, dice?: [number, number]): number {
  if (!space.rent) return 0;

  if (space.type === SpaceType.Utility) {
    return calculateUtilityRent(space, dice);
  }

  if (space.type === SpaceType.Railroad) {
    return calculateRailroadRent(space);
  }

  const houseIndex = space.houses === 5 ? (space.rent?.length ?? 0) - 1 : space.houses;
  if (houseIndex >= (space.rent?.length ?? 0)) return space.rent?.[space.rent.length - 1] ?? 0;
  return space.rent?.[houseIndex] ?? 0;
}

function calculateRailroadRent(space: Space): number {
  const count = getRailroadCount(space);
  return space.rent?.[count - 1] ?? 25;
}

function calculateUtilityRent(space: Space, dice?: [number, number]): number {
  const total = (dice?.[0] ?? 0) + (dice?.[1] ?? 0);
  const count = getUtilityCount(space);
  return count === 2 ? total * 10 : total * 4;
}

export function getRailroadCount(space: Space): number {
  return (space as unknown as { _railroadCount: number })._railroadCount ?? 1;
}

export function setRailroadCount(space: Space, count: number): Space {
  return { ...space, _railroadCount: count } as Space;
}

function getUtilityCount(space: Space): number {
  return (space as unknown as { _utilityCount: number })._utilityCount ?? 1;
}

export function calculateRailroadRentFromBoard(ownerId: number, board: Space[], spaceId: number): number {
  const railroads = board.filter(
    (s) => s.type === SpaceType.Railroad && s.owner === ownerId
  );
  const count = railroads.length;
  const space = board[spaceId];
  return space.rent?.[count - 1] ?? 25;
}

export function calculateUtilityRentFromBoard(ownerId: number, board: Space[], _spaceId: number, dice: [number, number]): number {
  const utilities = board.filter(
    (s) => s.type === SpaceType.Utility && s.owner === ownerId
  );
  const count = utilities.length;
  const total = dice[0] + dice[1];
  return count === 2 ? total * 10 : total * 4;
}

export function getPlayerTotalAssets(player: Player, board: Space[]): number {
  let total = player.money;
  for (const pid of player.properties) {
    const space = board[pid];
    if (!space) continue;
    if (space.mortgaged) continue;
    total += (space.price ?? 0) / 2;
    if (space.type === SpaceType.Property || space.type === SpaceType.Railroad || space.type === SpaceType.Utility) {
      total += (space.houseCost ?? 0) * space.houses;
    }
  }
  return total;
}
