import { motion } from 'motion/react';
import { CardBack } from './PlayingCard.tsx';

/** How long the deck riffles in the centre before cards fly to the seats. */
const SHUFFLE_MS = 1100;
/** How long the fly-out to the four seats takes, including its stagger. */
const DEAL_OUT_MS = 800;
/** When the player's own cards start dropping into the hand row. */
export const HAND_DEAL_START_MS = SHUFFLE_MS + 50;
/** Everything, including the last hand card landing (13 cards, 45 ms apart). */
export const SHUFFLE_DEAL_TOTAL_MS = HAND_DEAL_START_MS + 12 * 45 + 320 + 60;

const DECK_SIZE = 12;
const RIFFLE_SPREAD_PX = 44;
const RIFFLE_TILT_DEG = 9;
const TOTAL_S = (SHUFFLE_MS + DEAL_OUT_MS) / 1000;
const SHUFFLE_END = SHUFFLE_MS / (SHUFFLE_MS + DEAL_OUT_MS);
const FLIGHT = 0.2;

// Seat directions in dealing order: left, top, right, bottom (you).
const SEAT_VECTORS: ReadonlyArray<readonly [number, number]> = [
  [-1, 0],
  [0, -1],
  [1, 0],
  [0, 1],
];

/**
 * Decorative shuffle shown over the table when a new hand is dealt: the deck
 * splits and riffles twice, then cards fly out to the four seats.
 */
export function ShuffleDeal() {
  const reachX = Math.min(window.innerWidth * 0.4, 560);
  const reachY = window.innerHeight * 0.3;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.18 }}
        className="relative h-24 w-16 sm:h-28 sm:w-20"
      >
        {Array.from({ length: DECK_SIZE }, (_, i) => {
          const side = i % 2 === 0 ? -1 : 1;
          const [dx, dy] = SEAT_VECTORS[i % SEAT_VECTORS.length];
          const stackY = -i * 0.7;
          // Cards leave one after another, top of the deck first.
          const leaveAt =
            SHUFFLE_END + ((DECK_SIZE - 1 - i) / DECK_SIZE) * (1 - SHUFFLE_END - FLIGHT);
          const times = [0, 0.13, 0.27, 0.4, SHUFFLE_END - 0.04, leaveAt, leaveAt + FLIGHT];
          const spread = side * RIFFLE_SPREAD_PX;
          const tilt = side * RIFFLE_TILT_DEG;
          return (
            <motion.div
              key={i}
              className="absolute inset-0"
              style={{ zIndex: i }}
              initial={{ x: 0, y: stackY, rotate: 0, opacity: 1 }}
              animate={{
                x: [0, spread, 0, spread, 0, 0, dx * reachX],
                y: [stackY, stackY, stackY, stackY, stackY, stackY, dy * reachY],
                rotate: [0, tilt, 0, tilt, 0, 0, dx * 40 + dy * 8],
                opacity: [1, 1, 1, 1, 1, 1, 0],
              }}
              transition={{ duration: TOTAL_S, times, ease: 'easeInOut' }}
            >
              <CardBack className="w-full" />
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
