import { SeatIndex } from '../engine/types.ts';

export interface StandingSeat {
  seat: SeatIndex;
  displayName: string;
  playerType: 'human' | 'bot';
  totalScoreTenths: number;
}

export interface Standing extends StandingSeat {
  /** 1-based place. Players level on points share a place (1, 1, 3, 4). */
  rank: number;
}

/** Orders seats by total score, best first, and assigns shared places for ties. */
export function rankStandings(seats: readonly StandingSeat[]): Standing[] {
  const sorted = [...seats].sort(
    (a, b) => b.totalScoreTenths - a.totalScoreTenths || a.seat - b.seat
  );
  return sorted.map((entry) => ({
    seat: entry.seat,
    displayName: entry.displayName,
    playerType: entry.playerType,
    totalScoreTenths: entry.totalScoreTenths,
    rank:
      sorted.findIndex((other) => other.totalScoreTenths === entry.totalScoreTenths) + 1,
  }));
}

const ORDINAL_SUFFIXES: Record<number, string> = { 1: 'st', 2: 'nd', 3: 'rd' };

export function formatPlace(rank: number): string {
  return `${rank}${ORDINAL_SUFFIXES[rank] ?? 'th'}`;
}
