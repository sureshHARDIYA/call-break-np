import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  BookOpen,
  Bot,
  LogOut,
  MessageSquare,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { chooseBotBid } from '../engine/bots.ts';
import {
  determineTrickWinner,
  formatScoreTenths,
  SUIT_NAMES,
  SUIT_SYMBOLS,
} from '../engine/rules.ts';
import { Card, ChatMessage, SeatIndex } from '../engine/types.ts';
import { cn } from '../lib/utils.ts';
import { useGameStore } from '../store/gameStore.ts';
import { ChatPanel } from './ChatPanel.tsx';
import { CardBack, PlayingCard, preloadDeckAssets } from './PlayingCard.tsx';
import { RulesModal } from './RulesModal.tsx';
import { ScoreboardModal } from './ScoreboardModal.tsx';
import { Button } from './ui/button.tsx';

const EMPTY_CHAT: ChatMessage[] = [];

interface GameTableProps {
  onLeaveRoom: () => void;
}

type RelativePosition = 'bottom' | 'right' | 'top' | 'left';

function getSeatForPosition(
  pos: RelativePosition,
  mySeat: SeatIndex | null
): SeatIndex {
  const base = mySeat ?? 0;
  const offset =
    pos === 'bottom' ? 0 : pos === 'right' ? 1 : pos === 'top' ? 2 : 3;
  return ((base + offset) % 4) as SeatIndex;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

const AVATAR_TONES: Record<SeatIndex, string> = {
  0: 'from-[#007272] to-[#004E4E] text-white',
  1: 'from-[#1D4ED8] to-[#1E3A8A] text-white',
  2: 'from-[#0E7C56] to-[#065F46] text-white',
  3: 'from-[#B45309] to-[#78350F] text-white',
};

/* -------------------------------------------------------------------------- */
/* 1. Top HUD Bar (isolated Zustand selector)                                 */
/* -------------------------------------------------------------------------- */
const TopHudBar: React.FC<{
  onOpenScoreboard: () => void;
  onOpenRules: () => void;
  onLeaveRoom: () => void;
}> = React.memo(({ onOpenScoreboard, onOpenRules, onLeaveRoom }) => {
  const {
    roomCode,
    currentRound,
    totalRounds,
    trickNumber,
    unreadChatCount,
    chatOpen,
    muted,
  } = useGameStore(
    useShallow((s) => ({
      roomCode: s.room?.roomCode ?? '',
      currentRound: s.room?.currentRound ?? 1,
      totalRounds: s.room?.settings.rounds ?? 5,
      trickNumber: s.room?.trickNumber ?? 1,
      unreadChatCount: s.unreadChatCount,
      chatOpen: s.chatOpen,
      muted: s.muted,
    }))
  );

  return (
    <header className="relative z-20 flex h-13 sm:h-14 shrink-0 items-center justify-between gap-4 border-b border-[#D3DCDC] bg-white px-3 sm:px-6 text-[#1C2B2B]">
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-display text-lg sm:text-xl font-bold text-[#007272] whitespace-nowrap">
          Call Break
        </span>
        <span className="hidden sm:inline text-[#D3DCDC]" aria-hidden="true">
          |
        </span>
        <div className="hidden sm:flex items-center gap-2 text-sm text-[#4E5D5D] font-mono tabular-nums truncate">
          <span className="font-semibold text-[#1C2B2B]">{roomCode}</span>
          <span aria-hidden="true">·</span>
          <span>
            Round {currentRound}/{totalRounds}
          </span>
          <span aria-hidden="true">·</span>
          <span>Trick {trickNumber}/13</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <Button variant="ghost" size="sm" onClick={onOpenScoreboard}>
          <Trophy className="h-4 w-4 text-[#007272]" />
          <span className="hidden sm:inline">Scores</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={onOpenRules}>
          <BookOpen className="h-4 w-4 text-[#334343]" />
          <span className="hidden md:inline">Rules</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => useGameStore.getState().toggleMute()}
          aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
        >
          {muted ? (
            <VolumeX className="h-4 w-4 text-[#556767]" />
          ) : (
            <Volume2 className="h-4 w-4 text-[#007272]" />
          )}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => useGameStore.getState().setChatOpen(!chatOpen)}
          aria-label={
            unreadChatCount > 0
              ? `Open chat (${unreadChatCount} unread)`
              : 'Toggle chat'
          }
          className={cn(
            'relative overflow-visible',
            unreadChatCount > 0 && !chatOpen && 'border-[#007272] bg-[#E8F6F2]'
          )}
        >
          <span className="relative inline-flex items-center justify-center">
            <MessageSquare className="h-4 w-4 text-[#007272]" />
            {unreadChatCount > 0 && (
              <span className="sm:hidden absolute -top-2 -right-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#007272] px-1 font-mono text-[10px] font-bold leading-none text-white ring-2 ring-white tabular-nums">
                {unreadChatCount > 99 ? '99+' : unreadChatCount}
              </span>
            )}
          </span>
          <span className="hidden sm:inline">Chat</span>
          {unreadChatCount > 0 && (
            <span className="hidden sm:flex absolute -top-1.5 -right-1.5 h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#007272] px-1 font-mono text-[10px] font-bold leading-none text-white ring-2 ring-white tabular-nums shadow-sm">
              <span
                aria-hidden="true"
                className="absolute inset-0 rounded-full bg-[#007272] animate-ping opacity-45"
              />
              <span className="relative">
                {unreadChatCount > 99 ? '99+' : unreadChatCount}
              </span>
            </span>
          )}
        </Button>
        <Button variant="outline" size="sm" onClick={onLeaveRoom}>
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Leave</span>
        </Button>
      </div>
    </header>
  );
});
TopHudBar.displayName = 'TopHudBar';

/* -------------------------------------------------------------------------- */
/* 2. Seat Plate with Larger Side Avatar & Win/Loss Emoji Animation           */
/* -------------------------------------------------------------------------- */
const SeatPlate: React.FC<{
  pos: RelativePosition;
  showCardBackFan?: boolean;
}> = React.memo(({ pos, showCardBackFan = false }) => {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const info = useGameStore(
    useShallow((s) => {
      const room = s.room;
      if (!room) return null;
      const seatIndex = getSeatForPosition(pos, room.mySeat);
      const seat = room.seats[seatIndex];
      const isTrickWinner =
        room.phase === 'TRICK_COMPLETE' &&
        room.lastCompletedTrick?.winnerSeat === seatIndex;
      const trickHadTrumpCut =
        isTrickWinner &&
        room.lastCompletedTrick &&
        room.lastCompletedTrick.cards[0]?.card.suit !== 'spades' &&
        room.lastCompletedTrick.cards.some((tc) => tc.card.suit === 'spades');

      const latestRound =
        room.roundHistory.length > 0
          ? room.roundHistory[room.roundHistory.length - 1]
          : null;
      const roundRes =
        (room.phase === 'ROUND_COMPLETE' || room.phase === 'GAME_COMPLETE') &&
        latestRound
          ? latestRound.results.find((r) => r.seat === seatIndex)
          : null;

      let reactionKey: string | null = null;
      let reactionEmoji: string | null = null;
      let reactionLabel: string | null = null;
      let reactionIsWin = false;

      if (room.phase === 'GAME_COMPLETE') {
        const isMatchWinner = room.winnerSeats.includes(seatIndex);
        reactionKey = `${isMatchWinner ? 'match-win' : 'match-lose'}-${seatIndex}`;
        reactionEmoji = isMatchWinner ? '🏆' : '😅';
        reactionLabel = isMatchWinner ? 'Winner!' : 'Good game';
        reactionIsWin = isMatchWinner;
      } else if (roundRes) {
        const wonRound = roundRes.roundScoreTenths >= 0;
        reactionKey = `${wonRound ? 'round-win' : 'round-lose'}-${room.currentRound}-${seatIndex}`;
        reactionEmoji = wonRound ? '🥳' : '😢';
        reactionLabel = wonRound ? 'Bid made!' : 'Set!';
        reactionIsWin = wonRound;
      } else if (isTrickWinner && room.lastCompletedTrick) {
        reactionKey = `trick-${room.lastCompletedTrick.trickNumber}-${seatIndex}`;
        reactionEmoji = trickHadTrumpCut ? '⚡' : '🎉';
        reactionLabel = trickHadTrumpCut ? 'Trumped!' : 'Won trick!';
        reactionIsWin = true;
      }

      return {
        seatIndex,
        displayName: seat.displayName,
        playerType: seat.playerType,
        connected: seat.connected,
        bid: seat.bid,
        tricksWon: seat.tricksWon,
        totalScoreTenths: seat.totalScoreTenths,
        cardCount: seat.cardCount,
        isMe: seatIndex === room.mySeat,
        isActive: room.activeTurnSeat === seatIndex,
        isDealer: room.dealerSeat === seatIndex,
        isTrickWinner,
        phase: room.phase,
        turnDeadlineAt:
          room.activeTurnSeat === seatIndex ? room.turnDeadlineAt : null,
        reactionKey,
        reactionEmoji,
        reactionLabel,
        reactionIsWin,
      };
    })
  );

  useEffect(() => {
    if (!info?.turnDeadlineAt) {
      setSecondsLeft(null);
      return;
    }
    const deadline = info.turnDeadlineAt;
    const update = () => {
      setSecondsLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    };
    update();
    const id = setInterval(update, 500);
    return () => clearInterval(id);
  }, [info?.turnDeadlineAt]);

  if (!info) return null;

  const isSideSeat = pos === 'left' || pos === 'right';

  return (
    <div
      className={cn(
        'flex flex-col gap-1',
        pos === 'top' && 'items-center',
        pos === 'left' && 'items-start',
        pos === 'right' && 'items-end',
        pos === 'bottom' && 'items-center'
      )}
    >
      <div
        className={cn(
          'relative flex items-center gap-3 rounded-xl border px-3 py-2 shadow-md transition-colors duration-150',
          info.isTrickWinner
            ? 'border-[#28B482] bg-[#E8F6F2] ring-2 ring-[#28B482]/60 shadow-[0_6px_22px_rgba(40,180,130,0.3)]'
            : info.isActive
            ? 'border-[#007272] bg-white ring-2 ring-[#A5E1D2] shadow-[0_6px_22px_rgba(0,0,0,0.22)]'
            : 'border-[#D3DCDC] bg-white/96',
          isSideSeat ? 'min-w-[168px] sm:min-w-[205px]' : 'min-w-[215px] sm:min-w-[248px]'
        )}
      >
        {/* Floating Win / Loss Emoji Burst Animation */}
        <AnimatePresence>
          {info.reactionKey && info.reactionEmoji && info.reactionLabel && (
            <motion.div
              key={info.reactionKey}
              initial={{ opacity: 0, y: 10, scale: 0.4, rotate: -14 }}
              animate={{
                opacity: 1,
                y: -26,
                scale: [0.6, 1.25, 1.05],
                rotate: [0, -8, 8, 0],
              }}
              exit={{ opacity: 0, y: -42, scale: 0.7 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                'pointer-events-none absolute -top-2 left-3 z-30 flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-semibold shadow-md border bg-white',
                info.reactionIsWin
                  ? 'border-[#28B482] text-[#0E7C56]'
                  : 'border-[#C81E1E] text-[#C81E1E]'
              )}
            >
              <span className="text-base leading-none">
                {info.reactionEmoji}
              </span>
              <span className="text-[11px] leading-none">
                {info.reactionLabel}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Larger Circular Avatar on the Side */}
        <div className="relative shrink-0">
          <div
            className={cn(
              'h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-gradient-to-br flex items-center justify-center font-display font-bold text-base sm:text-lg shadow-sm ring-2',
              AVATAR_TONES[info.seatIndex],
              info.isActive
                ? 'ring-[#007272]'
                : info.isTrickWinner
                ? 'ring-[#28B482]'
                : 'ring-[#D3DCDC]'
            )}
          >
            {info.playerType === 'bot' ? (
              <Bot className="h-6 w-6 sm:h-7 sm:w-7" />
            ) : (
              getInitials(info.displayName)
            )}
          </div>
          {info.isDealer && (
            <span
              title="Dealer"
              className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-[#007272] text-white font-mono text-[10px] font-bold flex items-center justify-center ring-2 ring-white"
            >
              D
            </span>
          )}
        </div>

        {/* Player Metadata & Score */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1.5">
            <span className="font-semibold text-xs sm:text-sm text-[#1C2B2B] truncate">
              {info.displayName}
              {info.isMe ? ' (You)' : ''}
            </span>
            {!info.connected && info.playerType === 'human' && (
              <span className="text-[10px] font-semibold text-[#C81E1E] shrink-0">
                Offline
              </span>
            )}
          </div>

          <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-[#556767] font-mono tabular-nums">
            <span>
              Bid:{' '}
              <strong className="text-[#1C2B2B]">
                {info.bid !== null ? info.bid : '—'}
              </strong>
              <span className="mx-1 text-[#D3DCDC]">·</span>
              Won: <strong className="text-[#0E7C56]">{info.tricksWon}</strong>
            </span>
            <span className="text-[#1C2B2B] font-bold">
              {formatScoreTenths(info.totalScoreTenths)}
            </span>
          </div>

          <div className="mt-0.5 h-4 flex items-center justify-between text-[11px]">
            {info.isActive ? (
              <>
                <span className="text-[#007272] font-semibold">
                  {info.phase === 'BIDDING' ? 'Bidding…' : 'Playing…'}
                </span>
                {secondsLeft !== null && (
                  <span className="font-mono font-semibold text-[#007272] tabular-nums">
                    {secondsLeft}s
                  </span>
                )}
              </>
            ) : (
              <span className="text-[#556767]">
                {info.playerType === 'bot' ? 'AI Player' : 'Seated'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Opponent Card Count Fan */}
      {showCardBackFan && info.cardCount > 0 && (
        <div
          className={cn(
            'flex items-center -space-x-2.5 h-6',
            pos === 'left' && 'pl-3 hidden sm:flex',
            pos === 'right' && 'pr-3 hidden sm:flex'
          )}
        >
          {Array.from({ length: Math.min(7, info.cardCount) }).map((_, idx) => (
            <CardBack key={idx} className="w-4.5" />
          ))}
        </div>
      )}
    </div>
  );
});
SeatPlate.displayName = 'SeatPlate';

/* -------------------------------------------------------------------------- */
/* 3. Isolated Trick Card Slot (only re-renders its own seat card!)           */
/* -------------------------------------------------------------------------- */
const TrickSlot: React.FC<{
  pos: RelativePosition;
  positionClassName: string;
}> = React.memo(({ pos, positionClassName }) => {
  const slot = useGameStore(
    useShallow((s) => {
      const room = s.room;
      if (!room || room.currentTrick.length === 0) {
        return {
          cardId: null as string | null,
          card: null as Card | null,
          trickNumber: room?.trickNumber ?? 0,
          isWinning: false,
        };
      }
      const seatIndex = getSeatForPosition(pos, room.mySeat);
      const tc = room.currentTrick.find((c) => c.seat === seatIndex) ?? null;
      const winningSeat = determineTrickWinner(room.currentTrick);
      return {
        cardId: tc?.card.id ?? null,
        card: tc?.card ?? null,
        trickNumber: room.trickNumber,
        isWinning: tc !== null && winningSeat === seatIndex,
      };
    })
  );

  if (!slot.card || !slot.cardId) return null;

  return (
    <motion.div
      key={`trick-${slot.trickNumber}-${slot.cardId}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
      className={positionClassName}
    >
      <PlayingCard card={slot.card} compact winning={slot.isWinning} />
    </motion.div>
  );
});
TrickSlot.displayName = 'TrickSlot';

/* -------------------------------------------------------------------------- */
/* 4. Center Bidding & Trick Arena                                            */
/* -------------------------------------------------------------------------- */
const CenterArena: React.FC = React.memo(() => {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const centerState = useGameStore(
    useShallow((s) => {
      const room = s.room;
      if (!room) return null;
      const isMyTurnToBid =
        room.phase === 'BIDDING' &&
        room.mySeat !== null &&
        room.activeTurnSeat === room.mySeat;
      const leadSuit = room.currentTrick[0]?.card.suit ?? null;
      const activeName =
        room.activeTurnSeat !== null
          ? room.seats[room.activeTurnSeat].displayName
          : null;
      const winnerName =
        room.phase === 'TRICK_COMPLETE' && room.lastCompletedTrick
          ? room.seats[room.lastCompletedTrick.winnerSeat].displayName
          : null;
      const lastTrickNum = room.lastCompletedTrick?.trickNumber ?? null;

      const suggestedBid =
        isMyTurnToBid && room.mySeat !== null
          ? chooseBotBid({
              seat: room.mySeat,
              hand: room.myHand,
              difficulty: 'hard',
              settings: room.settings,
              dealerSeat: room.dealerSeat,
              bids: {
                0: room.seats[0].bid,
                1: room.seats[1].bid,
                2: room.seats[2].bid,
                3: room.seats[3].bid,
              },
              tricksWon: { 0: 0, 1: 0, 2: 0, 3: 0 },
              completedTricks: [],
              currentTrick: [],
              seatCardCounts: { 0: 13, 1: 13, 2: 13, 3: 13 },
            })
          : null;

      return {
        phase: room.phase,
        isMyTurnToBid,
        maxBid: room.settings.maxBid,
        turnDeadlineAt: room.turnDeadlineAt,
        leadSuit,
        activeName,
        winnerName,
        lastTrickNum,
        suggestedBid,
      };
    })
  );

  useEffect(() => {
    if (!centerState?.turnDeadlineAt || !centerState.isMyTurnToBid) {
      setSecondsLeft(null);
      return;
    }
    const deadline = centerState.turnDeadlineAt;
    const update = () => {
      setSecondsLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    };
    update();
    const id = setInterval(update, 500);
    return () => clearInterval(id);
  }, [centerState?.turnDeadlineAt, centerState?.isMyTurnToBid]);

  const bidRange = useMemo(
    () =>
      Array.from({ length: centerState?.maxBid ?? 8 }, (_, i) => i + 1),
    [centerState?.maxBid]
  );

  if (!centerState) return null;

  if (centerState.isMyTurnToBid) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.16 }}
        className="w-full max-w-md rounded-xl border border-[#D3DCDC] bg-white p-4 sm:p-5 text-[#1C2B2B] shadow-2xl"
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-display text-base sm:text-lg font-semibold text-[#1C2B2B]">
              Place Your Bid
            </h2>
            <p className="text-xs sm:text-sm text-[#4E5D5D]">
              Suggested bid: <strong className="text-[#007272] font-mono">{centerState.suggestedBid}</strong> · ♠ is trump
            </p>
          </div>
          {secondsLeft !== null && (
            <span className="font-mono text-sm font-semibold text-[#007272] tabular-nums">
              {secondsLeft}s
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
          {bidRange.map((num) => {
            const isSuggested = centerState.suggestedBid === num;
            return (
              <button
                key={num}
                type="button"
                onClick={() => useGameStore.getState().submitBid(num)}
                title={isSuggested ? `Suggested bid: ${num}` : undefined}
                className={cn(
                  'h-10 min-w-[44px] px-3 rounded-lg border font-mono text-sm sm:text-base font-bold transition-colors cursor-pointer',
                  isSuggested
                    ? 'border-[#007272] bg-[#007272] text-white ring-2 ring-[#A5E1D2] hover:bg-[#005A5A]'
                    : 'border-[#D3DCDC] bg-[#F2F4EC] text-[#1C2B2B] hover:bg-[#007272] hover:text-white hover:border-[#007272]'
                )}
              >
                {num}
              </button>
            );
          })}
        </div>
      </motion.div>
    );
  }

  return (
    <>
      <div className="mb-1.5 text-center text-xs sm:text-sm text-[#E8F6F2]">
        {centerState.phase === 'TRICK_COMPLETE' && centerState.winnerName ? (
          <span className="font-semibold text-[#A5E1D2]">
            {centerState.winnerName} won Trick {centerState.lastTrickNum}
          </span>
        ) : centerState.leadSuit ? (
          <span>
            Lead suit:{' '}
            <strong className="text-white">
              {SUIT_SYMBOLS[centerState.leadSuit]}{' '}
              {SUIT_NAMES[centerState.leadSuit]}
            </strong>
          </span>
        ) : (
          <span>
            {centerState.phase === 'BIDDING'
              ? 'Bidding Phase · Trump is ♠ Spades'
              : centerState.activeName
              ? `${centerState.activeName} to lead`
              : 'Preparing trick…'}
          </span>
        )}
      </div>

      <div className="relative h-48 w-52 sm:h-52 sm:w-64 md:h-56 md:w-72 flex items-center justify-center">
        <TrickSlot
          pos="top"
          positionClassName="absolute top-0 left-1/2 -translate-x-1/2"
        />
        <TrickSlot
          pos="left"
          positionClassName="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2"
        />
        <TrickSlot
          pos="right"
          positionClassName="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2"
        />
        <TrickSlot
          pos="bottom"
          positionClassName="absolute bottom-0 left-1/2 -translate-x-1/2 z-10"
        />
      </div>
    </>
  );
});
CenterArena.displayName = 'CenterArena';

/* -------------------------------------------------------------------------- */
/* 5. Player Hand & Turn Prompt (Zustand-isolated so opponent plays don't     */
/*    re-render your cards!)                                                  */
/* -------------------------------------------------------------------------- */
const PlayerHandBar: React.FC = React.memo(() => {
  const handIdsKey = useGameStore((s) =>
    s.room ? s.room.myHand.map((c) => c.id).join(',') : ''
  );
  const legalKey = useGameStore((s) =>
    s.room ? s.room.legalCardIds.join(',') : ''
  );

  const meta = useGameStore(
    useShallow((s) => {
      const room = s.room;
      if (!room) return null;
      const isMyTurnToPlay =
        room.phase === 'PLAYING' &&
        room.mySeat !== null &&
        room.activeTurnSeat === room.mySeat;
      const isMyTurnToBid =
        room.phase === 'BIDDING' &&
        room.mySeat !== null &&
        room.activeTurnSeat === room.mySeat;
      const activeName =
        room.activeTurnSeat !== null
          ? room.seats[room.activeTurnSeat].displayName
          : null;
      return {
        currentRound: room.currentRound,
        rounds: room.settings.rounds,
        isMyTurnToPlay,
        isMyTurnToBid,
        legalReason: room.legalReason,
        activeName,
      };
    })
  );

  // Read myHand directly from store only when handIdsKey changes!
  const stableHand = useMemo(() => {
    const hand = useGameStore.getState().room?.myHand ?? [];
    return hand;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handIdsKey]);

  const legalSet = useMemo(
    () => new Set(legalKey ? legalKey.split(',') : []),
    [legalKey]
  );

  const playCardStable = useGameStore((s) => s.playCard);

  if (!meta) return null;

  return (
    <div className="relative z-20 shrink-0 w-full flex flex-col items-center pb-2.5 sm:pb-3.5 px-2 sm:px-6">
      <div className="mb-1.5 flex flex-wrap items-center justify-center gap-3">
        <SeatPlate pos="bottom" />
        <div className="rounded-lg border border-[#D3DCDC] bg-white/95 px-3.5 py-1.5 text-xs sm:text-sm text-[#334343] shadow-sm">
          {meta.isMyTurnToPlay ? (
            <span className="font-semibold text-[#007272]">
              Your Turn · {meta.legalReason ?? 'Select a highlighted card'}
            </span>
          ) : meta.isMyTurnToBid ? (
            <span className="font-semibold text-[#007272]">
              Your Turn · Choose your bid in the center
            </span>
          ) : meta.activeName ? (
            <span>
              Waiting for <strong className="text-[#1C2B2B]">{meta.activeName}</strong>…
            </span>
          ) : (
            <span>
              Round {meta.currentRound} of {meta.rounds}
            </span>
          )}
        </div>
      </div>

      {/* Full-Width Responsive 13-Card Hand Row */}
      <div className="w-full pt-5 pb-1 px-1 sm:px-4">
        <div className="w-full flex items-end justify-center -space-x-4 sm:-space-x-2 md:space-x-1 lg:space-x-2">
          {stableHand.map((card) => {
            const canPlay = meta.isMyTurnToPlay && legalSet.has(card.id);
            return (
              <PlayingCard
                key={`round-${meta.currentRound}-${card.id}`}
                card={card}
                playable={canPlay}
                dimmed={meta.isMyTurnToPlay && !canPlay}
                hoverPop
                onPlayCardId={canPlay ? playCardStable : undefined}
                title={
                  meta.isMyTurnToPlay && !canPlay
                    ? meta.legalReason ?? 'Not legal for this trick'
                    : undefined
                }
              />
            );
          })}
        </div>
      </div>
    </div>
  );
});
PlayerHandBar.displayName = 'PlayerHandBar';

/* -------------------------------------------------------------------------- */
/* 6. Isolated Chat Sidebar                                                   */
/* -------------------------------------------------------------------------- */
const ChatDrawer: React.FC = React.memo(() => {
  const { chatOpen, messages, mySeat, typingUsers } = useGameStore(
    useShallow((s) => ({
      chatOpen: s.chatOpen,
      messages: s.room?.chat ?? EMPTY_CHAT,
      mySeat: s.room?.mySeat ?? null,
      typingUsers: s.typingUsers,
    }))
  );

  return (
    <AnimatePresence>
      {chatOpen && (
        <motion.aside
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-y-13 sm:inset-y-14 right-0 z-30 w-full max-w-sm lg:static lg:inset-auto lg:w-88 border-l border-[#D3DCDC] bg-[#F2F4EC] p-2.5 flex flex-col"
        >
          <ChatPanel
            messages={messages}
            mySeat={mySeat}
            typingUsers={typingUsers}
            onSendMessage={(text) => useGameStore.getState().sendChat(text)}
            onTyping={(isTyping) => useGameStore.getState().sendTyping(isTyping)}
            onClose={() => useGameStore.getState().setChatOpen(false)}
            className="flex-1 h-full"
          />
        </motion.aside>
      )}
    </AnimatePresence>
  );
});
ChatDrawer.displayName = 'ChatDrawer';

/* -------------------------------------------------------------------------- */
/* 7. Root GameTable Shell                                                    */
/* -------------------------------------------------------------------------- */
export const GameTable: React.FC<GameTableProps> = ({ onLeaveRoom }) => {
  const [scoreboardOpen, setScoreboardOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [feltImageLoaded, setFeltImageLoaded] = useState(false);
  const [feltImageError, setFeltImageError] = useState(false);

  const { phase, currentRound, room } = useGameStore(
    useShallow((s) => ({
      phase: s.room?.phase ?? 'LOBBY',
      currentRound: s.room?.currentRound ?? 0,
      room: s.room,
    }))
  );

  useEffect(() => {
    preloadDeckAssets();
  }, []);

  useEffect(() => {
    if (phase === 'ROUND_COMPLETE' || phase === 'GAME_COMPLETE') {
      setScoreboardOpen(true);
    } else if (phase === 'BIDDING') {
      setScoreboardOpen(false);
    }
  }, [phase, currentRound]);

  if (!room) return null;

  return (
    <div className="relative h-dvh w-screen overflow-hidden bg-[#003838] text-[#1C2B2B] flex flex-col">
      <TopHudBar
        onOpenScoreboard={() => setScoreboardOpen(true)}
        onOpenRules={() => setRulesOpen(true)}
        onLeaveRoom={onLeaveRoom}
      />

      <div className="relative flex-1 min-h-0 flex overflow-hidden">
        {/* Sea-Green Felt Card Table Canvas */}
        <div className="relative flex-1 min-h-0 flex flex-col justify-between overflow-hidden bg-[radial-gradient(ellipse_at_center,#006666_0%,#004B4B_58%,#003131_100%)]">
          {!feltImageError && (
            <img
              src="/src/assets/images/table_felt_surface_1794510216671.jpg"
              alt="Emerald felt card table"
              referrerPolicy="no-referrer"
              onLoad={() => setFeltImageLoaded(true)}
              onError={() => setFeltImageError(true)}
              className={cn(
                'pointer-events-none absolute inset-0 h-full w-full object-cover mix-blend-soft-light transition-opacity duration-300',
                feltImageLoaded ? 'opacity-70' : 'opacity-0'
              )}
            />
          )}

          {/* Top Opponent Seat */}
          <div className="relative z-10 shrink-0 flex flex-col items-center pt-2 px-4">
            <SeatPlate pos="top" showCardBackFan />
          </div>

          {/* Middle Row: Left Seat | Center Trick / Bidding Arena | Right Seat */}
          <div className="relative z-10 flex-1 min-h-0 grid grid-cols-12 items-center px-2 sm:px-6 gap-1">
            <div className="col-span-3 flex flex-col items-start justify-center">
              <SeatPlate pos="left" showCardBackFan />
            </div>

            <div className="col-span-6 flex flex-col items-center justify-center min-h-0">
              <CenterArena />
            </div>

            <div className="col-span-3 flex flex-col items-end justify-center">
              <SeatPlate pos="right" showCardBackFan />
            </div>
          </div>

          {/* Bottom Hand & Player Seat */}
          <PlayerHandBar />
        </div>

        <ChatDrawer />
      </div>

      <ScoreboardModal
        open={scoreboardOpen}
        onOpenChange={setScoreboardOpen}
        room={room}
        onNextRound={() => {
          setScoreboardOpen(false);
          useGameStore.getState().nextRound();
        }}
        onRestartGame={() => {
          setScoreboardOpen(false);
          useGameStore.getState().restartGame();
        }}
      />

      <RulesModal open={rulesOpen} onOpenChange={setRulesOpen} />
    </div>
  );
};
