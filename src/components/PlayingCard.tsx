import React, { useEffect, useState } from 'react';
import { formatCardLabel, formatRank, SUIT_SYMBOLS } from '../engine/rules.ts';
import { Card, Rank, Suit } from '../engine/types.ts';
import { cn } from '../lib/utils.ts';

function toCardCode(rank: Rank, suit: Suit): string {
  const rankMap: Record<number, string> = {
    14: 'A',
    13: 'K',
    12: 'Q',
    11: 'J',
    10: '0',
  };
  const suitMap: Record<Suit, string> = {
    spades: 'S',
    hearts: 'H',
    diamonds: 'D',
    clubs: 'C',
  };
  return `${rankMap[rank] ?? String(rank)}${suitMap[suit]}`;
}

let deckPreloaded = false;
export function preloadDeckAssets(): void {
  if (deckPreloaded || typeof window === 'undefined') return;
  deckPreloaded = true;
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '0', 'J', 'Q', 'K', 'A'];
  const suits = ['S', 'H', 'D', 'C'];
  for (const s of suits) {
    for (const r of ranks) {
      const img = new Image();
      img.src = `/cards/${r}${s}.svg`;
    }
  }
  const feltImg = new Image();
  feltImg.src = '/src/assets/images/table_felt_surface_1794510216671.jpg';
}

interface PlayingCardProps {
  card: Card;
  playable?: boolean;
  dimmed?: boolean;
  selected?: boolean;
  compact?: boolean;
  winning?: boolean;
  hoverPop?: boolean;
  onPlayCardId?: (cardId: string) => void;
  title?: string;
  className?: string;
}

const PlayingCardInner: React.FC<PlayingCardProps> = ({
  card,
  playable = false,
  dimmed = false,
  selected = false,
  compact = false,
  winning = false,
  hoverPop = false,
  onPlayCardId,
  title,
  className,
}) => {
  const code = toCardCode(card.rank, card.suit);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [code]);

  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const rankLabel = formatRank(card.rank);
  const symbol = SUIT_SYMBOLS[card.suit];

  return (
    <button
      type="button"
      aria-disabled={!playable}
      onClick={() => {
        if (playable && onPlayCardId) {
          onPlayCardId(card.id);
        }
      }}
      title={title ?? formatCardLabel(card)}
      className={cn(
        'relative select-none aspect-[175/251] rounded-md overflow-visible bg-transparent transition-transform duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A5E1D2]',
        compact
          ? 'w-14 sm:w-18 md:w-20 shrink-0'
          : 'flex-1 min-w-0 max-w-[96px]',
        hoverPop && 'hover:-translate-y-4 hover:scale-[1.08] hover:z-40',
        playable
          ? 'cursor-pointer drop-shadow-[0_8px_16px_rgba(0,0,0,0.45)] hover:-translate-y-5 hover:scale-110 hover:z-40 hover:drop-shadow-[0_14px_24px_rgba(165,225,210,0.5)] active:translate-y-0 active:scale-95'
          : 'drop-shadow-[0_5px_12px_rgba(0,0,0,0.38)]',
        !playable && !onPlayCardId && !hoverPop && 'cursor-default',
        dimmed && !playable && 'brightness-65 saturate-75 cursor-not-allowed',
        selected && '-translate-y-3',
        className
      )}
    >
      <div
        className={cn(
          'h-full w-full rounded-md overflow-hidden bg-white border border-black/15',
          playable && 'ring-2 ring-[#A5E1D2] border-transparent',
          winning &&
            'ring-2 ring-[#28B482] border-transparent shadow-[0_0_24px_rgba(40,180,130,0.55)]'
        )}
      >
        {!imgError ? (
          <img
            key={code}
            src={`/cards/${code}.svg`}
            alt={formatCardLabel(card)}
            draggable={false}
            decoding="sync"
            loading="eager"
            onError={() => setImgError(true)}
            className="h-full w-full object-contain pointer-events-none block"
          />
        ) : (
          <div
            className={cn(
              'h-full w-full bg-[#FAF8F4] flex flex-col justify-between p-1.5 border border-black/15 rounded-lg',
              isRed ? 'text-[#C81E1E]' : 'text-[#111827]'
            )}
          >
            <div className="flex flex-col items-center leading-none w-fit">
              <span className="font-mono font-bold text-sm">{rankLabel}</span>
              <span className="text-xs">{symbol}</span>
            </div>
            <div className="text-center text-2xl leading-none">{symbol}</div>
            <div className="flex flex-col items-center leading-none w-fit self-end rotate-180">
              <span className="font-mono font-bold text-sm">{rankLabel}</span>
              <span className="text-xs">{symbol}</span>
            </div>
          </div>
        )}
      </div>
    </button>
  );
};

export const PlayingCard = React.memo(PlayingCardInner, (prev, next) => {
  return (
    prev.card.id === next.card.id &&
    prev.playable === next.playable &&
    prev.dimmed === next.dimmed &&
    prev.selected === next.selected &&
    prev.compact === next.compact &&
    prev.winning === next.winning &&
    prev.hoverPop === next.hoverPop &&
    prev.onPlayCardId === next.onPlayCardId &&
    prev.title === next.title &&
    prev.className === next.className
  );
});

PlayingCard.displayName = 'PlayingCard';

export const CardBack: React.FC<{ className?: string }> = React.memo(
  ({ className }) => {
    return (
      <div
        aria-hidden="true"
        className={cn(
          'relative aspect-[167/243] rounded-[4px] border border-white/80 bg-[#FAF8F4] p-[2px] shadow-md overflow-hidden select-none',
          className
        )}
      >
        <svg
          viewBox="0 0 100 146"
          className="h-full w-full rounded-[2px] block"
          preserveAspectRatio="none"
        >
          <defs>
            <pattern
              id="cb-dhaka-back"
              width="14"
              height="14"
              patternUnits="userSpaceOnUse"
            >
              <rect width="14" height="14" fill="#005A5A" />
              <path
                d="M7 1 L13 7 L7 13 L1 7 Z"
                fill="none"
                stroke="#A5E1D2"
                strokeWidth="1.2"
                strokeOpacity="0.7"
              />
              <circle cx="7" cy="7" r="1.4" fill="#FFFFFF" fillOpacity="0.75" />
            </pattern>
          </defs>
          <rect width="100" height="146" rx="4" fill="url(#cb-dhaka-back)" />
          <rect
            x="4"
            y="4"
            width="92"
            height="138"
            rx="3"
            fill="none"
            stroke="#A5E1D2"
            strokeWidth="2"
            strokeOpacity="0.85"
          />
        </svg>
      </div>
    );
  }
);

CardBack.displayName = 'CardBack';
