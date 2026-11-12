import { z } from 'zod';
import {
  Card,
  ChatMessage,
  ClientRoomView,
  CompletedTrick,
  RoomSettings,
  RoundSummary,
  SeatIndex,
} from './types.ts';

export const SeatIndexSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);

export const RoomSettingsSchema = z.object({
  rounds: z.union([z.literal(1), z.literal(3), z.literal(5)]),
  maxBid: z.union([z.literal(8), z.literal(13)]),
  strictMustBeat: z.boolean(),
  strictMustTrump: z.boolean(),
  turnTimerEnabled: z.boolean(),
  turnTimerSeconds: z.number().int().min(10).max(90),
  botDifficulty: z.enum(['easy', 'medium', 'hard']),
});

// Client -> Server WebSocket Command Schemas
export const ClientCommandSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('room.join'),
    actionId: z.string().min(1),
    roomCode: z.string().min(4).max(12),
    displayName: z.string().trim().min(1).max(24).optional(),
    sessionToken: z.string().optional(),
    preferredSeat: SeatIndexSchema.optional(),
  }),
  z.object({
    type: z.literal('player.ready'),
    actionId: z.string().min(1),
    ready: z.boolean(),
  }),
  z.object({
    type: z.literal('seat.select'),
    actionId: z.string().min(1),
    seat: SeatIndexSchema,
  }),
  z.object({
    type: z.literal('bot.add'),
    actionId: z.string().min(1),
    seat: SeatIndexSchema,
    difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  }),
  z.object({
    type: z.literal('bot.remove'),
    actionId: z.string().min(1),
    seat: SeatIndexSchema,
  }),
  z.object({
    type: z.literal('room.update_settings'),
    actionId: z.string().min(1),
    settings: RoomSettingsSchema.partial(),
  }),
  z.object({
    type: z.literal('host.transfer'),
    actionId: z.string().min(1),
    targetSeat: SeatIndexSchema,
  }),
  z.object({
    type: z.literal('game.start'),
    actionId: z.string().min(1),
  }),
  z.object({
    type: z.literal('bid.submit'),
    actionId: z.string().min(1),
    expectedVersion: z.number().int().nonnegative().optional(),
    bid: z.number().int().min(1).max(13),
  }),
  z.object({
    type: z.literal('card.play'),
    actionId: z.string().min(1),
    expectedVersion: z.number().int().nonnegative().optional(),
    cardId: z.string().min(1),
  }),
  z.object({
    type: z.literal('round.next'),
    actionId: z.string().min(1),
  }),
  z.object({
    type: z.literal('game.restart'),
    actionId: z.string().min(1),
  }),
  z.object({
    type: z.literal('chat.send'),
    actionId: z.string().min(1),
    text: z.string().trim().min(1).max(300),
  }),
  z.object({
    type: z.literal('player.typing'),
    isTyping: z.boolean(),
  }),
  z.object({
    type: z.literal('game.request_sync'),
    lastKnownVersion: z.number().int().nonnegative().optional(),
  }),
  z.object({
    type: z.literal('ping'),
    timestamp: z.number(),
  }),
]);

export type ClientCommand = z.infer<typeof ClientCommandSchema>;

// All 21 Required Authoritative Server -> Client Events (+ pong)
export type ServerEvent =
  | {
      type: 'room.created';
      version: number;
      roomCode: string;
      state: ClientRoomView;
    }
  | {
      type: 'room.joined';
      version: number;
      roomCode: string;
      sessionToken: string;
      seat: SeatIndex;
      state: ClientRoomView;
    }
  | {
      type: 'room.updated';
      version: number;
      settings: RoomSettings;
      state: ClientRoomView;
    }
  | {
      type: 'player.joined';
      version: number;
      seat: SeatIndex;
      displayName: string;
      state: ClientRoomView;
    }
  | {
      type: 'player.left';
      version: number;
      seat: SeatIndex;
      displayName: string;
      state: ClientRoomView;
    }
  | {
      type: 'player.reconnected';
      version: number;
      seat: SeatIndex;
      displayName: string;
      state: ClientRoomView;
    }
  | {
      type: 'player.ready';
      version: number;
      seat: SeatIndex;
      ready: boolean;
      state: ClientRoomView;
    }
  | {
      type: 'bot.added';
      version: number;
      seat: SeatIndex;
      botName: string;
      difficulty: 'easy' | 'medium' | 'hard';
      state: ClientRoomView;
    }
  | {
      type: 'bot.removed';
      version: number;
      seat: SeatIndex;
      state: ClientRoomView;
    }
  | {
      type: 'game.started';
      version: number;
      currentRound: number;
      dealerSeat: SeatIndex;
      state: ClientRoomView;
    }
  | {
      type: 'cards.dealt';
      version: number;
      currentRound: number;
      dealerSeat: SeatIndex;
      hand: Card[];
      state: ClientRoomView;
    }
  | {
      type: 'bid.submitted';
      version: number;
      seat: SeatIndex;
      bid: number;
      state: ClientRoomView;
    }
  | {
      type: 'bidding.completed';
      version: number;
      leadSeat: SeatIndex;
      state: ClientRoomView;
    }
  | {
      type: 'card.played';
      version: number;
      seat: SeatIndex;
      card: Card;
      state: ClientRoomView;
    }
  | {
      type: 'trick.completed';
      version: number;
      trick: CompletedTrick;
      state: ClientRoomView;
    }
  | {
      type: 'round.completed';
      version: number;
      summary: RoundSummary;
      state: ClientRoomView;
    }
  | {
      type: 'game.completed';
      version: number;
      winnerSeats: SeatIndex[];
      roundHistory: RoundSummary[];
      state: ClientRoomView;
    }
  | {
      type: 'chat.message';
      version: number;
      message: ChatMessage;
    }
  | {
      type: 'player.typing';
      seat: SeatIndex;
      displayName: string;
      isTyping: boolean;
    }
  | {
      type: 'game.state_sync';
      version: number;
      state: ClientRoomView;
    }
  | {
      type: 'game.error';
      code: string;
      message: string;
      actionId?: string;
    }
  | {
      type: 'pong';
      timestamp: number;
      serverTime: number;
    };
