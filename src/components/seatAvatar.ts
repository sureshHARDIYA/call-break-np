import { SeatIndex } from '../engine/types.ts';

/** Fixed per-seat avatar colors, so a player keeps one color everywhere. */
export const AVATAR_TONES: Record<SeatIndex, string> = {
  0: 'from-[#007272] to-[#004E4E] text-white',
  1: 'from-[#1D4ED8] to-[#1E3A8A] text-white',
  2: 'from-[#0E7C56] to-[#065F46] text-white',
  3: 'from-[#B45309] to-[#78350F] text-white',
};

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}
