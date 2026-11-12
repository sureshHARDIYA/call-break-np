import { create } from 'zustand';
import { toast } from 'sonner';
import { ClientCommand, ServerEvent } from '../engine/protocol.ts';
import {
  BotDifficulty,
  ClientRoomView,
  RoomSettings,
  SeatIndex,
} from '../engine/types.ts';
import { soundFx } from '../lib/sound.ts';

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting';

interface TypingEntry {
  seat: SeatIndex;
  displayName: string;
  expiresAt: number;
}

interface GameStoreState {
  roomCode: string | null;
  sessionToken: string | null;
  connectionStatus: ConnectionStatus;
  room: ClientRoomView | null;
  typingUsers: Record<number, TypingEntry>;
  unreadChatCount: number;
  chatOpen: boolean;
  muted: boolean;
  lastError: string | null;

  // Actions
  connectToRoom: (params: {
    roomCode: string;
    displayName?: string;
    sessionToken?: string;
    preferredSeat?: SeatIndex;
  }) => void;
  leaveRoom: () => void;
  setChatOpen: (open: boolean) => void;
  toggleMute: () => void;
  clearError: () => void;

  // Game Commands
  setReady: (ready: boolean) => void;
  selectSeat: (seat: SeatIndex) => void;
  addBot: (seat: SeatIndex, difficulty?: BotDifficulty) => void;
  removeBot: (seat: SeatIndex) => void;
  updateSettings: (settings: Partial<RoomSettings>) => void;
  transferHost: (targetSeat: SeatIndex) => void;
  startGame: () => void;
  submitBid: (bid: number) => void;
  playCard: (cardId: string) => void;
  nextRound: () => void;
  restartGame: () => void;
  sendChat: (text: string) => void;
  sendTyping: (isTyping: boolean) => void;
  requestSync: () => void;
}

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let typingCleanupTimer: ReturnType<typeof setInterval> | null = null;
let reconnectAttempt = 0;
let intentionalClose = false;
let pendingJoinParams: {
  roomCode: string;
  displayName?: string;
  sessionToken?: string;
  preferredSeat?: SeatIndex;
} | null = null;
let pendingCommands: ClientCommand[] = [];

function makeActionId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getSavedSessionToken(roomCode: string): string | null {
  try {
    return localStorage.getItem(`cb_session_${roomCode.toUpperCase()}`);
  } catch {
    return null;
  }
}

export function saveSessionToken(roomCode: string, token: string): void {
  try {
    localStorage.setItem(`cb_session_${roomCode.toUpperCase()}`, token);
  } catch {
    // Ignore storage quota errors
  }
}

export function clearSessionToken(roomCode: string): void {
  try {
    localStorage.removeItem(`cb_session_${roomCode.toUpperCase()}`);
  } catch {
    // Ignore
  }
}

export function getSavedDisplayName(): string {
  try {
    return localStorage.getItem('cb_display_name') || '';
  } catch {
    return '';
  }
}

export function saveDisplayName(name: string): void {
  try {
    localStorage.setItem('cb_display_name', name);
  } catch {
    // Ignore
  }
}

function flushOrQueueCommand(
  cmd: ClientCommand,
  onImmediateReconnect: () => void
): boolean {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(cmd));
    return true;
  }

  if (pendingJoinParams && !intentionalClose) {
    if (pendingCommands.length < 10) {
      pendingCommands.push(cmd);
    }
    if (!socket || socket.readyState === WebSocket.CLOSED || socket.readyState === WebSocket.CLOSING) {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      reconnectAttempt = 0;
      onImmediateReconnect();
    }
    toast.message('Reconnecting to table…');
    return false;
  }

  toast.error('Not connected to table. Please rejoin the room.');
  return false;
}

function cleanupSocket() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (typingCleanupTimer) {
    clearInterval(typingCleanupTimer);
    typingCleanupTimer = null;
  }
  if (socket) {
    socket.onopen = null;
    socket.onmessage = null;
    socket.onclose = null;
    socket.onerror = null;
    if (
      socket.readyState === WebSocket.OPEN ||
      socket.readyState === WebSocket.CONNECTING
    ) {
      socket.close();
    }
    socket = null;
  }
}

export const useGameStore = create<GameStoreState>((set, get) => {
  const openSocket = () => {
    if (!pendingJoinParams) return;
    cleanupSocket();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    set({
      connectionStatus: reconnectAttempt > 0 ? 'reconnecting' : 'connecting',
      lastError: null,
    });

    const ws = new WebSocket(wsUrl);
    socket = ws;

    ws.onopen = () => {
      reconnectAttempt = 0;
      set({ connectionStatus: 'connected' });
      const params = pendingJoinParams;
      if (!params) return;

      const storedToken =
        params.sessionToken ?? getSavedSessionToken(params.roomCode) ?? undefined;

      ws.send(
        JSON.stringify({
          type: 'room.join',
          actionId: makeActionId(),
          roomCode: params.roomCode,
          displayName: params.displayName,
          sessionToken: storedToken,
          preferredSeat: params.preferredSeat,
        })
      );

      heartbeatTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
        }
      }, 15000);

      typingCleanupTimer = setInterval(() => {
        const now = Date.now();
        const current = get().typingUsers;
        const entries = Object.entries(current);
        if (entries.length === 0) return;
        let changed = false;
        const next: Record<number, TypingEntry> = {};
        for (const [k, entry] of entries) {
          if (entry.expiresAt > now) {
            next[Number(k)] = entry;
          } else {
            changed = true;
          }
        }
        if (changed) {
          set({ typingUsers: next });
        }
      }, 1000);
    };

    ws.onmessage = (event) => {
      let data: ServerEvent;
      try {
        data = JSON.parse(event.data) as ServerEvent;
      } catch {
        return;
      }

      if (data.type === 'pong') return;

      if (data.type === 'game.error') {
        set({ lastError: data.message });
        toast.error(data.message);
        if (
          data.code === 'ROOM_NOT_FOUND' ||
          data.code === 'ROOM_FULL' ||
          data.code === 'GAME_IN_PROGRESS'
        ) {
          // Do not keep auto-reconnecting endlessly on terminal join errors
          intentionalClose = true;
        }
        return;
      }

      if (data.type === 'player.typing') {
        set((state) => {
          const next = { ...state.typingUsers };
          if (data.isTyping) {
            next[data.seat] = {
              seat: data.seat,
              displayName: data.displayName,
              expiresAt: Date.now() + 3200,
            };
          } else {
            delete next[data.seat];
          }
          return { typingUsers: next };
        });
        return;
      }

      if (data.type === 'chat.message') {
        set((state) => {
          if (!state.room) return state;
          // Idempotent check against duplicate chat IDs
          if (state.room.chat.some((m) => m.id === data.message.id)) {
            return state;
          }
          const shouldIncrementUnread =
            !state.chatOpen &&
            data.message.kind === 'user' &&
            data.message.senderSeat !== state.room.mySeat;
          return {
            room: {
              ...state.room,
              version: Math.max(state.room.version, data.version),
              chat: [...state.room.chat, data.message],
            },
            unreadChatCount: shouldIncrementUnread
              ? state.unreadChatCount + 1
              : state.unreadChatCount,
          };
        });
        return;
      }

      // Events carrying full sanitized ClientRoomView state
      if ('state' in data && data.state) {
        const incoming = data.state;
        const prevRoom = get().room;

        // Ignore stale or duplicate same-version updates (except explicit state_sync or room.joined)
        if (
          prevRoom &&
          prevRoom.roomCode === incoming.roomCode &&
          data.type !== 'room.joined' &&
          data.type !== 'game.state_sync' &&
          incoming.version <= prevRoom.version
        ) {
          return;
        }

        if (data.type === 'room.joined') {
          saveSessionToken(data.roomCode, data.sessionToken);
          if (pendingJoinParams) {
            pendingJoinParams.sessionToken = data.sessionToken;
          }
          set({
            roomCode: data.roomCode,
            sessionToken: data.sessionToken,
            room: incoming,
            lastError: null,
          });
          if (pendingCommands.length > 0 && socket && socket.readyState === WebSocket.OPEN) {
            const queued = pendingCommands;
            pendingCommands = [];
            for (const qCmd of queued) {
              socket.send(JSON.stringify(qCmd));
            }
          }
        } else {
          set({ room: incoming, lastError: null });
        }

        // Tactile sound cues
        if (
          data.type === 'game.started' ||
          (data.type === 'cards.dealt' &&
            (!prevRoom || incoming.currentRound !== prevRoom.currentRound))
        ) {
          soundFx.playCardDeal();
        } else if (data.type === 'bid.submitted') {
          soundFx.playBidLock();
        } else if (data.type === 'card.played') {
          const leadSuit = incoming.currentTrick[0]?.card.suit;
          if (
            data.card.suit === 'spades' &&
            leadSuit &&
            leadSuit !== 'spades'
          ) {
            soundFx.playTrumpCut();
          } else {
            soundFx.playCardSnap();
          }
        } else if (data.type === 'trick.completed') {
          soundFx.playTrickWin();
        } else if (data.type === 'round.completed') {
          const mySeat = incoming.mySeat;
          const myRes =
            mySeat !== null
              ? data.summary.results.find((r) => r.seat === mySeat)
              : null;
          if (myRes && myRes.roundScoreTenths < 0) {
            soundFx.playRoundLose();
          } else {
            soundFx.playRoundComplete();
          }
        } else if (data.type === 'game.completed') {
          const mySeat = incoming.mySeat;
          if (mySeat !== null && !data.winnerSeats.includes(mySeat)) {
            soundFx.playRoundLose();
          } else {
            soundFx.playRoundComplete();
          }
        } else if (
          incoming.activeTurnSeat !== null &&
          incoming.activeTurnSeat === incoming.mySeat &&
          prevRoom?.activeTurnSeat !== incoming.mySeat
        ) {
          soundFx.playTurnPrompt();
        }
      }
    };

    ws.onclose = () => {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      if (intentionalClose) {
        set({ connectionStatus: 'disconnected' });
        return;
      }
      const delay = Math.min(8000, 600 * Math.pow(1.6, reconnectAttempt));
      reconnectAttempt += 1;
      set({ connectionStatus: 'reconnecting' });
      reconnectTimer = setTimeout(() => {
        openSocket();
      }, delay);
    };

    ws.onerror = () => {
      // Handled by onclose reconnect flow
    };
  };

  return {
    roomCode: null,
    sessionToken: null,
    connectionStatus: 'disconnected',
    room: null,
    typingUsers: {},
    unreadChatCount: 0,
    chatOpen: false,
    muted: false,
    lastError: null,

    connectToRoom: (params) => {
      intentionalClose = false;
      reconnectAttempt = 0;
      pendingCommands = [];
      const code = params.roomCode.trim().toUpperCase();
      pendingJoinParams = { ...params, roomCode: code };
      set({ roomCode: code, lastError: null });
      openSocket();
    },

    leaveRoom: () => {
      intentionalClose = true;
      pendingJoinParams = null;
      pendingCommands = [];
      cleanupSocket();
      set({
        roomCode: null,
        sessionToken: null,
        connectionStatus: 'disconnected',
        room: null,
        typingUsers: {},
        unreadChatCount: 0,
        lastError: null,
      });
    },

    setChatOpen: (open) =>
      set((state) => ({
        chatOpen: open,
        unreadChatCount: open ? 0 : state.unreadChatCount,
      })),

    toggleMute: () =>
      set((state) => {
        const next = !state.muted;
        soundFx.muted = next;
        return { muted: next };
      }),

    clearError: () => set({ lastError: null }),

    setReady: (ready) => {
      flushOrQueueCommand(
        { type: 'player.ready', actionId: makeActionId(), ready },
        openSocket
      );
    },

    selectSeat: (seat) => {
      flushOrQueueCommand(
        { type: 'seat.select', actionId: makeActionId(), seat },
        openSocket
      );
    },

    addBot: (seat, difficulty) => {
      flushOrQueueCommand(
        {
          type: 'bot.add',
          actionId: makeActionId(),
          seat,
          difficulty,
        },
        openSocket
      );
    },

    removeBot: (seat) => {
      flushOrQueueCommand(
        { type: 'bot.remove', actionId: makeActionId(), seat },
        openSocket
      );
    },

    updateSettings: (settings) => {
      flushOrQueueCommand(
        {
          type: 'room.update_settings',
          actionId: makeActionId(),
          settings,
        },
        openSocket
      );
    },

    transferHost: (targetSeat) => {
      flushOrQueueCommand(
        {
          type: 'host.transfer',
          actionId: makeActionId(),
          targetSeat,
        },
        openSocket
      );
    },

    startGame: () => {
      soundFx.unlock();
      flushOrQueueCommand(
        { type: 'game.start', actionId: makeActionId() },
        openSocket
      );
    },

    submitBid: (bid) => {
      soundFx.unlock();
      const version = get().room?.version;
      flushOrQueueCommand(
        {
          type: 'bid.submit',
          actionId: makeActionId(),
          expectedVersion: version,
          bid,
        },
        openSocket
      );
    },

    playCard: (cardId) => {
      soundFx.unlock();
      const version = get().room?.version;
      flushOrQueueCommand(
        {
          type: 'card.play',
          actionId: makeActionId(),
          expectedVersion: version,
          cardId,
        },
        openSocket
      );
    },

    nextRound: () => {
      soundFx.unlock();
      flushOrQueueCommand(
        { type: 'round.next', actionId: makeActionId() },
        openSocket
      );
    },

    restartGame: () => {
      soundFx.unlock();
      flushOrQueueCommand(
        { type: 'game.restart', actionId: makeActionId() },
        openSocket
      );
    },

    sendChat: (text) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      flushOrQueueCommand(
        {
          type: 'chat.send',
          actionId: makeActionId(),
          text: trimmed,
        },
        openSocket
      );
    },

    sendTyping: (isTyping) => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'player.typing', isTyping }));
      }
    },

    requestSync: () => {
      const version = get().room?.version;
      flushOrQueueCommand(
        {
          type: 'game.request_sync',
          lastKnownVersion: version,
        },
        openSocket
      );
    },
  };
});
