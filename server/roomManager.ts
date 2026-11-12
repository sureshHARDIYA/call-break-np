import crypto from 'node:crypto';
import type { WebSocket } from 'ws';
import { chooseBotBid, chooseBotCard } from '../src/engine/bots.ts';
import { ClientCommand, ClientCommandSchema, ServerEvent } from '../src/engine/protocol.ts';
import {
  calculateRoundScoreTenths,
  dealHands,
  determineTrickWinner,
  formatCardLabel,
  getLegalMoves,
  getWinnerSeats,
  isCardLegal,
  nextSeat,
} from '../src/engine/rules.ts';
import {
  BotDifficulty,
  ChatMessage,
  ClientRoomView,
  CompletedTrick,
  DEFAULT_ROOM_SETTINGS,
  PlayerSeat,
  PublicSeatView,
  RoomSettings,
  RoomState,
  RoundPlayerResult,
  RoundSummary,
  SeatIndex,
} from '../src/engine/types.ts';
import { generateBotChatReply, pickRespondingBot } from './botChat.ts';
import { pubSubBus } from './pubsub.ts';
import { roomStore } from './storage.ts';

const BOT_NAMES = ['Aarav', 'Sita', 'Kiran', 'Maya', 'Bikram', 'Nisha', 'Rohan', 'Anjali'];

interface RoomRuntime {
  room: RoomState;
  seatSessions: Record<SeatIndex, string | null>;
  sockets: Map<WebSocket, { seat: SeatIndex | null; playerId: string | null; sessionToken: string | null }>;
  botTimer: ReturnType<typeof setTimeout> | null;
  trickClearTimer: ReturnType<typeof setTimeout> | null;
  turnTimer: ReturnType<typeof setTimeout> | null;
  recentActionIds: Set<string>;
  botChatSeq: number;
  lastBotChatSeat: SeatIndex | null;
}

function createEmptySeat(seat: SeatIndex): PlayerSeat {
  return {
    seat,
    occupied: false,
    playerId: null,
    displayName: `Seat ${seat + 1}`,
    playerType: 'human',
    isHost: false,
    isReady: false,
    connected: false,
    lastSeenAt: 0,
    bid: null,
    tricksWon: 0,
    totalScoreTenths: 0,
  };
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[crypto.randomInt(0, chars.length)];
  }
  return code;
}

function generateToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

function generateId(): string {
  return crypto.randomUUID();
}

export class RoomManager {
  private rooms = new Map<string, RoomRuntime>();
  private socketToRoom = new Map<WebSocket, string>();

  constructor() {
    // Hydrate persisted rooms on startup
    const saved = roomStore.loadAllRooms();
    for (const record of saved) {
      // Mark all human seats disconnected until sockets reconnect
      for (const s of record.room.seats) {
        if (s.occupied && s.playerType === 'human') {
          s.connected = false;
        }
      }
      const runtime: RoomRuntime = {
        room: record.room,
        seatSessions: record.seatSessions,
        sockets: new Map(),
        botTimer: null,
        trickClearTimer: null,
        turnTimer: null,
        recentActionIds: new Set(),
        botChatSeq: 0,
        lastBotChatSeat: null,
      };
      this.rooms.set(record.room.roomCode, runtime);
      // Resume timers if game was mid-trick or bot's turn
      if (record.room.phase === 'TRICK_COMPLETE') {
        this.scheduleTrickResolution(runtime);
      } else if (
        record.room.phase === 'BIDDING' ||
        record.room.phase === 'PLAYING'
      ) {
        this.scheduleTurnAutomation(runtime);
      }
    }
  }

  private getOrLoadRuntime(roomCode: string): RoomRuntime | null {
    const code = roomCode.trim().toUpperCase();
    const existing = this.rooms.get(code);
    if (existing) return existing;

    const loaded = roomStore.loadRoom(code);
    if (!loaded) return null;
    for (const s of loaded.room.seats) {
      if (s.occupied && s.playerType === 'human') {
        s.connected = false;
      }
    }
    const runtime: RoomRuntime = {
      room: loaded.room,
      seatSessions: loaded.seatSessions,
      sockets: new Map(),
      botTimer: null,
      trickClearTimer: null,
      turnTimer: null,
      recentActionIds: new Set(),
      botChatSeq: 0,
      lastBotChatSeat: null,
    };
    this.rooms.set(code, runtime);
    return runtime;
  }

  public createRoom(params: {
    displayName: string;
    roomName?: string;
    settings?: Partial<RoomSettings>;
    fillBots?: boolean;
  }): { roomCode: string; sessionToken: string; seat: SeatIndex; state: ClientRoomView } {
    let roomCode = generateRoomCode();
    while (this.rooms.has(roomCode)) {
      roomCode = generateRoomCode();
    }

    const now = Date.now();
    const settings: RoomSettings = {
      ...DEFAULT_ROOM_SETTINGS,
      ...(params.settings ?? {}),
    };

    const playerId = generateId();
    const sessionToken = generateToken();
    const cleanName = params.displayName.trim().slice(0, 24) || 'Player 1';
    const cleanRoomName =
      params.roomName?.trim().slice(0, 36) || `${cleanName}'s Table`;

    const seats: [PlayerSeat, PlayerSeat, PlayerSeat, PlayerSeat] = [
      createEmptySeat(0),
      createEmptySeat(1),
      createEmptySeat(2),
      createEmptySeat(3),
    ];

    seats[0] = {
      seat: 0,
      occupied: true,
      playerId,
      displayName: cleanName,
      playerType: 'human',
      isHost: true,
      isReady: true,
      connected: false,
      lastSeenAt: now,
      bid: null,
      tricksWon: 0,
      totalScoreTenths: 0,
    };

    const room: RoomState = {
      roomCode,
      roomName: cleanRoomName,
      phase: 'LOBBY',
      version: 1,
      createdAt: now,
      updatedAt: now,
      settings,
      seats,
      currentRound: 0,
      dealerSeat: 0,
      activeTurnSeat: null,
      turnDeadlineAt: null,
      hands: { 0: [], 1: [], 2: [], 3: [] },
      currentTrick: [],
      trickNumber: 0,
      completedTricks: [],
      lastCompletedTrick: null,
      roundHistory: [],
      winnerSeats: [],
      chat: [
        {
          id: generateId(),
          senderId: 'system',
          senderName: 'Table',
          senderSeat: null,
          text: `${cleanName} opened room ${roomCode}.`,
          createdAt: now,
          kind: 'system',
        },
      ],
    };

    if (params.fillBots) {
      for (const s of [1, 2, 3] as SeatIndex[]) {
        this.assignBotToSeat(room, s, settings.botDifficulty);
      }
    }

    const runtime: RoomRuntime = {
      room,
      seatSessions: {
        0: sessionToken,
        1: null,
        2: null,
        3: null,
      },
      sockets: new Map(),
      botTimer: null,
      trickClearTimer: null,
      turnTimer: null,
      recentActionIds: new Set(),
      botChatSeq: 0,
      lastBotChatSeat: null,
    };

    this.rooms.set(roomCode, runtime);
    this.persist(runtime, 'room.created', { roomCode, host: cleanName });

    return {
      roomCode,
      sessionToken,
      seat: 0,
      state: this.toClientRoomView(room, 0),
    };
  }

  public getPublicRoomSummary(roomCode: string) {
    const runtime = this.getOrLoadRuntime(roomCode);
    if (!runtime) return null;
    const { room } = runtime;
    const occupiedCount = room.seats.filter((s) => s.occupied).length;
    const vacantSeats = room.seats.filter((s) => !s.occupied).map((s) => s.seat);
    return {
      roomCode: room.roomCode,
      roomName: room.roomName,
      phase: room.phase,
      settings: room.settings,
      occupiedCount,
      vacantSeats,
      isFull: vacantSeats.length === 0,
      seats: room.seats.map((s) => ({
        seat: s.seat,
        occupied: s.occupied,
        displayName: s.displayName,
        playerType: s.playerType,
        isHost: s.isHost,
        connected: s.connected,
      })),
    };
  }

  public handleMessage(ws: WebSocket, rawText: string): void {
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawText);
    } catch {
      this.send(ws, {
        type: 'game.error',
        code: 'INVALID_JSON',
        message: 'Malformed WebSocket message',
      });
      return;
    }

    const parsed = ClientCommandSchema.safeParse(parsedJson);
    if (!parsed.success) {
      this.send(ws, {
        type: 'game.error',
        code: 'INVALID_PAYLOAD',
        message: parsed.error.issues[0]?.message ?? 'Invalid command payload',
      });
      return;
    }

    const cmd = parsed.data;
    if (cmd.type === 'ping') {
      this.send(ws, {
        type: 'pong',
        timestamp: cmd.timestamp,
        serverTime: Date.now(),
      });
      return;
    }

    if (cmd.type === 'room.join') {
      this.handleJoinRoom(ws, cmd);
      return;
    }

    const roomCode = this.socketToRoom.get(ws);
    if (!roomCode) {
      this.send(ws, {
        type: 'game.error',
        code: 'NOT_IN_ROOM',
        message: 'Join a room before sending game actions.',
        actionId: 'actionId' in cmd ? cmd.actionId : undefined,
      });
      return;
    }

    const runtime = this.getOrLoadRuntime(roomCode);
    if (!runtime) {
      this.send(ws, {
        type: 'game.error',
        code: 'ROOM_NOT_FOUND',
        message: 'Room no longer exists.',
      });
      return;
    }

    const session = runtime.sockets.get(ws);
    if (!session || session.seat === null) {
      this.send(ws, {
        type: 'game.error',
        code: 'NO_SEAT',
        message: 'You do not hold a seat in this room.',
      });
      return;
    }

    // Idempotency check for mutation commands
    if ('actionId' in cmd && cmd.actionId) {
      if (
        runtime.recentActionIds.has(cmd.actionId) ||
        roomStore.hasProcessedAction(roomCode, cmd.actionId)
      ) {
        // Already processed; resync caller cleanly without mutating
        this.send(ws, {
          type: 'game.state_sync',
          version: runtime.room.version,
          state: this.toClientRoomView(runtime.room, session.seat),
        });
        return;
      }
    }

    // Version check for turn-sensitive commands
    if (
      'expectedVersion' in cmd &&
      cmd.expectedVersion !== undefined &&
      cmd.expectedVersion !== runtime.room.version
    ) {
      this.send(ws, {
        type: 'game.state_sync',
        version: runtime.room.version,
        state: this.toClientRoomView(runtime.room, session.seat),
      });
      this.send(ws, {
        type: 'game.error',
        code: 'STALE_STATE',
        message: 'Table updated before your action arrived. Synced latest state.',
        actionId: cmd.actionId,
      });
      return;
    }

    switch (cmd.type) {
      case 'player.ready':
        this.handleReady(runtime, session.seat, cmd.ready, cmd.actionId);
        break;
      case 'seat.select':
        this.handleSelectSeat(ws, runtime, session.seat, cmd.seat, cmd.actionId);
        break;
      case 'bot.add':
        this.handleAddBot(ws, runtime, session.seat, cmd.seat, cmd.difficulty, cmd.actionId);
        break;
      case 'bot.remove':
        this.handleRemoveBot(ws, runtime, session.seat, cmd.seat, cmd.actionId);
        break;
      case 'room.update_settings':
        this.handleUpdateSettings(ws, runtime, session.seat, cmd.settings, cmd.actionId);
        break;
      case 'host.transfer':
        this.handleTransferHost(ws, runtime, session.seat, cmd.targetSeat, cmd.actionId);
        break;
      case 'game.start':
        this.handleStartGame(ws, runtime, session.seat, cmd.actionId);
        break;
      case 'bid.submit':
        this.handleSubmitBid(ws, runtime, session.seat, cmd.bid, cmd.actionId);
        break;
      case 'card.play':
        this.handlePlayCard(ws, runtime, session.seat, cmd.cardId, cmd.actionId);
        break;
      case 'round.next':
        this.handleNextRound(ws, runtime, session.seat, cmd.actionId);
        break;
      case 'game.restart':
        this.handleRestartGame(ws, runtime, session.seat, cmd.actionId);
        break;
      case 'chat.send':
        this.handleChatSend(runtime, session.seat, cmd.text, cmd.actionId);
        break;
      case 'player.typing':
        this.handleTyping(runtime, session.seat, cmd.isTyping);
        break;
      case 'game.request_sync':
        this.send(ws, {
          type: 'game.state_sync',
          version: runtime.room.version,
          state: this.toClientRoomView(runtime.room, session.seat),
        });
        break;
    }
  }

  public handleDisconnect(ws: WebSocket): void {
    const roomCode = this.socketToRoom.get(ws);
    this.socketToRoom.delete(ws);
    if (!roomCode) return;

    const runtime = this.rooms.get(roomCode);
    if (!runtime) return;

    const session = runtime.sockets.get(ws);
    runtime.sockets.delete(ws);
    if (!session || session.seat === null) return;

    const seatIdx = session.seat;
    // Only mark disconnected if no other open socket holds the same seat
    const stillConnected = Array.from(runtime.sockets.values()).some(
      (s) => s.seat === seatIdx
    );
    if (stillConnected) return;

    const seatObj = runtime.room.seats[seatIdx];
    if (!seatObj.occupied || seatObj.playerType !== 'human') return;

    seatObj.connected = false;
    seatObj.lastSeenAt = Date.now();
    this.bumpVersion(runtime);

    // Graceful host migration if host disconnects and another human is connected
    if (seatObj.isHost) {
      const nextHuman = runtime.room.seats.find(
        (s) =>
          s.seat !== seatIdx &&
          s.occupied &&
          s.playerType === 'human' &&
          s.connected
      );
      if (nextHuman) {
        seatObj.isHost = false;
        nextHuman.isHost = true;
        this.pushSystemChat(
          runtime,
          `${seatObj.displayName} disconnected. ${nextHuman.displayName} is now host.`
        );
      }
    }

    this.persist(runtime, 'player.left', {
      seat: seatIdx,
      displayName: seatObj.displayName,
    });

    this.broadcastPerSeat(runtime, (viewerSeat) => ({
      type: 'player.left',
      version: runtime.room.version,
      seat: seatIdx,
      displayName: seatObj.displayName,
      state: this.toClientRoomView(runtime.room, viewerSeat),
    }));
  }

  private handleJoinRoom(
    ws: WebSocket,
    cmd: Extract<ClientCommand, { type: 'room.join' }>
  ): void {
    const code = cmd.roomCode.trim().toUpperCase();
    const runtime = this.getOrLoadRuntime(code);
    if (!runtime) {
      this.send(ws, {
        type: 'game.error',
        code: 'ROOM_NOT_FOUND',
        message: `Room "${code}" was not found.`,
        actionId: cmd.actionId,
      });
      return;
    }

    const { room } = runtime;
    const now = Date.now();

    // 1. Check if reconnecting with an existing valid sessionToken
    if (cmd.sessionToken) {
      const matchedSeat = ([0, 1, 2, 3] as SeatIndex[]).find(
        (s) => runtime.seatSessions[s] === cmd.sessionToken
      );
      if (matchedSeat !== undefined) {
        const seatObj = room.seats[matchedSeat];
        // Close any stale socket for same seat if different
        for (const [otherWs, info] of runtime.sockets.entries()) {
          if (otherWs !== ws && info.seat === matchedSeat) {
            runtime.sockets.delete(otherWs);
            this.socketToRoom.delete(otherWs);
          }
        }
        seatObj.connected = true;
        seatObj.lastSeenAt = now;
        if (cmd.displayName && room.phase === 'LOBBY') {
          seatObj.displayName = cmd.displayName.trim().slice(0, 24);
        }

        // Ensure at least one connected human is host if no connected human currently is
        this.ensureActiveHost(runtime);

        this.attachSocket(ws, runtime, matchedSeat, seatObj.playerId!, cmd.sessionToken);
        this.bumpVersion(runtime);
        this.persist(runtime, 'player.reconnected', {
          seat: matchedSeat,
          displayName: seatObj.displayName,
        });

        this.send(ws, {
          type: 'room.joined',
          version: room.version,
          roomCode: room.roomCode,
          sessionToken: cmd.sessionToken,
          seat: matchedSeat,
          state: this.toClientRoomView(room, matchedSeat),
        });

        this.broadcastPerSeat(
          runtime,
          (viewerSeat) => ({
            type: 'player.reconnected',
            version: room.version,
            seat: matchedSeat,
            displayName: seatObj.displayName,
            state: this.toClientRoomView(room, viewerSeat),
          }),
          ws
        );
        return;
      }
    }

    // 2. Otherwise joining as a new human player
    const displayName = cmd.displayName?.trim().slice(0, 24);
    if (!displayName) {
      this.send(ws, {
        type: 'game.error',
        code: 'DISPLAY_NAME_REQUIRED',
        message: 'Please enter a display name to join this room.',
        actionId: cmd.actionId,
      });
      return;
    }

    // Determine target vacant seat
    let targetSeat: SeatIndex | undefined;
    if (
      cmd.preferredSeat !== undefined &&
      !room.seats[cmd.preferredSeat].occupied
    ) {
      targetSeat = cmd.preferredSeat;
    } else {
      targetSeat = room.seats.find((s) => !s.occupied)?.seat;
    }

    if (targetSeat === undefined) {
      this.send(ws, {
        type: 'game.error',
        code: 'ROOM_FULL',
        message: 'This Call Break table already has 4 players seated.',
        actionId: cmd.actionId,
      });
      return;
    }

    if (room.phase !== 'LOBBY') {
      this.send(ws, {
        type: 'game.error',
        code: 'GAME_IN_PROGRESS',
        message: 'Match is already in progress and no vacant seat can be joined.',
        actionId: cmd.actionId,
      });
      return;
    }

    const playerId = generateId();
    const sessionToken = generateToken();
    const hasHumanHost = room.seats.some((s) => s.occupied && s.isHost && s.connected);

    room.seats[targetSeat] = {
      seat: targetSeat,
      occupied: true,
      playerId,
      displayName,
      playerType: 'human',
      isHost: !hasHumanHost,
      isReady: false,
      connected: true,
      lastSeenAt: now,
      bid: null,
      tricksWon: 0,
      totalScoreTenths: 0,
    };

    if (!hasHumanHost) {
      for (const s of room.seats) {
        if (s.seat !== targetSeat) s.isHost = false;
      }
    }

    runtime.seatSessions[targetSeat] = sessionToken;
    this.attachSocket(ws, runtime, targetSeat, playerId, sessionToken);
    this.bumpVersion(runtime);
    this.pushSystemChat(runtime, `${displayName} joined seat ${targetSeat + 1}.`);
    this.persist(runtime, 'player.joined', { seat: targetSeat, displayName });

    this.send(ws, {
      type: 'room.joined',
      version: room.version,
      roomCode: room.roomCode,
      sessionToken,
      seat: targetSeat,
      state: this.toClientRoomView(room, targetSeat),
    });

    this.broadcastPerSeat(
      runtime,
      (viewerSeat) => ({
        type: 'player.joined',
        version: room.version,
        seat: targetSeat!,
        displayName,
        state: this.toClientRoomView(room, viewerSeat),
      }),
      ws
    );
  }

  private handleReady(
    runtime: RoomRuntime,
    seat: SeatIndex,
    ready: boolean,
    actionId: string
  ): void {
    if (runtime.room.phase !== 'LOBBY') return;
    this.markAction(runtime, actionId);
    runtime.room.seats[seat].isReady = ready;
    this.bumpVersion(runtime);
    this.persist(runtime, 'player.ready', { seat, ready });

    this.broadcastPerSeat(runtime, (viewerSeat) => ({
      type: 'player.ready',
      version: runtime.room.version,
      seat,
      ready,
      state: this.toClientRoomView(runtime.room, viewerSeat),
    }));
  }

  private handleSelectSeat(
    ws: WebSocket,
    runtime: RoomRuntime,
    currentSeat: SeatIndex,
    targetSeat: SeatIndex,
    actionId: string
  ): void {
    const { room } = runtime;
    if (room.phase !== 'LOBBY') {
      this.send(ws, {
        type: 'game.error',
        code: 'INVALID_PHASE',
        message: 'Cannot switch seats after the game has started.',
        actionId,
      });
      return;
    }
    if (currentSeat === targetSeat) return;
    if (room.seats[targetSeat].occupied) {
      this.send(ws, {
        type: 'game.error',
        code: 'SEAT_OCCUPIED',
        message: 'That seat is already taken.',
        actionId,
      });
      return;
    }

    this.markAction(runtime, actionId);
    const movingSeat = room.seats[currentSeat];
    const token = runtime.seatSessions[currentSeat];

    room.seats[targetSeat] = {
      ...movingSeat,
      seat: targetSeat,
    };
    room.seats[currentSeat] = createEmptySeat(currentSeat);
    runtime.seatSessions[targetSeat] = token;
    runtime.seatSessions[currentSeat] = null;

    for (const info of runtime.sockets.values()) {
      if (info.seat === currentSeat) {
        info.seat = targetSeat;
      }
    }

    this.bumpVersion(runtime);
    this.persist(runtime, 'room.updated', {
      movedFrom: currentSeat,
      movedTo: targetSeat,
    });

    this.broadcastPerSeat(runtime, (viewerSeat) => ({
      type: 'room.updated',
      version: room.version,
      settings: room.settings,
      state: this.toClientRoomView(room, viewerSeat),
    }));
  }

  private handleAddBot(
    ws: WebSocket,
    runtime: RoomRuntime,
    callerSeat: SeatIndex,
    targetSeat: SeatIndex,
    difficulty: BotDifficulty | undefined,
    actionId: string
  ): void {
    const { room } = runtime;
    if (!room.seats[callerSeat].isHost) {
      this.send(ws, {
        type: 'game.error',
        code: 'NOT_HOST',
        message: 'Only the room host can add bots.',
        actionId,
      });
      return;
    }
    if (room.phase !== 'LOBBY') {
      this.send(ws, {
        type: 'game.error',
        code: 'INVALID_PHASE',
        message: 'Bots can only be added in the lobby.',
        actionId,
      });
      return;
    }
    if (room.seats[targetSeat].occupied) {
      this.send(ws, {
        type: 'game.error',
        code: 'SEAT_OCCUPIED',
        message: 'Selected seat is already occupied.',
        actionId,
      });
      return;
    }

    this.markAction(runtime, actionId);
    const chosenDifficulty = difficulty ?? room.settings.botDifficulty;
    const botName = this.assignBotToSeat(room, targetSeat, chosenDifficulty);
    this.bumpVersion(runtime);
    this.pushSystemChat(runtime, `${botName} joined seat ${targetSeat + 1}.`);
    this.persist(runtime, 'bot.added', {
      seat: targetSeat,
      botName,
      difficulty: chosenDifficulty,
    });

    this.broadcastPerSeat(runtime, (viewerSeat) => ({
      type: 'bot.added',
      version: room.version,
      seat: targetSeat,
      botName,
      difficulty: chosenDifficulty,
      state: this.toClientRoomView(room, viewerSeat),
    }));
  }

  private handleRemoveBot(
    ws: WebSocket,
    runtime: RoomRuntime,
    callerSeat: SeatIndex,
    targetSeat: SeatIndex,
    actionId: string
  ): void {
    const { room } = runtime;
    if (!room.seats[callerSeat].isHost) {
      this.send(ws, {
        type: 'game.error',
        code: 'NOT_HOST',
        message: 'Only the room host can remove bots.',
        actionId,
      });
      return;
    }
    if (room.phase !== 'LOBBY') {
      this.send(ws, {
        type: 'game.error',
        code: 'INVALID_PHASE',
        message: 'Bots cannot be removed after the match starts.',
        actionId,
      });
      return;
    }
    const target = room.seats[targetSeat];
    if (!target.occupied || target.playerType !== 'bot') {
      this.send(ws, {
        type: 'game.error',
        code: 'NOT_A_BOT',
        message: 'Target seat does not contain a bot.',
        actionId,
      });
      return;
    }

    this.markAction(runtime, actionId);
    const oldName = target.displayName;
    room.seats[targetSeat] = createEmptySeat(targetSeat);
    this.bumpVersion(runtime);
    this.pushSystemChat(runtime, `${oldName} left the table.`);
    this.persist(runtime, 'bot.removed', { seat: targetSeat });

    this.broadcastPerSeat(runtime, (viewerSeat) => ({
      type: 'bot.removed',
      version: room.version,
      seat: targetSeat,
      state: this.toClientRoomView(room, viewerSeat),
    }));
  }

  private handleUpdateSettings(
    ws: WebSocket,
    runtime: RoomRuntime,
    callerSeat: SeatIndex,
    partial: Partial<RoomSettings>,
    actionId: string
  ): void {
    const { room } = runtime;
    if (!room.seats[callerSeat].isHost) {
      this.send(ws, {
        type: 'game.error',
        code: 'NOT_HOST',
        message: 'Only the host can configure match rules.',
        actionId,
      });
      return;
    }
    if (room.phase !== 'LOBBY') {
      this.send(ws, {
        type: 'game.error',
        code: 'INVALID_PHASE',
        message: 'Rules cannot be changed after the match begins.',
        actionId,
      });
      return;
    }

    this.markAction(runtime, actionId);
    room.settings = { ...room.settings, ...partial };
    // Sync existing bots' difficulty to room setting
    for (const s of room.seats) {
      if (s.occupied && s.playerType === 'bot') {
        s.botDifficulty = room.settings.botDifficulty;
      }
    }
    this.bumpVersion(runtime);
    this.persist(runtime, 'room.updated', { settings: room.settings });

    this.broadcastPerSeat(runtime, (viewerSeat) => ({
      type: 'room.updated',
      version: room.version,
      settings: room.settings,
      state: this.toClientRoomView(room, viewerSeat),
    }));
  }

  private handleTransferHost(
    ws: WebSocket,
    runtime: RoomRuntime,
    callerSeat: SeatIndex,
    targetSeat: SeatIndex,
    actionId: string
  ): void {
    const { room } = runtime;
    if (!room.seats[callerSeat].isHost) {
      this.send(ws, {
        type: 'game.error',
        code: 'NOT_HOST',
        message: 'Only the current host can transfer ownership.',
        actionId,
      });
      return;
    }
    const target = room.seats[targetSeat];
    if (!target.occupied || target.playerType !== 'human') {
      this.send(ws, {
        type: 'game.error',
        code: 'INVALID_TARGET',
        message: 'Host can only be transferred to a seated human player.',
        actionId,
      });
      return;
    }

    this.markAction(runtime, actionId);
    room.seats[callerSeat].isHost = false;
    target.isHost = true;
    this.bumpVersion(runtime);
    this.pushSystemChat(runtime, `${target.displayName} is now the table host.`);
    this.persist(runtime, 'room.updated', { newHostSeat: targetSeat });

    this.broadcastPerSeat(runtime, (viewerSeat) => ({
      type: 'room.updated',
      version: room.version,
      settings: room.settings,
      state: this.toClientRoomView(room, viewerSeat),
    }));
  }

  private handleStartGame(
    ws: WebSocket,
    runtime: RoomRuntime,
    callerSeat: SeatIndex,
    actionId: string
  ): void {
    const { room } = runtime;
    if (!room.seats[callerSeat].isHost) {
      this.send(ws, {
        type: 'game.error',
        code: 'NOT_HOST',
        message: 'Only the host can start the match.',
        actionId,
      });
      return;
    }
    if (room.phase !== 'LOBBY') {
      this.send(ws, {
        type: 'game.error',
        code: 'ALREADY_STARTED',
        message: 'The match has already started.',
        actionId,
      });
      return;
    }
    const allOccupied = room.seats.every((s) => s.occupied);
    if (!allOccupied) {
      this.send(ws, {
        type: 'game.error',
        code: 'SEATS_EMPTY',
        message: 'All 4 seats must be filled by players or bots before starting.',
        actionId,
      });
      return;
    }

    this.markAction(runtime, actionId);
    room.currentRound = 1;
    room.dealerSeat = 0;
    room.roundHistory = [];
    room.winnerSeats = [];
    for (const s of room.seats) {
      s.totalScoreTenths = 0;
      s.bid = null;
      s.tricksWon = 0;
    }

    this.startRound(runtime, true);
  }

  private startRound(runtime: RoomRuntime, isFirstRound: boolean): void {
    const { room } = runtime;
    this.clearTimers(runtime);

    room.hands = dealHands();
    room.currentTrick = [];
    room.completedTricks = [];
    room.lastCompletedTrick = null;
    room.trickNumber = 1;
    room.phase = 'BIDDING';
    room.activeTurnSeat = nextSeat(room.dealerSeat);
    room.turnDeadlineAt = room.settings.turnTimerEnabled
      ? Date.now() + room.settings.turnTimerSeconds * 1000
      : null;

    for (const s of room.seats) {
      s.bid = null;
      s.tricksWon = 0;
    }

    this.bumpVersion(runtime);
    this.pushSystemChat(
      runtime,
      `Round ${room.currentRound} of ${room.settings.rounds} dealt. ${
        room.seats[room.activeTurnSeat].displayName
      } bids first.`
    );

    if (isFirstRound) {
      this.persist(runtime, 'game.started', {
        currentRound: room.currentRound,
        dealerSeat: room.dealerSeat,
      });
      this.broadcastPerSeat(runtime, (viewerSeat) => ({
        type: 'game.started',
        version: room.version,
        currentRound: room.currentRound,
        dealerSeat: room.dealerSeat,
        state: this.toClientRoomView(room, viewerSeat),
      }));
    } else {
      this.persist(runtime, 'cards.dealt', {
        currentRound: room.currentRound,
        dealerSeat: room.dealerSeat,
      });
    }

    // Send personalized cards.dealt to each seated player
    this.broadcastPerSeat(runtime, (viewerSeat) => ({
      type: 'cards.dealt',
      version: room.version,
      currentRound: room.currentRound,
      dealerSeat: room.dealerSeat,
      hand: viewerSeat !== null ? room.hands[viewerSeat] : [],
      state: this.toClientRoomView(room, viewerSeat),
    }));

    this.scheduleTurnAutomation(runtime);
  }

  private handleSubmitBid(
    ws: WebSocket,
    runtime: RoomRuntime,
    seat: SeatIndex,
    bid: number,
    actionId: string
  ): void {
    const { room } = runtime;
    if (room.phase !== 'BIDDING') {
      this.send(ws, {
        type: 'game.error',
        code: 'INVALID_PHASE',
        message: 'Bidding is not currently active.',
        actionId,
      });
      return;
    }
    if (room.activeTurnSeat !== seat) {
      this.send(ws, {
        type: 'game.error',
        code: 'NOT_YOUR_TURN',
        message: 'Wait for your turn to place a bid.',
        actionId,
      });
      return;
    }
    if (bid < 1 || bid > room.settings.maxBid) {
      this.send(ws, {
        type: 'game.error',
        code: 'INVALID_BID',
        message: `Bid must be between 1 and ${room.settings.maxBid}.`,
        actionId,
      });
      return;
    }
    if (room.seats[seat].bid !== null) {
      this.send(ws, {
        type: 'game.error',
        code: 'BID_LOCKED',
        message: 'Your bid has already been submitted and cannot be changed.',
        actionId,
      });
      return;
    }

    this.markAction(runtime, actionId);
    this.applyBid(runtime, seat, bid);
  }

  private applyBid(runtime: RoomRuntime, seat: SeatIndex, bid: number): void {
    const { room } = runtime;
    this.clearTimers(runtime);

    room.seats[seat].bid = bid;
    const allBid = room.seats.every((s) => s.bid !== null);

    if (!allBid) {
      room.activeTurnSeat = nextSeat(seat);
      room.turnDeadlineAt = room.settings.turnTimerEnabled
        ? Date.now() + room.settings.turnTimerSeconds * 1000
        : null;
      this.bumpVersion(runtime);
      this.persist(runtime, 'bid.submitted', { seat, bid });

      this.broadcastPerSeat(runtime, (viewerSeat) => ({
        type: 'bid.submitted',
        version: room.version,
        seat,
        bid,
        state: this.toClientRoomView(room, viewerSeat),
      }));

      this.scheduleTurnAutomation(runtime);
      return;
    }

    // All 4 players have bid -> transition to PLAYING
    const leadSeat = nextSeat(room.dealerSeat);
    room.phase = 'PLAYING';
    room.activeTurnSeat = leadSeat;
    room.turnDeadlineAt = room.settings.turnTimerEnabled
      ? Date.now() + room.settings.turnTimerSeconds * 1000
      : null;
    this.bumpVersion(runtime);

    this.persist(runtime, 'bid.submitted', { seat, bid });
    this.broadcastPerSeat(runtime, (viewerSeat) => ({
      type: 'bid.submitted',
      version: room.version,
      seat,
      bid,
      state: this.toClientRoomView(room, viewerSeat),
    }));

    this.pushSystemChat(
      runtime,
      `All bids locked. ${room.seats[leadSeat].displayName} leads Trick 1.`
    );
    this.persist(runtime, 'bidding.completed', { leadSeat });
    this.broadcastPerSeat(runtime, (viewerSeat) => ({
      type: 'bidding.completed',
      version: room.version,
      leadSeat,
      state: this.toClientRoomView(room, viewerSeat),
    }));

    this.scheduleTurnAutomation(runtime);
  }

  private handlePlayCard(
    ws: WebSocket,
    runtime: RoomRuntime,
    seat: SeatIndex,
    cardId: string,
    actionId: string
  ): void {
    const { room } = runtime;
    if (room.phase !== 'PLAYING') {
      this.send(ws, {
        type: 'game.error',
        code: 'INVALID_PHASE',
        message: 'Card play is not currently active.',
        actionId,
      });
      return;
    }
    if (room.activeTurnSeat !== seat) {
      this.send(ws, {
        type: 'game.error',
        code: 'NOT_YOUR_TURN',
        message: 'It is not your turn to play a card.',
        actionId,
      });
      return;
    }
    if (room.currentTrick.some((tc) => tc.seat === seat)) {
      this.send(ws, {
        type: 'game.error',
        code: 'DUPLICATE_PLAY',
        message: 'You have already played a card in this trick.',
        actionId,
      });
      return;
    }

    const hand = room.hands[seat];
    const check = isCardLegal(hand, cardId, room.currentTrick, room.settings);
    if (!check.legal || !check.card) {
      this.send(ws, {
        type: 'game.error',
        code: 'ILLEGAL_CARD',
        message: check.reason,
        actionId,
      });
      return;
    }

    this.markAction(runtime, actionId);
    this.applyCardPlay(runtime, seat, check.card.id);
  }

  private applyCardPlay(runtime: RoomRuntime, seat: SeatIndex, cardId: string): void {
    const { room } = runtime;
    this.clearTimers(runtime);

    const cardIndex = room.hands[seat].findIndex((c) => c.id === cardId);
    if (cardIndex === -1) return;
    const [playedCard] = room.hands[seat].splice(cardIndex, 1);

    room.currentTrick.push({
      seat,
      card: playedCard,
      playedAt: Date.now(),
    });

    if (room.currentTrick.length < 4) {
      room.activeTurnSeat = nextSeat(seat);
      room.turnDeadlineAt = room.settings.turnTimerEnabled
        ? Date.now() + room.settings.turnTimerSeconds * 1000
        : null;
      this.bumpVersion(runtime);
      this.persist(runtime, 'card.played', { seat, card: playedCard });

      this.broadcastPerSeat(runtime, (viewerSeat) => ({
        type: 'card.played',
        version: room.version,
        seat,
        card: playedCard,
        state: this.toClientRoomView(room, viewerSeat),
      }));

      this.scheduleTurnAutomation(runtime);
      return;
    }

    // 4th card played -> Trick complete!
    const winnerSeat = determineTrickWinner(room.currentTrick);
    room.seats[winnerSeat].tricksWon += 1;

    const completedTrick: CompletedTrick = {
      trickNumber: room.trickNumber,
      leadSeat: room.currentTrick[0].seat,
      winnerSeat,
      cards: [...room.currentTrick],
    };

    room.completedTricks.push(completedTrick);
    room.lastCompletedTrick = completedTrick;
    room.phase = 'TRICK_COMPLETE';
    room.activeTurnSeat = null;
    room.turnDeadlineAt = null;
    this.bumpVersion(runtime);

    this.persist(runtime, 'card.played', { seat, card: playedCard });
    this.broadcastPerSeat(runtime, (viewerSeat) => ({
      type: 'card.played',
      version: room.version,
      seat,
      card: playedCard,
      state: this.toClientRoomView(room, viewerSeat),
    }));

    this.persist(runtime, 'trick.completed', completedTrick);
    this.broadcastPerSeat(runtime, (viewerSeat) => ({
      type: 'trick.completed',
      version: room.version,
      trick: completedTrick,
      state: this.toClientRoomView(room, viewerSeat),
    }));

    this.scheduleTrickResolution(runtime);
  }

  private scheduleTrickResolution(runtime: RoomRuntime): void {
    if (runtime.trickClearTimer) clearTimeout(runtime.trickClearTimer);
    runtime.trickClearTimer = setTimeout(() => {
      runtime.trickClearTimer = null;
      const { room } = runtime;
      if (room.phase !== 'TRICK_COMPLETE' || !room.lastCompletedTrick) return;

      const winnerSeat = room.lastCompletedTrick.winnerSeat;
      room.currentTrick = [];

      if (room.completedTricks.length < 13) {
        room.trickNumber += 1;
        room.phase = 'PLAYING';
        room.activeTurnSeat = winnerSeat;
        room.turnDeadlineAt = room.settings.turnTimerEnabled
          ? Date.now() + room.settings.turnTimerSeconds * 1000
          : null;
        this.bumpVersion(runtime);
        this.persist(runtime, 'game.state_sync', { nextTrick: room.trickNumber });

        this.broadcastPerSeat(runtime, (viewerSeat) => ({
          type: 'game.state_sync',
          version: room.version,
          state: this.toClientRoomView(room, viewerSeat),
        }));

        this.scheduleTurnAutomation(runtime);
        return;
      }

      // All 13 tricks completed -> Round completed!
      const results: RoundPlayerResult[] = room.seats.map((s) => {
        const bid = s.bid ?? 1;
        const roundScoreTenths = calculateRoundScoreTenths(bid, s.tricksWon);
        s.totalScoreTenths += roundScoreTenths;
        return {
          seat: s.seat,
          displayName: s.displayName,
          bid,
          tricksWon: s.tricksWon,
          roundScoreTenths,
          cumulativeScoreTenths: s.totalScoreTenths,
        };
      });

      const summary: RoundSummary = {
        roundNumber: room.currentRound,
        dealerSeat: room.dealerSeat,
        results,
      };
      room.roundHistory.push(summary);

      const isFinalRound = room.currentRound >= room.settings.rounds;
      if (isFinalRound) {
        room.phase = 'GAME_COMPLETE';
        room.winnerSeats = getWinnerSeats(room.seats);
        this.bumpVersion(runtime);
        this.pushSystemChat(
          runtime,
          `Match complete! Winner${room.winnerSeats.length > 1 ? 's' : ''}: ${room.winnerSeats
            .map((s) => room.seats[s].displayName)
            .join(' & ')}.`
        );
        this.persist(runtime, 'round.completed', summary);
        this.persist(runtime, 'game.completed', {
          winnerSeats: room.winnerSeats,
        });

        this.broadcastPerSeat(runtime, (viewerSeat) => ({
          type: 'round.completed',
          version: room.version,
          summary,
          state: this.toClientRoomView(room, viewerSeat),
        }));

        this.broadcastPerSeat(runtime, (viewerSeat) => ({
          type: 'game.completed',
          version: room.version,
          winnerSeats: room.winnerSeats,
          roundHistory: room.roundHistory,
          state: this.toClientRoomView(room, viewerSeat),
        }));
      } else {
        room.phase = 'ROUND_COMPLETE';
        this.bumpVersion(runtime);
        this.pushSystemChat(
          runtime,
          `Round ${room.currentRound} complete. Ready for Round ${room.currentRound + 1}.`
        );
        this.persist(runtime, 'round.completed', summary);

        this.broadcastPerSeat(runtime, (viewerSeat) => ({
          type: 'round.completed',
          version: room.version,
          summary,
          state: this.toClientRoomView(room, viewerSeat),
        }));
      }
    }, 1350);
  }

  private handleNextRound(
    ws: WebSocket,
    runtime: RoomRuntime,
    callerSeat: SeatIndex,
    actionId: string
  ): void {
    const { room } = runtime;
    if (room.phase !== 'ROUND_COMPLETE') {
      this.send(ws, {
        type: 'game.error',
        code: 'INVALID_PHASE',
        message: 'Next round can only be started after the round finishes.',
        actionId,
      });
      return;
    }

    // Allow host (or any connected human if host is disconnected) to advance round
    const activeHumanHostExists = room.seats.some(
      (s) => s.occupied && s.playerType === 'human' && s.isHost && s.connected
    );
    if (activeHumanHostExists && !room.seats[callerSeat].isHost) {
      this.send(ws, {
        type: 'game.error',
        code: 'NOT_HOST',
        message: 'Only the host can start the next round.',
        actionId,
      });
      return;
    }

    this.markAction(runtime, actionId);
    room.currentRound += 1;
    room.dealerSeat = nextSeat(room.dealerSeat);
    this.startRound(runtime, false);
  }

  private handleRestartGame(
    ws: WebSocket,
    runtime: RoomRuntime,
    callerSeat: SeatIndex,
    actionId: string
  ): void {
    const { room } = runtime;
    if (room.phase !== 'GAME_COMPLETE') return;
    if (!room.seats[callerSeat].isHost) {
      this.send(ws, {
        type: 'game.error',
        code: 'NOT_HOST',
        message: 'Only the host can start a new match.',
        actionId,
      });
      return;
    }

    this.markAction(runtime, actionId);
    room.currentRound = 1;
    room.dealerSeat = nextSeat(room.dealerSeat);
    room.roundHistory = [];
    room.winnerSeats = [];
    for (const s of room.seats) {
      s.totalScoreTenths = 0;
      s.bid = null;
      s.tricksWon = 0;
    }
    this.startRound(runtime, true);
  }

  private handleChatSend(
    runtime: RoomRuntime,
    seat: SeatIndex,
    text: string,
    actionId: string
  ): void {
    const { room } = runtime;
    const sender = room.seats[seat];
    this.markAction(runtime, actionId);

    const msg: ChatMessage = {
      id: generateId(),
      senderId: sender.playerId ?? `seat-${seat}`,
      senderName: sender.displayName,
      senderSeat: seat,
      text: text.trim().slice(0, 300),
      createdAt: Date.now(),
      kind: 'user',
    };

    room.chat.push(msg);
    if (room.chat.length > 100) {
      room.chat = room.chat.slice(-100);
    }
    this.bumpVersion(runtime);
    this.persist(runtime, 'chat.message', msg);

    this.broadcastAll(runtime, {
      type: 'chat.message',
      version: room.version,
      message: msg,
    });

    if (sender.playerType === 'human') {
      void this.scheduleBotChatReply(runtime, sender.displayName, msg.text);
    }
  }

  private async scheduleBotChatReply(
    runtime: RoomRuntime,
    senderName: string,
    userMessage: string
  ): Promise<void> {
    const bot = pickRespondingBot(
      runtime.room,
      userMessage,
      runtime.lastBotChatSeat
    );
    if (!bot) return;

    const seq = ++runtime.botChatSeq;
    runtime.lastBotChatSeat = bot.seat;

    this.broadcastAll(runtime, {
      type: 'player.typing',
      seat: bot.seat,
      displayName: bot.displayName,
      isTyping: true,
    });

    const minDelay = new Promise<void>((resolve) => setTimeout(resolve, 650));
    const [replyText] = await Promise.all([
      generateBotChatReply({
        room: runtime.room,
        bot,
        senderName,
        userMessage,
      }),
      minDelay,
    ]);

    this.broadcastAll(runtime, {
      type: 'player.typing',
      seat: bot.seat,
      displayName: bot.displayName,
      isTyping: false,
    });

    if (runtime.botChatSeq !== seq) return;
    const currentSeat = runtime.room.seats[bot.seat];
    if (!currentSeat.occupied || currentSeat.playerType !== 'bot') return;

    const botMsg: ChatMessage = {
      id: generateId(),
      senderId: currentSeat.playerId ?? `bot-${bot.seat}`,
      senderName: currentSeat.displayName,
      senderSeat: bot.seat,
      text: replyText.trim().slice(0, 300),
      createdAt: Date.now(),
      kind: 'user',
    };

    runtime.room.chat.push(botMsg);
    if (runtime.room.chat.length > 100) {
      runtime.room.chat = runtime.room.chat.slice(-100);
    }
    this.bumpVersion(runtime);
    this.persist(runtime, 'chat.message', botMsg);

    this.broadcastAll(runtime, {
      type: 'chat.message',
      version: runtime.room.version,
      message: botMsg,
    });
  }

  private handleTyping(
    runtime: RoomRuntime,
    seat: SeatIndex,
    isTyping: boolean
  ): void {
    const sender = runtime.room.seats[seat];
    this.broadcastAll(runtime, {
      type: 'player.typing',
      seat,
      displayName: sender.displayName,
      isTyping,
    });
  }

  private scheduleTurnAutomation(runtime: RoomRuntime): void {
    const { room } = runtime;
    if (room.activeTurnSeat === null) return;
    const activeSeat = room.activeTurnSeat;
    const player = room.seats[activeSeat];

    if (player.playerType === 'bot') {
      const delay = room.phase === 'BIDDING' ? 650 : 720;
      runtime.botTimer = setTimeout(() => {
        runtime.botTimer = null;
        this.executeBotTurn(runtime, activeSeat);
      }, delay);
      return;
    }

    if (room.settings.turnTimerEnabled && room.turnDeadlineAt) {
      const msRemaining = Math.max(500, room.turnDeadlineAt - Date.now());
      runtime.turnTimer = setTimeout(() => {
        runtime.turnTimer = null;
        this.executeTimeoutFallback(runtime, activeSeat);
      }, msRemaining);
    }
  }

  private executeBotTurn(runtime: RoomRuntime, seat: SeatIndex): void {
    const { room } = runtime;
    if (room.activeTurnSeat !== seat) return;
    const player = room.seats[seat];
    if (player.playerType !== 'bot') return;

    const ctx = {
      seat,
      hand: room.hands[seat],
      difficulty: player.botDifficulty ?? room.settings.botDifficulty,
      settings: room.settings,
      dealerSeat: room.dealerSeat,
      bids: {
        0: room.seats[0].bid,
        1: room.seats[1].bid,
        2: room.seats[2].bid,
        3: room.seats[3].bid,
      } as Record<SeatIndex, number | null>,
      tricksWon: {
        0: room.seats[0].tricksWon,
        1: room.seats[1].tricksWon,
        2: room.seats[2].tricksWon,
        3: room.seats[3].tricksWon,
      } as Record<SeatIndex, number>,
      completedTricks: room.completedTricks,
      currentTrick: room.currentTrick,
      seatCardCounts: {
        0: room.hands[0].length,
        1: room.hands[1].length,
        2: room.hands[2].length,
        3: room.hands[3].length,
      } as Record<SeatIndex, number>,
    };

    if (room.phase === 'BIDDING') {
      const bid = chooseBotBid(ctx);
      this.applyBid(runtime, seat, bid);
    } else if (room.phase === 'PLAYING') {
      const card = chooseBotCard(ctx);
      this.applyCardPlay(runtime, seat, card.id);
    }
  }

  private executeTimeoutFallback(runtime: RoomRuntime, seat: SeatIndex): void {
    const { room } = runtime;
    if (room.activeTurnSeat !== seat) return;

    if (room.phase === 'BIDDING') {
      this.pushSystemChat(
        runtime,
        `${room.seats[seat].displayName} timed out — auto-bid 1.`
      );
      this.applyBid(runtime, seat, 1);
    } else if (room.phase === 'PLAYING') {
      const { legalCards } = getLegalMoves(
        room.hands[seat],
        room.currentTrick,
        room.settings
      );
      if (legalCards.length > 0) {
        const chosen = [...legalCards].sort((a, b) => a.rank - b.rank)[0];
        this.pushSystemChat(
          runtime,
          `${room.seats[seat].displayName} timed out — auto-played ${formatCardLabel(
            chosen
          )}.`
        );
        this.applyCardPlay(runtime, seat, chosen.id);
      }
    }
  }

  private assignBotToSeat(
    room: RoomState,
    seat: SeatIndex,
    difficulty: BotDifficulty
  ): string {
    const usedNames = new Set(room.seats.filter((s) => s.occupied).map((s) => s.displayName));
    const baseName =
      BOT_NAMES.find((n) => !usedNames.has(`${n} Bot`)) ?? `Bot ${seat + 1}`;
    const botName = baseName.endsWith('Bot') ? baseName : `${baseName} Bot`;

    room.seats[seat] = {
      seat,
      occupied: true,
      playerId: `bot-${seat}-${generateId().slice(0, 6)}`,
      displayName: botName,
      playerType: 'bot',
      botDifficulty: difficulty,
      isHost: false,
      isReady: true,
      connected: true,
      lastSeenAt: Date.now(),
      bid: null,
      tricksWon: 0,
      totalScoreTenths: 0,
    };
    return botName;
  }

  private ensureActiveHost(runtime: RoomRuntime): void {
    const { room } = runtime;
    const connectedHost = room.seats.find(
      (s) => s.occupied && s.playerType === 'human' && s.isHost && s.connected
    );
    if (connectedHost) return;

    const firstConnectedHuman = room.seats.find(
      (s) => s.occupied && s.playerType === 'human' && s.connected
    );
    if (firstConnectedHuman) {
      for (const s of room.seats) s.isHost = false;
      firstConnectedHuman.isHost = true;
    }
  }

  private attachSocket(
    ws: WebSocket,
    runtime: RoomRuntime,
    seat: SeatIndex,
    playerId: string,
    sessionToken: string
  ): void {
    runtime.sockets.set(ws, { seat, playerId, sessionToken });
    this.socketToRoom.set(ws, runtime.room.roomCode);
  }

  private clearTimers(runtime: RoomRuntime): void {
    if (runtime.botTimer) {
      clearTimeout(runtime.botTimer);
      runtime.botTimer = null;
    }
    if (runtime.turnTimer) {
      clearTimeout(runtime.turnTimer);
      runtime.turnTimer = null;
    }
  }

  private bumpVersion(runtime: RoomRuntime): void {
    runtime.room.version += 1;
    runtime.room.updatedAt = Date.now();
  }

  private markAction(runtime: RoomRuntime, actionId: string): void {
    runtime.recentActionIds.add(actionId);
    if (runtime.recentActionIds.size > 400) {
      const first = runtime.recentActionIds.values().next().value;
      if (first) runtime.recentActionIds.delete(first);
    }
    roomStore.markActionProcessed(runtime.room.roomCode, actionId);
  }

  private pushSystemChat(runtime: RoomRuntime, text: string): void {
    runtime.room.chat.push({
      id: generateId(),
      senderId: 'system',
      senderName: 'Table',
      senderSeat: null,
      text,
      createdAt: Date.now(),
      kind: 'system',
    });
    if (runtime.room.chat.length > 100) {
      runtime.room.chat = runtime.room.chat.slice(-100);
    }
  }

  private persist(runtime: RoomRuntime, eventType: string, payload: unknown): void {
    roomStore.saveRoom({
      room: runtime.room,
      seatSessions: runtime.seatSessions,
    });
    roomStore.appendEvent(
      runtime.room.roomCode,
      runtime.room.version,
      eventType,
      payload
    );
    void pubSubBus.publish(`room:${runtime.room.roomCode}`, {
      eventType,
      version: runtime.room.version,
      payload,
    });
  }

  private toClientRoomView(
    room: RoomState,
    viewerSeat: SeatIndex | null
  ): ClientRoomView {
    const publicSeats = room.seats.map((s) => ({
      ...s,
      cardCount: room.hands[s.seat]?.length ?? 0,
    })) as [PublicSeatView, PublicSeatView, PublicSeatView, PublicSeatView];

    const myHand = viewerSeat !== null ? [...(room.hands[viewerSeat] ?? [])] : [];
    let legalCardIds: string[] = [];
    let legalReason: string | null = null;

    if (
      viewerSeat !== null &&
      room.phase === 'PLAYING' &&
      room.activeTurnSeat === viewerSeat
    ) {
      const legal = getLegalMoves(myHand, room.currentTrick, room.settings);
      legalCardIds = legal.legalCards.map((c) => c.id);
      legalReason = legal.reason;
    }

    return {
      roomCode: room.roomCode,
      roomName: room.roomName,
      phase: room.phase,
      version: room.version,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      settings: room.settings,
      seats: publicSeats,
      mySeat: viewerSeat,
      myPlayerId: viewerSeat !== null ? room.seats[viewerSeat].playerId : null,
      myHand,
      legalCardIds,
      legalReason,
      currentRound: room.currentRound,
      dealerSeat: room.dealerSeat,
      activeTurnSeat: room.activeTurnSeat,
      turnDeadlineAt: room.turnDeadlineAt,
      currentTrick: room.currentTrick,
      trickNumber: room.trickNumber,
      lastCompletedTrick: room.lastCompletedTrick,
      completedTricksCount: room.completedTricks.length,
      roundHistory: room.roundHistory,
      winnerSeats: room.winnerSeats,
      chat: room.chat,
    };
  }

  private broadcastPerSeat(
    runtime: RoomRuntime,
    buildEvent: (viewerSeat: SeatIndex | null) => ServerEvent,
    excludeWs?: WebSocket
  ): void {
    for (const [clientWs, info] of runtime.sockets.entries()) {
      if (excludeWs && clientWs === excludeWs) continue;
      this.send(clientWs, buildEvent(info.seat));
    }
  }

  private broadcastAll(runtime: RoomRuntime, event: ServerEvent): void {
    for (const clientWs of runtime.sockets.keys()) {
      this.send(clientWs, event);
    }
  }

  private send(ws: WebSocket, event: ServerEvent): void {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(event));
    }
  }
}

export const roomManager = new RoomManager();
