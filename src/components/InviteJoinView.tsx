import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Bot, Users } from 'lucide-react';
import { toast } from 'sonner';
import { RoomSettings, SeatIndex } from '../engine/types.ts';
import { cn } from '../lib/utils.ts';
import { getSavedDisplayName, saveDisplayName } from '../store/gameStore.ts';
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
    <div className="min-h-screen bg-[#0B1410] text-[#F4F1EA] flex flex-col">
      <header className="border-b border-white/10 bg-[#0D1813]">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 h-16 flex items-center justify-between">
          <button
            type="button"
            onClick={onBackHome}
            className="font-display text-xl font-bold text-[#F4F1EA] cursor-pointer"
          >
            Call Break
          </button>
          <Button variant="ghost" size="sm" onClick={onBackHome}>
            <ArrowLeft className="h-4 w-4" />
            All Options
          </Button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg rounded-xl border border-white/12 bg-[#111F18] p-6 sm:p-8 shadow-2xl space-y-6">
          {isLoading ? (
            <div className="py-10 text-center text-sm text-[#9EB3A8]">
              Looking up room <span className="font-mono">{roomCode}</span>…
            </div>
          ) : isError || !data ? (
            <div className="space-y-4 text-center py-6">
              <h1 className="font-display text-2xl font-bold text-[#F4F1EA]">
                Room {roomCode} Not Found
              </h1>
              <p className="text-sm text-[#9EB3A8]">
                {error instanceof Error
                  ? error.message
                  : 'This Call Break table may have expired or the code is incorrect.'}
              </p>
              <Button onClick={onBackHome}>Return Home</Button>
            </div>
          ) : data.isFull ? (
            <div className="space-y-4 text-center py-6">
              <h1 className="font-display text-2xl font-bold text-[#F4F1EA]">
                {data.roomName} is Full
              </h1>
              <p className="text-sm text-[#9EB3A8]">
                All 4 seats in room <span className="font-mono">{data.roomCode}</span>{' '}
                are already occupied. If you were previously seated on this device,
                try reconnecting from your original browser session.
              </p>
              <Button onClick={onBackHome}>Create Your Own Table</Button>
            </div>
          ) : (
            <>
              <div>
                <div className="flex items-center gap-2 text-xs text-[#9EB3A8]">
                  <span>Table Invitation</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono font-semibold text-[#D99B26]">
                    {data.roomCode}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {data.settings.rounds} Round{data.settings.rounds > 1 ? 's' : ''}
                  </span>
                </div>
                <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-[#F4F1EA]">
                  {data.roomName}
                </h1>
              </div>

              {/* Seat Picker */}
              <div className="space-y-2">
                <Label>Choose a Vacant Seat (or Auto-Assign)</Label>
                <div className="grid grid-cols-2 gap-2.5">
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
                          'rounded-lg border p-3 text-left transition-colors',
                          seat.occupied
                            ? 'border-white/8 bg-[#0B1410] opacity-65 cursor-not-allowed'
                            : selected
                            ? 'border-[#D99B26] bg-[#182E23] cursor-pointer'
                            : 'border-white/14 bg-[#0D1812] hover:border-white/30 cursor-pointer'
                        )}
                      >
                        <div className="flex items-center justify-between text-xs text-[#9EB3A8]">
                          <span>Seat {seat.seat + 1}</span>
                          {seat.occupied ? (
                            seat.playerType === 'bot' ? (
                              <Bot className="h-3.5 w-3.5 text-[#D99B26]" />
                            ) : (
                              <Users className="h-3.5 w-3.5" />
                            )
                          ) : (
                            <span className="text-[#34D399]">Open</span>
                          )}
                        </div>
                        <div className="mt-1 text-sm font-medium text-[#F4F1EA] truncate">
                          {seat.occupied ? seat.displayName : 'Tap to claim'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="invite-display-name">Your Display Name</Label>
                  <Input
                    id="invite-display-name"
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
