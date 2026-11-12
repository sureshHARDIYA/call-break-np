import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Bot, Users } from 'lucide-react';
import { toast } from 'sonner';
import { RoomSettings, SeatIndex } from '../engine/types.ts';
import { cn } from '../lib/utils.ts';
import { getSavedDisplayName, saveDisplayName } from '../store/gameStore.ts';
import { ThemeToggle } from './ThemeToggle.tsx';
import { Button } from './ui/button.tsx';
import { Input } from './ui/input.tsx';
import { Label } from './ui/label.tsx';

interface PublicRoomSummary {
  roomCode: string;
  roomName: string;
  phase: string;
  settings: RoomSettings;
  occupiedCount: number;
  vacantSeats: SeatIndex[];
  isFull: boolean;
  seats: Array<{
    seat: SeatIndex;
    occupied: boolean;
    displayName: string;
    playerType: 'human' | 'bot';
    isHost: boolean;
    connected: boolean;
  }>;
}

interface InviteJoinViewProps {
  roomCode: string;
  onJoin: (params: {
    roomCode: string;
    displayName: string;
    preferredSeat?: SeatIndex;
  }) => void;
  onBackHome: () => void;
}

export const InviteJoinView: React.FC<InviteJoinViewProps> = ({
  roomCode,
  onJoin,
  onBackHome,
}) => {
  const [displayName, setDisplayName] = useState(() => getSavedDisplayName());
  const [preferredSeat, setPreferredSeat] = useState<SeatIndex | undefined>(
    undefined
  );

  const { data, isLoading, isError, error } = useQuery<PublicRoomSummary>({
    queryKey: ['room-summary', roomCode],
    queryFn: async () => {
      const res = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Room not found');
      }
      return res.json();
    },
    retry: 1,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = displayName.trim();
    if (!cleanName) {
      toast.error('Please enter your display name.');
      return;
    }
    saveDisplayName(cleanName);
    onJoin({
      roomCode,
      displayName: cleanName,
      preferredSeat,
    });
  };

  return (
    <div className="min-h-screen bg-surface-muted text-ink flex flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 sm:px-8 h-16 flex items-center justify-between">
          <button
            type="button"
            onClick={onBackHome}
            className="font-display text-2xl font-bold text-brand-ink cursor-pointer"
          >
            Call Break
          </button>
          <div className="flex items-center gap-2">
            <ThemeToggle variant="compact" />
            <Button variant="ghost" size="sm" onClick={onBackHome}>
              <ArrowLeft className="h-4 w-4" />
              All Options
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg rounded-xl border border-line bg-surface p-6 sm:p-8 shadow-[0_10px_32px_rgba(0,70,70,0.07)] space-y-6">
          {isLoading ? (
            <div className="py-10 text-center text-base text-ink-muted">
              Looking up room <span className="font-mono font-semibold">{roomCode}</span>…
            </div>
          ) : isError || !data ? (
            <div className="space-y-4 text-center py-6">
              <h1 className="font-display text-2xl font-semibold text-ink">
                Room {roomCode} Not Found
              </h1>
              <p className="text-base text-ink-muted">
                {error instanceof Error
                  ? error.message
                  : 'This Call Break table may have expired or the code is incorrect.'}
              </p>
              <Button onClick={onBackHome}>Return Home</Button>
            </div>
          ) : data.isFull ? (
            <div className="space-y-4 text-center py-6">
              <h1 className="font-display text-2xl font-semibold text-ink">
                {data.roomName} is Full
              </h1>
              <p className="text-base text-ink-muted">
                All 4 seats in room <span className="font-mono font-semibold">{data.roomCode}</span>{' '}
                are already occupied. If you were previously seated on this device,
                try reconnecting from your original browser session.
              </p>
              <Button onClick={onBackHome}>Create Your Own Table</Button>
            </div>
          ) : (
            <>
              <div>
                <div className="flex items-center gap-2 text-sm text-ink-muted">
                  <span>Table Invitation</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono font-semibold text-brand-ink">
                    {data.roomCode}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {data.settings.rounds} Round{data.settings.rounds > 1 ? 's' : ''}
                  </span>
                </div>
                <h1 className="mt-1 font-display text-2xl sm:text-3xl font-semibold text-ink">
                  {data.roomName}
                </h1>
              </div>

              {/* Seat Picker */}
              <div className="space-y-2">
                <Label>Choose a Vacant Seat (or Auto-Assign)</Label>
                <div className="grid grid-cols-2 gap-3">
                  {data.seats.map((seat) => {
                    const selected = preferredSeat === seat.seat;
                    return (
                      <button
                        key={seat.seat}
                        type="button"
                        disabled={seat.occupied}
                        onClick={() =>
                          setPreferredSeat(selected ? undefined : seat.seat)
                        }
                        className={cn(
                          'rounded-lg border p-3.5 text-left transition-colors',
                          seat.occupied
                            ? 'border-line bg-surface-muted opacity-65 cursor-not-allowed'
                            : selected
                            ? 'border-brand-ink bg-tint ring-1 ring-brand-ink cursor-pointer'
                            : 'border-line bg-surface hover:border-brand-ink/60 cursor-pointer'
                        )}
                      >
                        <div className="flex items-center justify-between text-xs font-medium text-ink-muted">
                          <span>Seat {seat.seat + 1}</span>
                          {seat.occupied ? (
                            seat.playerType === 'bot' ? (
                              <Bot className="h-4 w-4 text-brand-ink" />
                            ) : (
                              <Users className="h-4 w-4 text-ink-3" />
                            )
                          ) : (
                            <span className="font-semibold text-brand-ink">Open</span>
                          )}
                        </div>
                        <div className="mt-1 text-base font-semibold text-ink truncate">
                          {seat.occupied ? seat.displayName : 'Tap to claim'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="invite-display-name">
                    Your Display Name <span className="text-danger-ink" aria-hidden="true">*</span>
                  </Label>
                  <Input
                    id="invite-display-name"
                    required
                    aria-required="true"
                    placeholder="Enter your name at the table"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={24}
                    autoFocus
                  />
                </div>
                <Button type="submit" size="lg" className="w-full">
                  Join Table
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
};
