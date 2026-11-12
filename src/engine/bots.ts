import {
  createDeck,
  determineTrickWinner,
  getLegalMoves,
  inferPublicVoidSuits,
  nextSeat,
  shuffleDeck,
} from './rules.ts';
import {
  BotDifficulty,
  Card,
  CompletedTrick,
  RoomSettings,
  SeatIndex,
  Suit,
  TrickCard,
} from './types.ts';

export interface BotPublicContext {
  seat: SeatIndex;
  hand: Card[];
  difficulty: BotDifficulty;
  settings: RoomSettings;
  dealerSeat: SeatIndex;
  bids: Record<SeatIndex, number | null>;
  tricksWon: Record<SeatIndex, number>;
  completedTricks: CompletedTrick[];
  currentTrick: TrickCard[];
  seatCardCounts: Record<SeatIndex, number>;
}

/**
 * Evaluates a bot's opening bid using ONLY its own 13 cards,
 * seat position, and room settings (never peeking at opponents' hands).
 */
export function chooseBotBid(ctx: BotPublicContext): number {
  const { hand, difficulty, settings, bids } = ctx;
  const maxBid = settings.maxBid;

  if (difficulty === 'easy') {
    let est = 0;
    for (const c of hand) {
      if (c.rank === 14) est += 0.9;
      else if (c.rank === 13) est += 0.6;
      else if (c.suit === 'spades' && c.rank >= 9) est += 0.5;
    }
    const jitter = Math.random() * 1.2 - 0.4;
    return Math.max(1, Math.min(maxBid, Math.round(est + jitter)));
  }

  // Medium & Hard heuristic valuation
  const bySuit: Record<Suit, Card[]> = {
    spades: [],
    hearts: [],
    diamonds: [],
    clubs: [],
  };
  for (const c of hand) {
    bySuit[c.suit].push(c);
  }
  for (const s of Object.keys(bySuit) as Suit[]) {
    bySuit[s].sort((a, b) => b.rank - a.rank);
  }

  let expectedTricks = 0;

  // Non-trump suits
  for (const suit of ['hearts', 'diamonds', 'clubs'] as Suit[]) {
    const cards = bySuit[suit];
    const len = cards.length;
    const hasAce = cards.some((c) => c.rank === 14);
    const hasKing = cards.some((c) => c.rank === 13);
    const hasQueen = cards.some((c) => c.rank === 12);

    if (hasAce) {
      expectedTricks += len <= 4 ? 0.95 : len === 5 ? 0.8 : 0.65;
    }
    if (hasKing) {
      if (hasAce && len >= 2) expectedTricks += len <= 4 ? 0.85 : 0.65;
      else if (len >= 2 && len <= 4) expectedTricks += 0.55;
      else if (len >= 5) expectedTricks += 0.35;
      else expectedTricks += 0.2;
    }
    if (hasQueen && ((hasAce && hasKing) || len >= 3)) {
      expectedTricks += 0.35;
    }

    // Short suit ruffing value if holding spades
    if (len === 0 && bySuit.spades.length >= 2) {
      expectedTricks += 0.7;
    } else if (len === 1 && !hasAce && bySuit.spades.length >= 2) {
      expectedTricks += 0.45;
    }
  }

  // Spade (trump) evaluation
  const spades = bySuit.spades;
  for (const c of spades) {
    if (c.rank === 14) expectedTricks += 1.0;
    else if (c.rank === 13) expectedTricks += spades.length >= 2 ? 0.92 : 0.7;
    else if (c.rank === 12) expectedTricks += spades.length >= 3 ? 0.78 : 0.5;
    else if (c.rank === 11) expectedTricks += spades.length >= 3 ? 0.58 : 0.3;
    else if (c.rank >= 9) expectedTricks += spades.length >= 4 ? 0.42 : 0.2;
    else if (spades.length >= 4) expectedTricks += 0.32;
  }

  if (difficulty === 'hard') {
    // Adjust slightly based on already-visible table bids (sum pressure)
    const placedBids = Object.values(bids).filter((b): b is number => b !== null);
    const sumSoFar = placedBids.reduce((a, b) => a + b, 0);
    if (placedBids.length >= 2 && sumSoFar >= 9) {
      // Competitive table: slightly conservative to avoid -bid penalty
      expectedTricks -= 0.25;
    } else if (placedBids.length === 3 && sumSoFar <= 6) {
      expectedTricks += 0.2;
    }
    // Slight conservative bias in Nepali Call Break because failing bid is harsh (-Bid)
    const conservative = Math.floor(expectedTricks + 0.35);
    return Math.max(1, Math.min(maxBid, conservative));
  }

  return Math.max(1, Math.min(maxBid, Math.round(expectedTricks)));
}

/**
 * Selects the best legal card for a bot without accessing hidden opponent hands.
 */
export function chooseBotCard(ctx: BotPublicContext): Card {
  const { legalCards } = getLegalMoves(ctx.hand, ctx.currentTrick, ctx.settings);
  if (legalCards.length === 1) {
    return legalCards[0];
  }

  if (ctx.difficulty === 'easy') {
    return legalCards[Math.floor(Math.random() * legalCards.length)];
  }

  if (ctx.difficulty === 'medium') {
    return chooseMediumCard(ctx, legalCards);
  }

  return chooseHardMonteCarloCard(ctx, legalCards);
}

function getPlayedCardIds(ctx: BotPublicContext): Set<string> {
  const seen = new Set<string>();
  for (const t of ctx.completedTricks) {
    for (const tc of t.cards) {
      seen.add(tc.card.id);
    }
  }
  for (const tc of ctx.currentTrick) {
    seen.add(tc.card.id);
  }
  return seen;
}

function isMasterCardInSuit(card: Card, playedIds: Set<string>, hand: Card[]): boolean {
  for (let r = 14; r > card.rank; r--) {
    const id = `${card.suit}-${r}`;
    if (!playedIds.has(id) && !hand.some((c) => c.id === id)) {
      return false;
    }
  }
  return true;
}

function sortAsc(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => a.rank - b.rank);
}

function sortDesc(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => b.rank - a.rank);
}

function chooseMediumCard(ctx: BotPublicContext, legalCards: Card[]): Card {
  const playedIds = getPlayedCardIds(ctx);
  const myBid = ctx.bids[ctx.seat] ?? 2;
  const myWon = ctx.tricksWon[ctx.seat] ?? 0;
  const needMoreTricks = myWon < myBid;
  const isLeading = ctx.currentTrick.length === 0;
  const isLastToPlay = ctx.currentTrick.length === 3;

  if (isLeading) {
    // If need tricks, cash master non-spade Aces/Kings first, or safe non-trump leads
    if (needMoreTricks) {
      const masters = legalCards.filter(
        (c) => c.suit !== 'spades' && isMasterCardInSuit(c, playedIds, ctx.hand)
      );
      if (masters.length > 0) return sortDesc(masters)[0];

      const spadeMasters = legalCards.filter(
        (c) => c.suit === 'spades' && isMasterCardInSuit(c, playedIds, ctx.hand)
      );
      if (spadeMasters.length > 0 && ctx.hand.filter((c) => c.suit === 'spades').length >= 3) {
        return sortDesc(spadeMasters)[0];
      }
    }

    // Lead low card from a non-spade suit (or shortest non-spade to create void)
    const nonSpades = legalCards.filter((c) => c.suit !== 'spades');
    if (nonSpades.length > 0) {
      return sortAsc(nonSpades)[0];
    }
    return sortAsc(legalCards)[0];
  }

  // Following in trick
  const winningOptions = legalCards.filter((c) => {
    const simulated = [...ctx.currentTrick, { seat: ctx.seat, card: c, playedAt: 0 }];
    return determineTrickWinner(simulated) === ctx.seat;
  });

  if (needMoreTricks && winningOptions.length > 0) {
    // If last to play, win as cheaply as possible!
    if (isLastToPlay) {
      return sortAsc(winningOptions)[0];
    }
    // Otherwise win with master or lowest winning card if it's reasonably strong
    const nonSpadeWins = winningOptions.filter((c) => c.suit !== 'spades');
    if (nonSpadeWins.length > 0) {
      const masterWin = nonSpadeWins.find((c) => isMasterCardInSuit(c, playedIds, ctx.hand));
      return masterWin ?? sortDesc(nonSpadeWins)[0];
    }
    return sortAsc(winningOptions)[0];
  }

  // Don't need tricks or can't win: dump lowest non-spade if possible
  const nonSpades = legalCards.filter((c) => c.suit !== 'spades');
  if (nonSpades.length > 0) {
    return sortAsc(nonSpades)[0];
  }
  return sortAsc(legalCards)[0];
}

function chooseHardMonteCarloCard(ctx: BotPublicContext, legalCards: Card[]): Card {
  // Fast deterministic pruning for obvious single-suit low-impact choices
  if (legalCards.length <= 1) return legalCards[0];

  const playedIds = getPlayedCardIds(ctx);
  const myHandIds = new Set(ctx.hand.map((c) => c.id));
  const unseenPool = createDeck().filter(
    (c) => !playedIds.has(c.id) && !myHandIds.has(c.id)
  );
  const voidSuits = inferPublicVoidSuits(ctx.completedTricks, ctx.currentTrick);

  const otherSeats: SeatIndex[] = ([0, 1, 2, 3] as SeatIndex[]).filter(
    (s) => s !== ctx.seat
  );

  // Number of rollouts calibrated for sub-40ms server latency
  const simulations = Math.min(28, Math.max(12, legalCards.length * 4));
  const scoresByCardId = new Map<string, number>();

  for (const candidate of legalCards) {
    scoresByCardId.set(candidate.id, 0);
  }

  for (let sim = 0; sim < simulations; sim++) {
    // Sample a plausible hidden distribution respecting public void suits & card counts
    const sampledHands = sampleConsistentHands(
      unseenPool,
      otherSeats,
      ctx.seatCardCounts,
      voidSuits
    );
    sampledHands[ctx.seat] = [...ctx.hand];

    for (const candidate of legalCards) {
      const utility = evaluateRollout(ctx, candidate, sampledHands);
      scoresByCardId.set(candidate.id, (scoresByCardId.get(candidate.id) ?? 0) + utility);
    }
  }

  let bestCard = legalCards[0];
  let bestScore = -Infinity;
  for (const card of legalCards) {
    const score = scoresByCardId.get(card.id) ?? -Infinity;
    if (score > bestScore) {
      bestScore = score;
      bestCard = card;
    }
  }
  return bestCard;
}

function sampleConsistentHands(
  unseenPool: Card[],
  otherSeats: SeatIndex[],
  seatCardCounts: Record<SeatIndex, number>,
  voidSuits: Record<SeatIndex, Set<Suit>>
): Record<SeatIndex, Card[]> {
  const pool = shuffleDeck(unseenPool);
  const hands: Record<SeatIndex, Card[]> = {
    0: [],
    1: [],
    2: [],
    3: [],
  };

  const remainingSlots: Record<SeatIndex, number> = {
    0: seatCardCounts[0],
    1: seatCardCounts[1],
    2: seatCardCounts[2],
    3: seatCardCounts[3],
  };

  // First pass: place each card into a seat that is NOT publicly void in that suit
  const leftover: Card[] = [];
  for (const card of pool) {
    const eligible = otherSeats.filter(
      (s) => remainingSlots[s] > 0 && !voidSuits[s].has(card.suit)
    );
    if (eligible.length > 0) {
      const chosen = eligible[Math.floor(Math.random() * eligible.length)];
      hands[chosen].push(card);
      remainingSlots[chosen]--;
    } else {
      leftover.push(card);
    }
  }

  // Fallback pass for any constrained edge cases
  for (const card of leftover) {
    const eligible = otherSeats.filter((s) => remainingSlots[s] > 0);
    if (eligible.length > 0) {
      const chosen = eligible[0];
      hands[chosen].push(card);
      remainingSlots[chosen]--;
    }
  }

  return hands;
}

function evaluateRollout(
  ctx: BotPublicContext,
  candidate: Card,
  sampledHands: Record<SeatIndex, Card[]>
): number {
  const hands: Record<SeatIndex, Card[]> = {
    0: [...sampledHands[0]],
    1: [...sampledHands[1]],
    2: [...sampledHands[2]],
    3: [...sampledHands[3]],
  };
  const tricksWon: Record<SeatIndex, number> = { ...ctx.tricksWon };

  // Play candidate card for bot's seat
  hands[ctx.seat] = hands[ctx.seat].filter((c) => c.id !== candidate.id);
  const trick: TrickCard[] = [
    ...ctx.currentTrick,
    { seat: ctx.seat, card: candidate, playedAt: 0 },
  ];

  // Finish the current trick using fast heuristic rollouts
  let turn = nextSeat(ctx.seat);
  while (trick.length < 4) {
    const legal = getLegalMoves(hands[turn], trick, ctx.settings).legalCards;
    const chosen = fastPlayoutMove(turn, legal, trick, ctx.bids, tricksWon);
    hands[turn] = hands[turn].filter((c) => c.id !== chosen.id);
    trick.push({ seat: turn, card: chosen, playedAt: 0 });
    turn = nextSeat(turn);
  }

  const firstWinner = determineTrickWinner(trick);
  tricksWon[firstWinner] = (tricksWon[firstWinner] ?? 0) + 1;

  // Simulate remaining tricks (up to 4 lookahead tricks for speed & accuracy)
  const remainingTricks = Math.min(4, hands[ctx.seat].length);
  let leader = firstWinner;
  for (let t = 0; t < remainingTricks; t++) {
    const subTrick: TrickCard[] = [];
    let s = leader;
    for (let p = 0; p < 4; p++) {
      const legal = getLegalMoves(hands[s], subTrick, ctx.settings).legalCards;
      if (legal.length === 0) break;
      const chosen = fastPlayoutMove(s, legal, subTrick, ctx.bids, tricksWon);
      hands[s] = hands[s].filter((c) => c.id !== chosen.id);
      subTrick.push({ seat: s, card: chosen, playedAt: 0 });
      s = nextSeat(s);
    }
    if (subTrick.length === 4) {
      leader = determineTrickWinner(subTrick);
      tricksWon[leader] = (tricksWon[leader] ?? 0) + 1;
    }
  }

  const myBid = ctx.bids[ctx.seat] ?? 2;
  const myTricks = tricksWon[ctx.seat] ?? 0;

  // Utility function: strongly reward reaching bid, slightly reward overtricks (+0.1),
  // penalize wasting high spades unnecessarily when bid is already comfortably met.
  let utility = 0;
  if (myTricks >= myBid) {
    utility += myBid * 10 + (myTricks - myBid) * 1.2;
  } else {
    // Partial progress toward bid
    utility += myTricks * 4 - (myBid - myTricks) * 6;
  }

  // Slight penalty for burning high spades early when an equivalent low card works
  if (candidate.suit === 'spades' && candidate.rank >= 11) {
    utility -= 0.4;
  }

  return utility;
}

function fastPlayoutMove(
  seat: SeatIndex,
  legal: Card[],
  trick: TrickCard[],
  bids: Record<SeatIndex, number | null>,
  tricksWon: Record<SeatIndex, number>
): Card {
  if (legal.length === 1) return legal[0];
  const need = (tricksWon[seat] ?? 0) < (bids[seat] ?? 2);
  if (trick.length === 0) {
    return need ? sortDesc(legal)[0] : sortAsc(legal)[0];
  }
  const winners = legal.filter((c) => {
    const sim = [...trick, { seat, card: c, playedAt: 0 }];
    return determineTrickWinner(sim) === seat;
  });
  if (need && winners.length > 0) {
    return sortAsc(winners)[0];
  }
  const nonSpades = legal.filter((c) => c.suit !== 'spades');
  return nonSpades.length > 0 ? sortAsc(nonSpades)[0] : sortAsc(legal)[0];
}
