export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';

export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export interface Card {
  id: string; // e.g., "spades-14"
  suit: Suit;
  rank: Rank;
}

export type SeatIndex = 0 | 1 | 2 | 3;

export type BotDifficulty = 'easy' | 'medium' | 'hard';

export interface RoomSettings {
  rounds: 1 | 3 | 5;
  maxBid: 8 | 13;
  strictMustBeat: boolean;
  strictMustTrump: boolean;
  turnTimerEnabled: boolean;
  turnTimerSeconds: number;
  botDifficulty: BotDifficulty;
}

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  rounds: 5,
  maxBid: 8,
  strictMustBeat: true,
  strictMustTrump: true,
  turnTimerEnabled: false,
  turnTimerSeconds: 25,
  botDifficulty: 'medium',
};

export type PlayerType = 'human' | 'bot';

export interface PlayerSeat {
  seat: SeatIndex;
  occupied: boolean;
  playerId: string | null;
  displayName: string;
  playerType: PlayerType;
  botDifficulty?: BotDifficulty;
  isHost: boolean;
  isReady: boolean;
  connected: boolean;
  lastSeenAt: number;
  bid: number | null;
  tricksWon: number;
  totalScoreTenths: number;
}

export interface TrickCard {
  seat: SeatIndex;
  card: Card;
  playedAt: number;
}

export interface CompletedTrick {
  trickNumber: number;
  leadSeat: SeatIndex;
  winnerSeat: SeatIndex;
  cards: TrickCard[];
}

export interface RoundPlayerResult {
  seat: SeatIndex;
  displayName: string;
  bid: number;
  tricksWon: number;
  roundScoreTenths: number;
  cumulativeScoreTenths: number;
}

export interface RoundSummary {
  roundNumber: number;
  dealerSeat: SeatIndex;
  results: RoundPlayerResult[];
}

export type RoomPhase =
  | 'LOBBY'
  | 'BIDDING'
  | 'PLAYING'
  | 'TRICK_COMPLETE'
  | 'ROUND_COMPLETE'
  | 'GAME_COMPLETE';

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderSeat: SeatIndex | null;
  text: string;
  createdAt: number;
  kind: 'user' | 'system';
}

export interface RoomState {
  roomCode: string;
  roomName: string;
  phase: RoomPhase;
  version: number;
  createdAt: number;
  updatedAt: number;
  settings: RoomSettings;
  seats: [PlayerSeat, PlayerSeat, PlayerSeat, PlayerSeat];
  currentRound: number;
  dealerSeat: SeatIndex;
  activeTurnSeat: SeatIndex | null;
  turnDeadlineAt: number | null;
  hands: Record<SeatIndex, Card[]>;
  currentTrick: TrickCard[];
  trickNumber: number;
  completedTricks: CompletedTrick[];
  lastCompletedTrick: CompletedTrick | null;
  roundHistory: RoundSummary[];
  winnerSeats: SeatIndex[];
  chat: ChatMessage[];
}

export interface PublicSeatView extends PlayerSeat {
  cardCount: number;
}

export interface ClientRoomView {
  roomCode: string;
  roomName: string;
  phase: RoomPhase;
  version: number;
  createdAt: number;
  updatedAt: number;
  settings: RoomSettings;
  seats: [PublicSeatView, PublicSeatView, PublicSeatView, PublicSeatView];
  mySeat: SeatIndex | null;
  myPlayerId: string | null;
  myHand: Card[];
  legalCardIds: string[];
  legalReason: string | null;
  currentRound: number;
  dealerSeat: SeatIndex;
  activeTurnSeat: SeatIndex | null;
  turnDeadlineAt: number | null;
  currentTrick: TrickCard[];
  trickNumber: number;
  lastCompletedTrick: CompletedTrick | null;
  completedTricksCount: number;
  roundHistory: RoundSummary[];
  winnerSeats: SeatIndex[];
  chat: ChatMessage[];
}
