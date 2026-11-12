import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Bot,
  Check,
  Copy,
  Crown,
  LogOut,
  MessageSquare,
  Play,
  Settings,
  Share2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';
import { BotDifficulty, ClientRoomView, SeatIndex } from '../engine/types.ts';
import { cn } from '../lib/utils.ts';
import { useGameStore } from '../store/gameStore.ts';
import { ChatPanel } from './ChatPanel.tsx';
import { LobbySettingsDialog, summarizeSettings } from './LobbySettingsDialog.tsx';
import { Logo } from './Logo.tsx';
import { preloadDeckAssets } from './PlayingCard.tsx';
import { RulesModal } from './RulesModal.tsx';
import { getInitials } from './seatAvatar.ts';
import { ThemeToggle } from './ThemeToggle.tsx';
import { Button } from './ui/button.tsx';

interface LobbyViewProps {
  room: ClientRoomView;
  typingUsers: Record<number, { seat: SeatIndex; displayName: string }>;
  onSetReady: (ready: boolean) => void;
  onSelectSeat: (seat: SeatIndex) => void;
  onAddBot: (seat: SeatIndex, difficulty?: BotDifficulty) => void;
  onRemoveBot: (seat: SeatIndex) => void;
  onUpdateSettings: (partial: Partial<ClientRoomView['settings']>) => void;
  onTransferHost: (seat: SeatIndex) => void;
  onStartGame: () => void;
  onSendChat: (text: string) => void;
  onTyping: (isTyping: boolean) => void;
  onLeaveRoom: () => void;
}

const TOTAL_SEATS = 4;
const COPIED_FEEDBACK_MS = 2000;

type Seat = ClientRoomView['seats'][number];

function seatStatus(seat: Seat, fallbackDifficulty: BotDifficulty): string {
  if (!seat.occupied) return 'Open seat';
  if (seat.playerType === 'bot') {
    return `Bot · ${seat.botDifficulty ?? fallbackDifficulty}`;
  }
  if (!seat.connected) return 'Disconnected';
  return seat.isReady ? 'Ready' : 'Not ready';
}

const SeatCard: React.FC<{
  seat: Seat;
  isMe: boolean;
  isHost: boolean;
  botDifficulty: BotDifficulty;
  onSetReady: (ready: boolean) => void;
  onSelectSeat: (seat: SeatIndex) => void;
  onAddBot: (seat: SeatIndex, difficulty?: BotDifficulty) => void;
  onRemoveBot: (seat: SeatIndex) => void;
  onTransferHost: (seat: SeatIndex) => void;
}> = ({
  seat,
  isMe,
  isHost,
  botDifficulty,
  onSetReady,
  onSelectSeat,
  onAddBot,
  onRemoveBot,
  onTransferHost,
}) => {
  const isBot = seat.occupied && seat.playerType === 'bot';
  const isReadyHuman = seat.occupied && !isBot && seat.connected && seat.isReady;

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2.5 rounded-xl border px-3 py-5 text-center transition-colors',
        !seat.occupied && 'border-dashed border-line-strong',
        seat.occupied && (isMe ? 'border-brand-ink bg-tint' : 'border-line bg-surface')
      )}
    >
      <div
        className={cn(
          'flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold',
          !seat.occupied && 'bg-surface-muted text-ink-muted',
          seat.occupied &&
            (isBot ? 'border border-brand-ink/25 bg-tint text-brand-ink' : 'bg-brand text-white')
        )}
      >
        {!seat.occupied ? (
          seat.seat + 1
        ) : isBot ? (
          <Bot className="h-6 w-6" />
        ) : (
          getInitials(seat.displayName)
        )}
      </div>

      <div className="w-full min-w-0">
        {seat.occupied && (
          <div className="flex items-center justify-center gap-1.5">
            <span className="truncate text-base font-semibold text-ink">
              {seat.displayName}
              {isMe ? ' (You)' : ''}
            </span>
            {seat.isHost && (
              <Crown className="h-4 w-4 shrink-0 text-brand-ink" aria-label="Room host" />
            )}
          </div>
        )}
        <div
          className={cn(
            'text-sm capitalize',
            isReadyHuman ? 'font-semibold text-positive' : 'text-ink-muted'
          )}
        >
          {seatStatus(seat, botDifficulty)}
        </div>
      </div>

      {!seat.occupied && (
        <div className="flex flex-col items-center gap-1">
          {isHost && (
            <Button
              variant="outline"
              size="sm"
              className="h-11"
              onClick={() => onAddBot(seat.seat, botDifficulty)}
            >
              <Bot className="h-4 w-4 text-brand-ink" />
              Add bot
            </Button>
          )}
          <button
            type="button"
            onClick={() => onSelectSeat(seat.seat)}
            className="min-h-9 px-2 text-sm font-medium text-ink-muted underline-offset-2 hover:text-brand-ink hover:underline cursor-pointer"
          >
            Sit here
          </button>
        </div>
      )}

      {seat.occupied && isMe && (
        <Button
          variant={seat.isReady ? 'secondary' : 'default'}
          size="sm"
          className="h-11"
          onClick={() => onSetReady(!seat.isReady)}
        >
          {seat.isReady ? (
            <>
              <Check className="h-4 w-4" />
              Ready
            </>
          ) : (
            'Mark ready'
          )}
        </Button>
      )}

      {isBot && isHost && (
        <button
          type="button"
          onClick={() => onRemoveBot(seat.seat)}
          className="min-h-9 px-2 text-sm font-medium text-danger-ink underline-offset-2 hover:underline cursor-pointer"
        >
          Remove
        </button>
      )}

      {seat.occupied && !isMe && !isBot && isHost && (
        <button
          type="button"
          onClick={() => onTransferHost(seat.seat)}
          className="min-h-9 px-2 text-sm font-medium text-ink-muted underline-offset-2 hover:text-brand-ink hover:underline cursor-pointer"
        >
          Make host
        </button>
      )}
    </div>
  );
};

export const LobbyView: React.FC<LobbyViewProps> = ({
  room,
  typingUsers,
  onSetReady,
  onSelectSeat,
  onAddBot,
  onRemoveBot,
  onUpdateSettings,
  onTransferHost,
  onStartGame,
  onSendChat,
  onTyping,
  onLeaveRoom,
}) => {
  const [copied, setCopied] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { chatOpen, unreadChatCount } = useGameStore(
    useShallow((s) => ({ chatOpen: s.chatOpen, unreadChatCount: s.unreadChatCount }))
  );

  useEffect(() => {
    preloadDeckAssets();
    // Chat starts collapsed on the table too, whatever its state was here.
    return () => useGameStore.getState().setChatOpen(false);
  }, []);

  const mySeatObj = room.mySeat !== null ? room.seats[room.mySeat] : null;
  const isHost = Boolean(mySeatObj?.isHost);
  const occupiedCount = room.seats.filter((s) => s.occupied).length;
  const openSeats = TOTAL_SEATS - occupiedCount;
  const allOccupied = openSeats === 0;

  const inviteUrl = `${window.location.origin}/room/${room.roomCode}`;

  const headline = !allOccupied
    ? `Waiting for ${openSeats} more ${openSeats === 1 ? 'player' : 'players'}`
    : isHost
    ? 'Everyone is seated. Start when ready.'
    : 'Waiting for the host to start';

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast.success('Invite link copied to clipboard');
      setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    } catch {
      toast.error('Could not copy link automatically');
    }
  };

  const handleNativeShare = async () => {
    if (!navigator.share) {
      await handleCopyInvite();
      return;
    }
    try {
      await navigator.share({
        title: `Join ${room.roomName} — Call Break`,
        text: `Join my Call Break table (Room ${room.roomCode})`,
        url: inviteUrl,
      });
    } catch {
      // The player closed the share sheet; nothing to do.
    }
  };

  const handleFillBots = () => {
    for (const s of room.seats) {
      if (!s.occupied) onAddBot(s.seat, room.settings.botDifficulty);
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-8">
          <Logo />

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRulesOpen(true)}
              aria-label="Rules and scoring"
            >
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Rules</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSettingsOpen(true)}
              aria-label="Match settings"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </Button>
            <ThemeToggle variant="compact" />
            <Button variant="outline" size="sm" onClick={onLeaveRoom} aria-label="Leave room">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Leave</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-7 px-4 pb-28 pt-8 sm:px-8 sm:pt-10">
        <div className="space-y-1.5">
          <p className="text-sm text-ink-muted">
            {room.roomName} · Code{' '}
            <span className="font-mono font-semibold text-brand-ink">{room.roomCode}</span>
          </p>
          <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">{headline}</h1>
        </div>

        {/* Invite */}
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-4">
          <span className="min-w-0 flex-[1_1_240px] truncate font-mono text-sm text-ink-2">
            {inviteUrl.replace(/^https?:\/\//, '')}
          </span>
          <Button onClick={handleCopyInvite}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied' : 'Copy invite link'}
          </Button>
          <Button variant="outline" size="icon" onClick={handleNativeShare} aria-label="Share invite">
            <Share2 className="h-4 w-4 text-brand-ink" />
          </Button>
          {isHost && !allOccupied && (
            <Button variant="secondary" onClick={handleFillBots}>
              <Bot className="h-4 w-4" />
              Fill empty seats with bots
            </Button>
          )}
        </div>

        {/* Seats */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {room.seats.map((seat) => (
            <SeatCard
              key={seat.seat}
              seat={seat}
              isMe={seat.seat === room.mySeat}
              isHost={isHost}
              botDifficulty={room.settings.botDifficulty}
              onSetReady={onSetReady}
              onSelectSeat={onSelectSeat}
              onAddBot={onAddBot}
              onRemoveBot={onRemoveBot}
              onTransferHost={onTransferHost}
            />
          ))}
        </div>

        {/* Settings summary + start */}
        <div className="flex flex-col gap-4 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-[15px] text-ink-2">{summarizeSettings(room.settings)}</p>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="min-h-9 text-sm font-semibold text-brand-ink underline-offset-2 hover:underline cursor-pointer"
            >
              {isHost ? 'Change settings' : 'View settings'}
            </button>
          </div>
          {isHost ? (
            <Button
              size="lg"
              disabled={!allOccupied}
              onClick={onStartGame}
              className="h-13 sm:min-w-[220px]"
            >
              <Play className="h-4 w-4" />
              {allOccupied ? 'Start match' : `Start match · needs ${TOTAL_SEATS} players`}
            </Button>
          ) : (
            <p className="text-sm text-ink-muted">The host starts the match.</p>
          )}
        </div>
      </main>

      {/* Chat: collapsed to a button until opened */}
      {chatOpen ? (
        <div className="fixed bottom-4 right-4 z-40 h-[min(520px,calc(100dvh-6rem))] w-[calc(100%-2rem)] max-w-sm shadow-2xl">
          <ChatPanel
            messages={room.chat}
            mySeat={room.mySeat}
            typingUsers={typingUsers}
            onSendMessage={onSendChat}
            onTyping={onTyping}
            onClose={() => useGameStore.getState().setChatOpen(false)}
            className="h-full"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => useGameStore.getState().setChatOpen(true)}
          aria-label={
            unreadChatCount > 0 ? `Open chat (${unreadChatCount} unread)` : 'Open chat'
          }
          className="fixed bottom-5 right-5 z-40 flex h-12 items-center gap-2 rounded-full border border-line bg-surface px-4.5 text-[15px] font-semibold text-ink shadow-lg transition-colors hover:border-brand-ink hover:bg-tint cursor-pointer"
        >
          <MessageSquare className="h-4.5 w-4.5 text-brand-ink" />
          Chat
          {unreadChatCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 font-mono text-[11px] font-bold text-white tabular-nums">
              {unreadChatCount > 99 ? '99+' : unreadChatCount}
            </span>
          )}
        </button>
      )}

      <LobbySettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={room.settings}
        canEdit={isHost}
        onUpdateSettings={onUpdateSettings}
      />
      <RulesModal open={rulesOpen} onOpenChange={setRulesOpen} />
    </div>
  );
};
