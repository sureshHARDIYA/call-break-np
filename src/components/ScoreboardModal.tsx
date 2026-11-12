import React from 'react';
import { Trophy, RotateCcw, ArrowRight } from 'lucide-react';
import { formatScoreTenths } from '../engine/rules.ts';
import { ClientRoomView } from '../engine/types.ts';
import { cn } from '../lib/utils.ts';
import { Button } from './ui/button.tsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog.tsx';

interface ScoreboardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room: ClientRoomView;
  onNextRound: () => void;
  onRestartGame: () => void;
}

export const ScoreboardModal: React.FC<ScoreboardModalProps> = ({
  open,
  onOpenChange,
  room,
  onNextRound,
  onRestartGame,
}) => {
  const isRoundComplete = room.phase === 'ROUND_COMPLETE';
  const isGameComplete = room.phase === 'GAME_COMPLETE';
  const mySeatObj = room.mySeat !== null ? room.seats[room.mySeat] : null;
  const isHost = Boolean(mySeatObj?.isHost);
  const anyConnectedHost = room.seats.some(
    (s) => s.occupied && s.playerType === 'human' && s.isHost && s.connected
  );
  const canAdvance = isHost || !anyConnectedHost;

  const sortedStandings = [...room.seats].sort(
    (a, b) => b.totalScoreTenths - a.totalScoreTenths
  );

  const winnerNames = room.winnerSeats
    .map((s) => room.seats[s].displayName)
    .join(' & ');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl"
        hideClose={isRoundComplete || isGameComplete}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            {isGameComplete && <Trophy className="h-6 w-6 text-[#007272]" />}
            {isGameComplete
              ? `Match Complete — ${winnerNames} ${
                  room.winnerSeats.length > 1 ? 'Share Victory' : 'Wins'
                }`
              : isRoundComplete
              ? `Round ${room.currentRound} of ${room.settings.rounds} Summary`
              : `Match Scoreboard · Round ${room.currentRound} of ${room.settings.rounds}`}
          </DialogTitle>
          <DialogDescription>
            {isGameComplete
              ? 'Final accumulated points across all rounds.'
              : 'Scores use fractional Call Break math (Bid + 0.1 × overtricks, or −Bid).'}
          </DialogDescription>
        </DialogHeader>

        {/* Current Standings */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {sortedStandings.map((seat, idx) => {
            const isWinner = isGameComplete && room.winnerSeats.includes(seat.seat);
            const latestRound =
              room.roundHistory.length > 0
                ? room.roundHistory[room.roundHistory.length - 1]
                : null;
            const latestRes = latestRound?.results.find(
              (r) => r.seat === seat.seat
            );
            const reactionEmoji = isGameComplete
              ? isWinner
                ? '🏆'
                : '😅'
              : isRoundComplete && latestRes
              ? latestRes.roundScoreTenths >= 0
                ? '🥳'
                : '😢'
              : null;

            return (
              <div
                key={seat.seat}
                className={cn(
                  'rounded-lg border p-3.5',
                  isWinner
                    ? 'border-[#007272] bg-[#E8F6F2]'
                    : 'border-[#D3DCDC] bg-[#F2F4EC]/70'
                )}
              >
                <div className="flex items-center justify-between text-xs font-semibold text-[#556767]">
                  <span>#{idx + 1}</span>
                  <div className="flex items-center gap-1.5">
                    {reactionEmoji && (
                      <span
                        className={cn(
                          'text-base leading-none inline-block',
                          (isWinner || (latestRes && latestRes.roundScoreTenths >= 0)) &&
                            'animate-bounce'
                        )}
                      >
                        {reactionEmoji}
                      </span>
                    )}
                    {isWinner && (
                      <span className="font-semibold text-[#007272]">Winner</span>
                    )}
                  </div>
                </div>
                <div className="mt-1 font-semibold text-base text-[#1C2B2B] truncate">
                  {seat.displayName}
                  {seat.seat === room.mySeat ? ' (You)' : ''}
                </div>
                <div
                  className={cn(
                    'mt-1 font-mono text-xl font-bold tabular-nums',
                    seat.totalScoreTenths > 0
                      ? 'text-[#0E7C56]'
                      : seat.totalScoreTenths < 0
                      ? 'text-[#C81E1E]'
                      : 'text-[#1C2B2B]'
                  )}
                >
                  {formatScoreTenths(seat.totalScoreTenths)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Round-by-round breakdown table */}
        <div className="overflow-x-auto rounded-lg border border-[#D3DCDC] bg-white">
          <table className="w-full text-left text-sm sm:text-base">
            <thead className="bg-[#F2F4EC] border-b border-[#D3DCDC] text-sm text-[#4E5D5D]">
              <tr>
                <th className="px-3.5 py-2.5 font-semibold">Round</th>
                {room.seats.map((seat) => (
                  <th key={seat.seat} className="px-3.5 py-2.5 font-semibold">
                    <span className="block truncate max-w-[110px]">
                      {seat.displayName}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4EAEA] font-mono tabular-nums">
              {room.roundHistory.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3.5 py-6 text-center font-sans text-sm text-[#556767]"
                  >
                    Round scores will appear here once Round 1 concludes.
                  </td>
                </tr>
              ) : (
                room.roundHistory.map((round) => (
                  <tr key={round.roundNumber}>
                    <td className="px-3.5 py-2.5 text-[#556767]">R{round.roundNumber}</td>
                    {room.seats.map((seat) => {
                      const res = round.results.find((r) => r.seat === seat.seat);
                      if (!res) return <td key={seat.seat} className="px-3.5 py-2.5">—</td>;
                      return (
                        <td key={seat.seat} className="px-3.5 py-2.5">
                          <span
                            className={cn(
                              'font-semibold',
                              res.roundScoreTenths >= 0
                                ? 'text-[#0E7C56]'
                                : 'text-[#C81E1E]'
                            )}
                          >
                            {formatScoreTenths(res.roundScoreTenths)}
                          </span>
                          <span className="ml-1.5 text-xs text-[#556767]">
                            ({res.tricksWon}/{res.bid})
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
            <tfoot className="border-t border-[#D3DCDC] bg-[#F2F4EC] font-mono tabular-nums">
              <tr>
                <td className="px-3.5 py-2.5 font-sans text-sm font-semibold text-[#1C2B2B]">
                  Total
                </td>
                {room.seats.map((seat) => (
                  <td
                    key={seat.seat}
                    className={cn(
                      'px-3.5 py-2.5 font-bold',
                      seat.totalScoreTenths > 0
                        ? 'text-[#0E7C56]'
                        : seat.totalScoreTenths < 0
                        ? 'text-[#C81E1E]'
                        : 'text-[#1C2B2B]'
                    )}
                  >
                    {formatScoreTenths(seat.totalScoreTenths)}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Footer actions */}
        <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
          {isRoundComplete && (
            canAdvance ? (
              <Button onClick={onNextRound} size="lg">
                Deal Round {room.currentRound + 1}
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <span className="text-sm text-[#556767]">
                Waiting for host to deal Round {room.currentRound + 1}…
              </span>
            )
          )}

          {isGameComplete && (
            isHost ? (
              <Button onClick={onRestartGame} size="lg">
                <RotateCcw className="h-4 w-4" />
                Play Again
              </Button>
            ) : (
              <span className="text-sm text-[#556767]">
                Waiting for host to start a new match…
              </span>
            )
          )}

          {!isRoundComplete && !isGameComplete && (
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Back to Table
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
