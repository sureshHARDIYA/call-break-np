import {
  Card,
  CompletedTrick,
  Rank,
  RoomSettings,
  SeatIndex,
  Suit,
  TrickCard,
} from './types.ts';

export const SUITS: readonly Suit[] = ['spades', 'hearts', 'clubs', 'diamonds'];
export const RANKS: readonly Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export const SUIT_SYMBOLS: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

export const SUIT_NAMES: Record<Suit, string> = {
  spades: 'Spades',
  hearts: 'Hearts',
  diamonds: 'Diamonds',
  clubs: 'Clubs',
};

export function formatRank(rank: Rank): string {
  switch (rank) {
    case 14:
      return 'A';
    case 13:
      return 'K';
    case 12:
      return 'Q';
    case 11:
      return 'J';
    default:
      return String(rank);
  }
}

export function formatCardLabel(card: Card): string {
  return `${formatRank(card.rank)}${SUIT_SYMBOLS[card.suit]}`;
}

export function nextSeat(seat: SeatIndex): SeatIndex {
  return ((seat + 1) % 4) as SeatIndex;
}

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        id: `${suit}-${rank}`,
        suit,
        rank,
      });
    }
  }
  return deck;
}

export function shuffleDeck(cards: Card[], rng: () => number = Math.random): Card[] {
  const copy = [...cards];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

export function sortHand(hand: Card[]): Card[] {
  const suitOrder: Record<Suit, number> = {
    spades: 0,
    hearts: 1,
    clubs: 2,
    diamonds: 3,
  };
  return [...hand].sort((a, b) => {
    if (suitOrder[a.suit] !== suitOrder[b.suit]) {
      return suitOrder[a.suit] - suitOrder[b.suit];
    }
    return b.rank - a.rank;
  });
}

export function dealHands(rng: () => number = Math.random): Record<SeatIndex, Card[]> {
  const shuffled = shuffleDeck(createDeck(), rng);
  return {
    0: sortHand(shuffled.slice(0, 13)),
    1: sortHand(shuffled.slice(13, 26)),
    2: sortHand(shuffled.slice(26, 39)),
    3: sortHand(shuffled.slice(39, 52)),
  };
}

export interface LegalMoveResult {
  legalCards: Card[];
  reason: string;
}

/**
 * Computes strictly legal cards for the active player according to traditional
 * Nepali Call Break rules and room configuration.
 */
export function getLegalMoves(
  hand: Card[],
  currentTrick: TrickCard[],
  settings: RoomSettings
): LegalMoveResult {
  if (hand.length === 0) {
    return { legalCards: [], reason: 'No cards remaining' };
  }

  // Leading the trick: any card in hand is legal
  if (currentTrick.length === 0) {
    return { legalCards: [...hand], reason: 'Lead any card to start the trick' };
  }

  const leadSuit = currentTrick[0].card.suit;
  const leadSuitCards = hand.filter((c) => c.suit === leadSuit);

  const spadesInTrick = currentTrick
    .filter((tc) => tc.card.suit === 'spades')
    .map((tc) => tc.card.rank);
  const highestSpadeInTrick =
    spadesInTrick.length > 0 ? Math.max(...spadesInTrick) : null;

  // Case 1: Player has cards of the leading suit
  if (leadSuitCards.length > 0) {
    // If lead suit is not spades and a spade has already trumped the trick,
    // player must still follow suit, but is NOT required to beat the spade (or highest lead card).
    if (leadSuit !== 'spades' && highestSpadeInTrick !== null) {
      return {
        legalCards: leadSuitCards,
        reason: `Must follow ${SUIT_NAMES[leadSuit]} (trick already trumped by ♠)`,
      };
    }

    if (settings.strictMustBeat) {
      const highestLeadRank = Math.max(
        ...currentTrick
          .filter((tc) => tc.card.suit === leadSuit)
          .map((tc) => tc.card.rank)
      );
      const beatingCards = leadSuitCards.filter((c) => c.rank > highestLeadRank);
      if (beatingCards.length > 0) {
        return {
          legalCards: beatingCards,
          reason: `Must follow ${SUIT_NAMES[leadSuit]} and beat ${formatRank(
            highestLeadRank as Rank
          )}${SUIT_SYMBOLS[leadSuit]}`,
        };
      }
    }

    return {
      legalCards: leadSuitCards,
      reason: `Must follow ${SUIT_NAMES[leadSuit]}`,
    };
  }

  // Case 2: Player is void in the leading suit
  const spadesInHand = hand.filter((c) => c.suit === 'spades');

  if (settings.strictMustTrump && spadesInHand.length > 0) {
    if (highestSpadeInTrick !== null) {
      const overtrumps = spadesInHand.filter((c) => c.rank > highestSpadeInTrick);
      if (overtrumps.length > 0) {
        return {
          legalCards: overtrumps,
          reason: `Must overtrump ${formatRank(highestSpadeInTrick as Rank)}♠`,
        };
      }
      // Unable to overtrump existing winning spade: player may discard any card
      return {
        legalCards: [...hand],
        reason: `Cannot beat ${formatRank(highestSpadeInTrick as Rank)}♠ — may discard any card`,
      };
    }

    // No spade played yet and player holds spades -> must trump with a spade
    return {
      legalCards: spadesInHand,
      reason: `Void in ${SUIT_NAMES[leadSuit]} — must trump with ♠ Spades`,
    };
  }

  // Case 3: Neither leading suit nor required trump available
  return {
    legalCards: [...hand],
    reason: `Void in ${SUIT_NAMES[leadSuit]} — play any card`,
  };
}

export function isCardLegal(
  hand: Card[],
  cardId: string,
  currentTrick: TrickCard[],
  settings: RoomSettings
): { legal: boolean; card?: Card; reason: string } {
  const card = hand.find((c) => c.id === cardId);
  if (!card) {
    return { legal: false, reason: 'Card is not in your hand' };
  }
  const { legalCards, reason } = getLegalMoves(hand, currentTrick, settings);
  const found = legalCards.some((c) => c.id === cardId);
  return {
    legal: found,
    card: found ? card : undefined,
    reason,
  };
}

export function determineTrickWinner(trick: TrickCard[]): SeatIndex {
  if (trick.length === 0) {
    throw new Error('Cannot determine winner of an empty trick');
  }
  const leadSuit = trick[0].card.suit;
  const spades = trick.filter((tc) => tc.card.suit === 'spades');

  if (spades.length > 0) {
    return spades.reduce((best, curr) =>
      curr.card.rank > best.card.rank ? curr : best
    ).seat;
  }

  const leadSuitPlays = trick.filter((tc) => tc.card.suit === leadSuit);
  return leadSuitPlays.reduce((best, curr) =>
    curr.card.rank > best.card.rank ? curr : best
  ).seat;
}

export function calculateRoundScoreTenths(bid: number, tricksWon: number): number {
  if (tricksWon >= bid) {
    return bid * 10 + (tricksWon - bid);
  }
  return -bid * 10;
}

export function formatScoreTenths(tenths: number): string {
  const sign = tenths > 0 ? '+' : tenths < 0 ? '-' : '';
  const abs = Math.abs(tenths);
  const whole = Math.floor(abs / 10);
  const dec = abs % 10;
  return `${sign}${whole}.${dec}`;
}

export function getWinnerSeats(
  scoresBySeat: Array<{ seat: SeatIndex; totalScoreTenths: number }>
): SeatIndex[] {
  if (scoresBySeat.length === 0) return [];
  const maxScore = Math.max(...scoresBySeat.map((s) => s.totalScoreTenths));
  return scoresBySeat
    .filter((s) => s.totalScoreTenths === maxScore)
    .map((s) => s.seat);
}

/**
 * Infers which suits each seat is publicly known to be void in,
 * strictly from completed tricks and the current trick.
 */
export function inferPublicVoidSuits(
  completedTricks: CompletedTrick[],
  currentTrick: TrickCard[]
): Record<SeatIndex, Set<Suit>> {
  const voids: Record<SeatIndex, Set<Suit>> = {
    0: new Set(),
    1: new Set(),
    2: new Set(),
    3: new Set(),
  };

  const inspectTrick = (cards: TrickCard[]) => {
    if (cards.length === 0) return;
    const leadSuit = cards[0].card.suit;
    for (let i = 1; i < cards.length; i++) {
      if (cards[i].card.suit !== leadSuit) {
        voids[cards[i].seat].add(leadSuit);
      }
    }
  };

  for (const t of completedTricks) {
    inspectTrick(t.cards);
  }
  inspectTrick(currentTrick);
  return voids;
}
