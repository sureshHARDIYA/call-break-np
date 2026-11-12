import React, { useMemo } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Bot, Crown, ListOrdered, LogOut, RotateCcw } from 'lucide-react';
import { formatScoreTenths } from '../engine/rules.ts';
import { ClientRoomView } from '../engine/types.ts';
import { formatPlace, rankStandings, Standing } from '../lib/standings.ts';
import { cn } from '../lib/utils.ts';
import { AVATAR_TONES, getInitials } from './seatAvatar.ts';
import { Button } from './ui/button.tsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog.tsx';

interface MatchResultsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room: ClientRoomView;
  onPlayAgain: () => void;
  onShowRoundScores: () => void;
  onLeaveRoom: () => void;
}

const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Podium look per place. Medal colors are fixed so they read in both themes. */
const PODIUM_STYLES: Record<number, { bar: string; height: string; medal: string }> = {
  1: {
    bar: 'from-[#F7CF52] to-[#C28A0A]',
    height: 'h-28 sm:h-36',
    medal: 'bg-[#F7CF52] text-[#3D2A00]',
  },
  2: {
    bar: 'from-[#DCE2E8] to-[#8D99A5]',
    height: 'h-20 sm:h-26',
    medal: 'bg-[#DCE2E8] text-[#27313A]',
  },
  3: {
    bar: 'from-[#E5AB78] to-[#A15F27]',
    height: 'h-14 sm:h-18',
    medal: 'bg-[#E5AB78] text-[#3B1F08]',
  },
};

/** Reveal order builds suspense: 3rd place first, the winner last. */
const REVEAL_DELAY_BY_SLOT = [0.5, 0.95, 0.15];

const CONFETTI_COLORS = ['#F7CF52', '#28B482', '#5AD4C4', '#F98080', '#8FB4FF', '#FFFFFF'];
const CONFETTI_PIECES = 26;

const Confetti: React.FC = () => {
  const pieces = useMemo(
    () =>
      Array.from({ length: CONFETTI_PIECES }, (_, i) => ({
        id: i,
        // Deterministic spread so the burst looks the same on every render.
        left: `${(i * 37) % 100}%`,
        delay: 0.9 + ((i * 13) % 10) / 10,
        duration: 2.4 + ((i * 7) % 12) / 8,
        rotate: (i % 2 === 0 ? 1 : -1) * (240 + ((i * 53) % 240)),
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        wide: i % 3 === 0,
      })),
    []
  );

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl"
    >
      {pieces.map((piece) => (
        <motion.span
          key={piece.id}
          className={cn('absolute top-0 block rounded-[2px]', piece.wide ? 'h-1.5 w-3' : 'h-2.5 w-1.5')}
          style={{ left: piece.left, backgroundColor: piece.color }}
          initial={{ y: -20, opacity: 0, rotate: 0 }}
          animate={{ y: 520, opacity: [0, 1, 1, 0], rotate: piece.rotate }}
          transition={{
            duration: piece.duration,
            delay: piece.delay,
            ease: 'easeIn',
            repeat: 1,
            repeatDelay: 0.4,
          }}
        />
      ))}
    </div>
  );
};

const PlayerAvatar: React.FC<{ standing: Standing; className?: string }> = ({
  standing,
  className,
}) => (
  <div
    className={cn(
      'flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-display font-bold shadow-sm',
      AVATAR_TONES[standing.seat],
      className
    )}
  >
    {standing.playerType === 'bot' ? (
      <Bot className="h-1/2 w-1/2" />
    ) : (
      getInitials(standing.displayName)
    )}
  </div>
);

const PodiumColumn: React.FC<{
  standing: Standing;
  isMe: boolean;
  revealDelay: number;
  animate: boolean;
}> = ({ standing, isMe, revealDelay, animate }) => {
  const style = PODIUM_STYLES[Math.min(standing.rank, 3)];
  const isChampion = standing.rank === 1;

  return (
    <div className="flex min-w-0 flex-1 flex-col items-center justify-end">
      <motion.div
        className="flex w-full min-w-0 flex-col items-center px-1 pb-2 text-center"
        initial={animate ? { opacity: 0, y: 14 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: revealDelay + 0.3, ease: EASE_OUT_EXPO }}
      >
        <div className="relative">
          {isChampion && (
            <motion.span
              className="absolute -top-5 left-1/2 text-[#E0A50C]"
              initial={animate ? { opacity: 0, y: -10, x: '-50%', rotate: -18 } : { x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%', rotate: 0 }}
              transition={{ duration: 0.5, delay: revealDelay + 0.6, ease: EASE_OUT_EXPO }}
            >
              <Crown className="h-6 w-6 fill-current" />
            </motion.span>
          )}
          <PlayerAvatar
            standing={standing}
            className={cn(
              'ring-2 ring-surface',
              isChampion ? 'h-16 w-16 text-xl sm:h-20 sm:w-20 sm:text-2xl' : 'h-12 w-12 text-base sm:h-14 sm:w-14'
            )}
          />
        </div>
        <div className="mt-1.5 w-full truncate text-sm font-semibold text-ink sm:text-base">
          {standing.displayName}
        </div>
        {isMe && <div className="text-[11px] font-semibold text-brand-ink">You</div>}
        <div
          className={cn(
            'font-mono text-base font-bold tabular-nums sm:text-lg',
            standing.totalScoreTenths > 0
              ? 'text-positive'
              : standing.totalScoreTenths < 0
              ? 'text-danger-ink'
              : 'text-ink'
          )}
        >
          {formatScoreTenths(standing.totalScoreTenths)}
        </div>
      </motion.div>

      <motion.div
        className={cn(
          'flex w-full origin-bottom items-start justify-center rounded-t-lg bg-gradient-to-b pt-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]',
          style.bar,
          style.height
        )}
        initial={animate ? { scaleY: 0 } : false}
        animate={{ scaleY: 1 }}
        transition={{ duration: 0.6, delay: revealDelay, ease: EASE_OUT_EXPO }}
      >
        <span className="font-display text-2xl font-bold text-black/70 sm:text-3xl">
          {standing.rank}
        </span>
      </motion.div>
    </div>
  );
};

export const MatchResultsModal: React.FC<MatchResultsModalProps> = ({
  open,
  onOpenChange,
  room,
  onPlayAgain,
  onShowRoundScores,
  onLeaveRoom,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const animate = !prefersReducedMotion;

  const standings = useMemo(() => rankStandings(room.seats), [room.seats]);
  // Podium reads 2nd · 1st · 3rd from left to right.
  const podiumSlots = [standings[1], standings[0], standings[2]];
  const runnerUps = standings.slice(3);

  const champions = standings.filter((s) => s.rank === 1);
  const myStanding = standings.find((s) => s.seat === room.mySeat) ?? null;
  const isHost = room.mySeat !== null && room.seats[room.mySeat].isHost;
  const iWon = myStanding?.rank === 1;

  const headline =
    champions.length > 1
      ? `${champions.map((c) => c.displayName).join(' & ')} share the win`
      : iWon
      ? 'You won the match!'
      : `${champions[0].displayName} wins the match`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        {animate && open && <Confetti />}

        <DialogHeader className="relative items-center text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-ink">
            Final results · {room.settings.rounds}{' '}
            {room.settings.rounds === 1 ? 'round' : 'rounds'}
          </span>
          <DialogTitle className="text-center text-2xl sm:text-3xl">{headline}</DialogTitle>
          <DialogDescription className="text-center text-sm sm:text-base">
            {myStanding && !iWon
              ? `You finished ${formatPlace(myStanding.rank)} with ${formatScoreTenths(
                  myStanding.totalScoreTenths
                )} points.`
              : 'Total points across every round.'}
          </DialogDescription>
        </DialogHeader>

        {/* Podium */}
        <div className="relative flex items-end gap-2 px-1 pt-6 sm:gap-3 sm:px-6">
          {podiumSlots.map((standing, slot) => (
            <PodiumColumn
              key={standing.seat}
              standing={standing}
              isMe={standing.seat === room.mySeat}
              revealDelay={REVEAL_DELAY_BY_SLOT[slot]}
              animate={animate}
            />
          ))}
        </div>

        {/* Everyone off the podium */}
        {runnerUps.map((standing) => (
          <motion.div
            key={standing.seat}
            className="relative flex items-center gap-3 rounded-lg border border-line bg-surface-muted px-3.5 py-2.5"
            initial={animate ? { opacity: 0, y: 8 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 1.5, ease: EASE_OUT_EXPO }}
          >
            <span className="w-8 font-mono text-sm font-bold text-ink-muted">
              {formatPlace(standing.rank)}
            </span>
            <PlayerAvatar standing={standing} className="h-9 w-9 text-sm" />
            <span className="min-w-0 flex-1 truncate font-semibold text-ink">
              {standing.displayName}
              {standing.seat === room.mySeat ? ' (You)' : ''}
            </span>
            <span
              className={cn(
                'font-mono font-bold tabular-nums',
                standing.totalScoreTenths < 0 ? 'text-danger-ink' : 'text-ink'
              )}
            >
              {formatScoreTenths(standing.totalScoreTenths)}
            </span>
          </motion.div>
        ))}

        {/* Actions */}
        <div className="relative flex flex-col gap-2.5 pt-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onShowRoundScores}>
              <ListOrdered className="h-4 w-4" />
              Round scores
            </Button>
            <Button variant="ghost" size="sm" onClick={onLeaveRoom}>
              <LogOut className="h-4 w-4" />
              Leave
            </Button>
          </div>
          {isHost ? (
            <Button size="lg" onClick={onPlayAgain}>
              <RotateCcw className="h-4 w-4" />
              Play again
            </Button>
          ) : (
            <span className="text-sm text-ink-muted">
              Waiting for the host to start a new match…
            </span>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
