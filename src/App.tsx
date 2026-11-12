import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useShallow } from 'zustand/react/shallow';
import { GameTable } from './components/GameTable.tsx';
import { HomeView } from './components/HomeView.tsx';
import { InviteJoinView } from './components/InviteJoinView.tsx';
import { LobbyView } from './components/LobbyView.tsx';
import { TooltipProvider } from './components/ui/tooltip.tsx';
import { SeatIndex } from './engine/types.ts';
import { soundFx } from './lib/sound.ts';
import { useThemePreference } from './lib/theme.ts';
import {
  getSavedSessionToken,
  saveSessionToken,
  useGameStore,
} from './store/gameStore.ts';

const queryClient = new QueryClient();

function parseRoomCodeFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/room\/([A-Za-z0-9]{4,12})\/?$/);
  return match ? match[1].toUpperCase() : null;
}

function LobbyBridge({ onLeaveRoom }: { onLeaveRoom: () => void }) {
  const {
    room,
    typingUsers,
    setReady,
    selectSeat,
    addBot,
    removeBot,
    updateSettings,
    transferHost,
    startGame,
    sendChat,
    sendTyping,
  } = useGameStore(
    useShallow((s) => ({
      room: s.room,
      typingUsers: s.typingUsers,
      setReady: s.setReady,
      selectSeat: s.selectSeat,
      addBot: s.addBot,
      removeBot: s.removeBot,
      updateSettings: s.updateSettings,
      transferHost: s.transferHost,
      startGame: s.startGame,
      sendChat: s.sendChat,
      sendTyping: s.sendTyping,
    }))
  );

  if (!room) return null;

  return (
    <LobbyView
      room={room}
      typingUsers={typingUsers}
      onSetReady={setReady}
      onSelectSeat={selectSeat}
      onAddBot={addBot}
      onRemoveBot={removeBot}
      onUpdateSettings={updateSettings}
      onTransferHost={transferHost}
      onStartGame={startGame}
      onSendChat={sendChat}
      onTyping={sendTyping}
      onLeaveRoom={onLeaveRoom}
    />
  );
}

function AppContent() {
  const [routeRoomCode, setRouteRoomCode] = useState<string | null>(() =>
    parseRoomCodeFromPath(window.location.pathname)
  );

  // Subscribe ONLY to phase/connection primitives so active gameplay never re-renders AppContent!
  const { hasRoom, roomPhase, connectionStatus, lastError } = useGameStore(
    useShallow((s) => ({
      hasRoom: s.room !== null,
      roomPhase: s.room?.phase ?? null,
      connectionStatus: s.connectionStatus,
      lastError: s.lastError,
    }))
  );

  useEffect(() => {
    const onPopState = () => {
      const code = parseRoomCodeFromPath(window.location.pathname);
      setRouteRoomCode(code);
      if (!code) {
        useGameStore.getState().leaveRoom();
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Auto-reconnect if navigating directly to /room/:code with a saved sessionToken
  useEffect(() => {
    if (routeRoomCode && !hasRoom && connectionStatus === 'disconnected') {
      const savedToken = getSavedSessionToken(routeRoomCode);
      if (savedToken) {
        useGameStore.getState().connectToRoom({
          roomCode: routeRoomCode,
          sessionToken: savedToken,
        });
      }
    }
  }, [routeRoomCode, hasRoom, connectionStatus]);

  const navigateToRoom = (code: string) => {
    const upper = code.toUpperCase();
    const targetPath = `/room/${upper}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
    setRouteRoomCode(upper);
  };

  const navigateHome = () => {
    useGameStore.getState().leaveRoom();
    if (window.location.pathname !== '/') {
      window.history.pushState({}, '', '/');
    }
    setRouteRoomCode(null);
  };

  // 1. Active room loaded via WebSocket
  if (hasRoom) {
    if (roomPhase === 'LOBBY') {
      return <LobbyBridge onLeaveRoom={navigateHome} />;
    }
    return <GameTable onLeaveRoom={navigateHome} />;
  }

  // 2. Direct /room/:code link — either connecting or prompting display name + seat
  if (routeRoomCode) {
    if (
      (connectionStatus === 'connecting' || connectionStatus === 'reconnecting') &&
      !lastError
    ) {
      return (
        <div className="min-h-screen bg-surface-muted text-ink flex items-center justify-center p-6">
          <div className="rounded-xl border border-line bg-surface px-8 py-6 text-center space-y-2 shadow-sm">
            <p className="font-display text-xl font-semibold text-ink">
              Connecting to Room {routeRoomCode}…
            </p>
            <p className="text-sm text-ink-muted">
              Synchronizing authoritative table state
            </p>
          </div>
        </div>
      );
    }

    return (
      <InviteJoinView
        roomCode={routeRoomCode}
        onJoin={({ roomCode, displayName, preferredSeat }) => {
          soundFx.unlock();
          useGameStore.getState().connectToRoom({
            roomCode,
            displayName,
            preferredSeat: preferredSeat as SeatIndex | undefined,
          });
        }}
        onBackHome={navigateHome}
      />
    );
  }

  // 3. Home Landing
  return (
    <HomeView
      onRoomCreated={({ roomCode, sessionToken, displayName }) => {
        soundFx.unlock();
        saveSessionToken(roomCode, sessionToken);
        navigateToRoom(roomCode);
        useGameStore.getState().connectToRoom({
          roomCode,
          displayName,
          sessionToken,
        });
      }}
      onJoinCode={(code, displayName) => {
        soundFx.unlock();
        navigateToRoom(code);
        useGameStore.getState().connectToRoom({
          roomCode: code,
          displayName,
        });
      }}
    />
  );
}

export default function App() {
  const themePreference = useThemePreference();
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContent />
        <Toaster theme={themePreference} position="top-center" richColors />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
