import React, { useEffect, useState } from 'react';
import {
  Bot,
  Check,
  Copy,
  Crown,
  LogOut,
  Play,
  Share2,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { BotDifficulty, ClientRoomView, SeatIndex } from '../engine/types.ts';
import { cn } from '../lib/utils.ts';
import { ChatPanel } from './ChatPanel.tsx';
import { preloadDeckAssets } from './PlayingCard.tsx';
import { RulesModal } from './RulesModal.tsx';
import { Button } from './ui/button.tsx';
import { Label } from './ui/label.tsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select.tsx';
import { Switch } from './ui/switch.tsx';

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

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

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

  useEffect(() => {
    preloadDeckAssets();
  }, []);

  const mySeatObj = room.mySeat !== null ? room.seats[room.mySeat] : null;
  const isHost = Boolean(mySeatObj?.isHost);
  const allOccupied = room.seats.every((s) => s.occupied);
  const occupiedCount = room.seats.filter((s) => s.occupied).length;

  const inviteUrl = `${window.location.origin}/room/${room.roomCode}`;

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast.success('Invite link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy link automatically');
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${room.roomName} — Call Break`,
          text: `Join my Call Break table (Room ${room.roomCode})`,
          url: inviteUrl,
        });
      } catch {
        // User dismissed share sheet
      }
    } else {
      await handleCopyInvite();
    }
  };

  const handleFillBots = () => {
    for (const s of room.seats) {
      if (!s.occupied) {
        onAddBot(s.seat, room.settings.botDifficulty);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#F2F4EC] text-[#1C2B2B] flex flex-col">
      {/* Clean 3-zone Top Bar */}
      <header className="border-b border-[#D3DCDC] bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-8 h-16 flex items-center justify-between gap-8">
          <span className="font-display text-2xl font-bold tracking-tight text-[#007272] whitespace-nowrap shrink-0">
            Call Break
          </span>

          <nav className="hidden md:flex items-center gap-6 text-base font-medium text-[#334343]">
            <button
              type="button"
              onClick={() => setRulesOpen(true)}
              className="hover:text-[#007272] hover:underline transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Rules &amp; Scoring
            </button>
            <button
              type="button"
              onClick={handleCopyInvite}
              className="hover:text-[#007272] hover:underline transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Copy Invite
            </button>
          </nav>

          <div className="flex items-center gap-2.5 shrink-0">
            <Button variant="outline" size="sm" onClick={onLeaveRoom}>
              <LogOut className="h-4 w-4" />
              Leave
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-8 py-6 sm:py-8">
        {/* Room Header + Invite Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-6 border-b border-[#D3DCDC]">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-[#556767]">
              <span>Waiting Lobby</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono font-semibold text-[#007272]">
                Code {room.roomCode}
              </span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{occupiedCount}/4 Seated</span>
            </div>
            <h1 className="mt-1 font-display text-3xl sm:text-4xl font-semibold text-[#1C2B2B]">
              {room.roomName}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center rounded-lg border border-[#D3DCDC] bg-white px-3.5 py-2.5 text-sm font-mono text-[#334343] max-w-[260px] sm:max-w-xs truncate">
              {inviteUrl}
            </div>
            <Button variant="secondary" onClick={handleCopyInvite}>
              {copied ? <Check className="h-4 w-4 text-[#0E7C56]" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy Link'}
            </Button>
            <Button variant="outline" onClick={handleNativeShare}>
              <Share2 className="h-4 w-4 text-[#007272]" />
              Invite Friends
            </Button>
          </div>
        </div>

        {/* Main Grid: 4 Seats + Settings + Chat */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left/Center: 4 Seats & Host Start Controls */}
          <div className="lg:col-span-7 space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-semibold text-[#1C2B2B]">
                  Table Seats (Counterclockwise)
                </h2>
                <p className="text-sm text-[#556767]">
                  Fill all 4 seats with friends or AI bots to deal Round 1.
                </p>
              </div>
              {isHost && !allOccupied && (
                <Button variant="secondary" size="sm" onClick={handleFillBots}>
                  <Bot className="h-4 w-4" />
                  Fill Vacant with Bots
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {room.seats.map((seat) => {
                const isMe = seat.seat === room.mySeat;
                return (
                  <div
                    key={seat.seat}
                    className={cn(
                      'rounded-xl border p-4 transition-colors bg-white',
                      seat.occupied
                        ? isMe
                          ? 'border-[#007272] bg-[#E8F6F2]/65'
                          : 'border-[#D3DCDC]'
                        : 'border-dashed border-[#869696] bg-white/70'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={cn(
                            'h-11 w-11 rounded-full flex items-center justify-center font-semibold text-sm shrink-0',
                            seat.occupied
                              ? seat.playerType === 'bot'
                                ? 'bg-[#E8F6F2] text-[#007272] border border-[#007272]/25'
                                : 'bg-[#007272] text-white'
                              : 'bg-[#F2F4EC] text-[#556767]'
                          )}
                        >
                          {seat.occupied ? (
                            seat.playerType === 'bot' ? (
                              <Bot className="h-5 w-5" />
                            ) : (
                              getInitials(seat.displayName)
                            )
                          ) : (
                            seat.seat + 1
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-base text-[#1C2B2B] truncate">
                              {seat.occupied ? seat.displayName : `Open Seat ${seat.seat + 1}`}
                            </span>
                            {isMe && (
                              <span className="text-xs font-semibold text-[#007272]">
                                (You)
                              </span>
                            )}
                            {seat.isHost && (
                              <Crown
                                className="h-4 w-4 text-[#007272] shrink-0"
                                aria-label="Room Host"
                              />
                            )}
                          </div>

                          <div className="mt-0.5 flex items-center gap-1.5 text-sm text-[#556767]">
                            {seat.occupied ? (
                              <>
                                <span>
                                  {seat.playerType === 'bot'
                                    ? `AI (${seat.botDifficulty ?? room.settings.botDifficulty})`
                                    : seat.connected
                                    ? 'Connected'
                                    : 'Disconnected'}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span
                                  className={
                                    seat.isReady
                                      ? 'font-semibold text-[#0E7C56]'
                                      : 'text-[#556767]'
                                  }
                                >
                                  {seat.isReady ? 'Ready' : 'Not ready'}
                                </span>
                              </>
                            ) : (
                              <span>Waiting for player or bot</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Seat actions */}
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {!seat.occupied && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onSelectSeat(seat.seat)}
                          >
                            <UserPlus className="h-4 w-4 text-[#007272]" />
                            Sit Here
                          </Button>
                          {isHost && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                onAddBot(seat.seat, room.settings.botDifficulty)
                              }
                            >
                              <Bot className="h-4 w-4" />
                              Add Bot
                            </Button>
                          )}
                        </>
                      )}

                      {seat.occupied && seat.playerType === 'bot' && isHost && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRemoveBot(seat.seat)}
                          className="text-[#C81E1E] hover:text-[#A61717] hover:bg-[#FEE2E2]"
                        >
                          <Trash2 className="h-4 w-4" />
                          Remove Bot
                        </Button>
                      )}

                      {seat.occupied && isMe && (
                        <Button
                          variant={seat.isReady ? 'secondary' : 'default'}
                          size="sm"
                          onClick={() => onSetReady(!seat.isReady)}
                        >
                          {seat.isReady ? 'Ready ✓' : 'Mark Ready'}
                        </Button>
                      )}

                      {seat.occupied &&
                        !isMe &&
                        seat.playerType === 'human' &&
                        isHost && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onTransferHost(seat.seat)}
                          >
                            <Crown className="h-4 w-4 text-[#007272]" />
                            Make Host
                          </Button>
                        )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Room Settings Panel */}
            <div className="rounded-xl border border-[#D3DCDC] bg-white p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-xl font-semibold text-[#1C2B2B]">
                    Match Rules &amp; Configuration
                  </h2>
                  <p className="text-sm text-[#556767]">
                    {isHost
                      ? 'Traditional Nepali rules are enabled by default.'
                      : 'Only the host can adjust rules before starting.'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>Rounds</Label>
                  <Select
                    disabled={!isHost}
                    value={String(room.settings.rounds)}
                    onValueChange={(v) =>
                      onUpdateSettings({ rounds: Number(v) as 1 | 3 | 5 })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 Round (Quick)</SelectItem>
                      <SelectItem value="3">3 Rounds</SelectItem>
                      <SelectItem value="5">5 Rounds (Traditional)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Maximum Bid</Label>
                  <Select
                    disabled={!isHost}
                    value={String(room.settings.maxBid)}
                    onValueChange={(v) =>
                      onUpdateSettings({ maxBid: Number(v) as 8 | 13 })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="8">1 – 8 (Traditional)</SelectItem>
                      <SelectItem value="13">1 – 13 (Full Hand)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>AI Bot Difficulty</Label>
                  <Select
                    disabled={!isHost}
                    value={room.settings.botDifficulty}
                    onValueChange={(v) =>
                      onUpdateSettings({ botDifficulty: v as BotDifficulty })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy (Casual)</SelectItem>
                      <SelectItem value="medium">Medium (Tactical)</SelectItem>
                      <SelectItem value="hard">Hard (Monte Carlo)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-[#E4EAEA]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label className="text-[#1C2B2B]">Strict Must-Beat</Label>
                    <p className="text-xs text-[#556767]">
                      Beat highest lead card if able
                    </p>
                  </div>
                  <Switch
                    disabled={!isHost}
                    checked={room.settings.strictMustBeat}
                    onCheckedChange={(checked) =>
                      onUpdateSettings({ strictMustBeat: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label className="text-[#1C2B2B]">Strict Must-Trump</Label>
                    <p className="text-xs text-[#556767]">
                      Play ♠ when void in lead suit
                    </p>
                  </div>
                  <Switch
                    disabled={!isHost}
                    checked={room.settings.strictMustTrump}
                    onCheckedChange={(checked) =>
                      onUpdateSettings({ strictMustTrump: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label className="text-[#1C2B2B]">Turn Timer (25s)</Label>
                    <p className="text-xs text-[#556767]">
                      Auto-play if timer expires
                    </p>
                  </div>
                  <Switch
                    disabled={!isHost}
                    checked={room.settings.turnTimerEnabled}
                    onCheckedChange={(checked) =>
                      onUpdateSettings({ turnTimerEnabled: checked })
                    }
                  />
                </div>
              </div>

              {/* Start Game Action */}
              <div className="pt-4 border-t border-[#E4EAEA] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-sm text-[#4E5D5D]">
                  {!allOccupied
                    ? `Seat ${4 - occupiedCount} more player${
                        4 - occupiedCount > 1 ? 's' : ''
                      } or bot${4 - occupiedCount > 1 ? 's' : ''} to unlock match start.`
                    : isHost
                    ? 'All 4 seats are ready. Deal Round 1 whenever you are ready.'
                    : 'All 4 seats filled. Waiting for host to start the match.'}
                </p>
                {isHost && (
                  <Button
                    size="lg"
                    disabled={!allOccupied}
                    onClick={onStartGame}
                    className="sm:min-w-[190px]"
                  >
                    <Play className="h-4 w-4" />
                    Start Match
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Right: Live Lobby Chat */}
          <div className="lg:col-span-5">
            <ChatPanel
              messages={room.chat}
              mySeat={room.mySeat}
              typingUsers={typingUsers}
              onSendMessage={onSendChat}
              onTyping={onTyping}
              className="h-[460px] lg:h-[620px]"
            />
          </div>
        </div>
      </main>

      <RulesModal open={rulesOpen} onOpenChange={setRulesOpen} />
    </div>
  );
};
