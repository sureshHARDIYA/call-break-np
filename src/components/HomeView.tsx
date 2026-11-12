import React, { useState } from 'react';
import { ArrowRight, Bot } from 'lucide-react';
import { toast } from 'sonner';
import { BotDifficulty, DEFAULT_ROOM_SETTINGS } from '../engine/types.ts';
import { cn } from '../lib/utils.ts';
import { getSavedDisplayName, saveDisplayName } from '../store/gameStore.ts';
import { RulesModal } from './RulesModal.tsx';
import { Button } from './ui/button.tsx';
import { Input } from './ui/input.tsx';
import { Label } from './ui/label.tsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs.tsx';

interface HomeViewProps {
  onRoomCreated: (payload: {
    roomCode: string;
    sessionToken: string;
    displayName: string;
  }) => void;
  onJoinCode: (roomCode: string, displayName: string) => void;
}

const HERO_CARDS = [
  { code: '0D', label: '10 of Diamonds', rotate: '-11deg', translate: 'translate-y-3' },
  { code: 'QH', label: 'Queen of Hearts', rotate: '-4deg', translate: 'translate-y-1' },
  { code: 'KS', label: 'King of Spades', rotate: '3deg', translate: 'translate-y-0' },
  { code: 'AS', label: 'Ace of Spades', rotate: '10deg', translate: 'translate-y-2' },
];

const ROUND_OPTIONS: { value: '1' | '3' | '5'; label: string }[] = [
  { value: '1', label: '1 Round' },
  { value: '3', label: '3 Rounds' },
  { value: '5', label: '5 Rounds' },
];

const BOT_OPTIONS: { value: BotDifficulty; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

export const HomeView: React.FC<HomeViewProps> = ({
  onRoomCreated,
  onJoinCode,
}) => {
  const [displayName, setDisplayName] = useState(() => getSavedDisplayName());
  const [roomName, setRoomName] = useState('');
  const [rounds, setRounds] = useState<'1' | '3' | '5'>('5');
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>('medium');
  const [joinCode, setJoinCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [feltLoaded, setFeltLoaded] = useState(false);
  const [feltError, setFeltError] = useState(false);

  const handleCreate = async (fillBots: boolean) => {
    const cleanName = displayName.trim();
    if (!cleanName) {
      toast.error('Enter your display name first.');
      return;
    }
    saveDisplayName(cleanName);
    setIsCreating(true);
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: cleanName,
          roomName: roomName.trim() || undefined,
          fillBots,
          settings: {
            ...DEFAULT_ROOM_SETTINGS,
            rounds: Number(rounds) as 1 | 3 | 5,
            botDifficulty,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not create room');
      }
      onRoomCreated({
        roomCode: data.roomCode,
        sessionToken: data.sessionToken,
        displayName: cleanName,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create room');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = displayName.trim();
    const cleanCode = joinCode.trim().toUpperCase();
    if (!cleanName) {
      toast.error('Enter your display name to join a table.');
      return;
    }
    if (cleanCode.length < 4) {
      toast.error('Enter a valid 6-character room code.');
      return;
    }
    saveDisplayName(cleanName);
    onJoinCode(cleanCode, cleanName);
  };

  return (
    <div className="relative min-h-screen bg-[#07110C] text-[#F4F1EA] flex flex-col overflow-x-hidden">
      {/* Subtle Parlor Felt Lamp Backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_50%_18%,rgba(19,92,58,0.42)_0%,rgba(9,32,21,0.85)_52%,rgba(6,13,9,1)_100%)]"
      />
      {!feltError && (
        <img
          src="/src/assets/images/table_felt_surface_1794510216671.jpg"
          alt=""
          aria-hidden="true"
          onLoad={() => setFeltLoaded(true)}
          onError={() => setFeltError(true)}
          className={cn(
            'pointer-events-none fixed inset-0 h-full w-full object-cover mix-blend-soft-light transition-opacity duration-500',
            feltLoaded ? 'opacity-35' : 'opacity-0'
          )}
        />
      )}

      {/* Minimal Header */}
      <header className="relative z-10 border-b border-white/8 bg-[#08130E]/80 backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 h-14 flex items-center justify-between">
          <a
            href="/"
            className="flex items-baseline gap-2.5 whitespace-nowrap shrink-0"
          >
            <span className="font-display text-xl font-bold tracking-tight text-[#F4F1EA]">
              Call Break
            </span>
            <span className="text-xs text-[#9EB3A8]">कल ब्रेक</span>
          </a>
          <span
            aria-hidden="true"
            className="text-sm tracking-[0.35em] text-[#D99B26]/70 select-none"
          >
            ♠ ♥ ♦ ♣
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 mx-auto w-full max-w-5xl flex-1 px-4 sm:px-6 py-8 sm:py-14 space-y-16">
        {/* Parlor Hero + Table Entry */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* Left: Authentic Playing Card Fan + Display Title */}
          <div className="lg:col-span-5 flex flex-col items-center lg:items-start text-center lg:text-left space-y-6">
            {/* Fanned Vector Playing Cards */}
            <div className="relative flex items-center justify-center pt-2 pb-1">
              <div className="flex items-end -space-x-7 sm:-space-x-8">
                {HERO_CARDS.map((c) => (
                  <div
                    key={c.code}
                    style={{ transform: `rotate(${c.rotate})` }}
                    className={cn(
                      'w-18 sm:w-22 aspect-[175/251] rounded-md bg-white border border-black/20 shadow-[0_14px_28px_rgba(0,0,0,0.55)] overflow-hidden transition-transform duration-200 hover:-translate-y-2',
                      c.translate
                    )}
                  >
                    <img
                      src={`/cards/${c.code}.svg`}
                      alt={c.label}
                      draggable={false}
                      className="h-full w-full object-contain block"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-mono uppercase tracking-[0.18em] text-[#D99B26]">
                4 Seats · 13 Tricks · Spades Trump
              </p>
              <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-[#F4F1EA] leading-[1.08]">
                Nepali Call Break, ready in one link.
              </h1>
            </div>
          </div>

          {/* Right: Brass-Rimmed Parlor Entry Panel */}
          <div className="lg:col-span-7">
            <div className="rounded-xl border border-[#D99B26]/28 bg-[#0B1913]/92 backdrop-blur-md p-5 sm:p-7 shadow-[0_24px_60px_rgba(0,0,0,0.55)]">
              <Tabs defaultValue="create" className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-[#07110C] border border-white/10">
                  <TabsTrigger value="create">Create Room</TabsTrigger>
                  <TabsTrigger value="join">Join by Code</TabsTrigger>
                </TabsList>

                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label
                      htmlFor="table-entry-name"
                      className="text-xs text-[#B8C9C0]"
                    >
                      Display Name
                    </Label>
                    <Input
                      id="table-entry-name"
                      placeholder="e.g., Suresh, Priya, Kiran"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      maxLength={24}
                      className="bg-[#07110C]/90 border-white/14 h-10"
                    />
                  </div>
                </div>

                <TabsContent value="create" className="space-y-4 mt-4">
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="room-name"
                      className="text-xs text-[#B8C9C0]"
                    >
                      Table Name{' '}
                      <span className="text-[#789185]">(optional)</span>
                    </Label>
                    <Input
                      id="room-name"
                      placeholder="Friday Night Taas"
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      maxLength={36}
                      className="bg-[#07110C]/90 border-white/14 h-10"
                    />
                  </div>

                  {/* Tactile Inline Segmented Controls */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-[#B8C9C0]">Rounds</Label>
                      <div className="grid grid-cols-3 gap-1 rounded-lg bg-[#07110C] p-1 border border-white/10">
                        {ROUND_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setRounds(opt.value)}
                            className={cn(
                              'h-8 rounded-md text-xs font-medium transition-colors cursor-pointer',
                              rounds === opt.value
                                ? 'bg-[#183326] text-[#F4F1EA] border border-[#D99B26]/50'
                                : 'text-[#8CA498] hover:text-[#F4F1EA]'
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-[#B8C9C0]">Bot AI</Label>
                      <div className="grid grid-cols-3 gap-1 rounded-lg bg-[#07110C] p-1 border border-white/10">
                        {BOT_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setBotDifficulty(opt.value)}
                            className={cn(
                              'h-8 rounded-md text-xs font-medium transition-colors cursor-pointer',
                              botDifficulty === opt.value
                                ? 'bg-[#183326] text-[#F4F1EA] border border-[#D99B26]/50'
                                : 'text-[#8CA498] hover:text-[#F4F1EA]'
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row gap-3">
                    <Button
                      size="lg"
                      className="flex-1 font-semibold"
                      disabled={isCreating}
                      onClick={() => handleCreate(false)}
                    >
                      Create Invite Room
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                    <Button
                      size="lg"
                      variant="secondary"
                      className="flex-1 bg-[#14271E] hover:bg-[#1B3529] border border-white/10"
                      disabled={isCreating}
                      onClick={() => handleCreate(true)}
                    >
                      <Bot className="h-4 w-4 text-[#D99B26]" />
                      Play vs 3 Bots
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="join" className="mt-4">
                  <form onSubmit={handleJoinSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="join-code"
                        className="text-xs text-[#B8C9C0]"
                      >
                        Room Code
                      </Label>
                      <Input
                        id="join-code"
                        placeholder="ABCD12"
                        value={joinCode}
                        onChange={(e) =>
                          setJoinCode(e.target.value.toUpperCase())
                        }
                        maxLength={8}
                        className="bg-[#07110C]/90 border-white/14 h-10 font-mono uppercase tracking-[0.25em]"
                      />
                    </div>
                    <Button
                      type="submit"
                      size="lg"
                      className="w-full font-semibold"
                    >
                      Enter Table Lobby
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>

              <div className="mt-5 pt-3.5 border-t border-white/8 flex items-center justify-between text-xs text-[#8CA498]">
                <span>52 cards · Counterclockwise play · Server-authoritative</span>
                <button
                  type="button"
                  onClick={() => setRulesOpen(true)}
                  className="text-[#D99B26] hover:underline cursor-pointer shrink-0 ml-2"
                >
                  Rules
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* House Scoring & Bot Reference Ledger */}
        <section
          id="scoring"
          className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-white/10"
        >
          <div className="space-y-3">
            <h2 className="font-display text-xl font-semibold text-[#F4F1EA]">
              Fractional Scoring
            </h2>
            <p className="text-sm text-[#A5BBB0] leading-relaxed">
              Meet your bid to earn <span className="font-mono text-[#F4F1EA]">+0.1</span> per
              overtrick. Fall short by even one trick and your entire bid is deducted.
            </p>
            <div className="rounded-lg border border-white/10 bg-[#0B1913]/80 overflow-hidden">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="border-b border-white/10 text-[#8CA498]">
                  <tr>
                    <th className="px-4 py-2 font-medium">Bid</th>
                    <th className="px-4 py-2 font-medium">Won</th>
                    <th className="px-4 py-2 font-medium text-right">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/8 font-mono tabular-nums">
                  <tr>
                    <td className="px-4 py-2">3</td>
                    <td className="px-4 py-2">3</td>
                    <td className="px-4 py-2 text-right text-[#34D399]">+3.0</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2">3</td>
                    <td className="px-4 py-2">5</td>
                    <td className="px-4 py-2 text-right text-[#34D399]">+3.2</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2">4</td>
                    <td className="px-4 py-2">2</td>
                    <td className="px-4 py-2 text-right text-[#F87171]">-4.0</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div id="bots" className="space-y-3">
            <h2 className="font-display text-xl font-semibold text-[#F4F1EA]">
              AI Table Partners
            </h2>
            <p className="text-sm text-[#A5BBB0] leading-relaxed">
              Bots fill any vacant seats, play purely from public trick history without
              peeking at hidden hands, and chat back when you ping them.
            </p>
            <dl className="divide-y divide-white/10 rounded-lg border border-white/10 bg-[#0B1913]/80 px-4">
              <div className="py-2.5 flex items-baseline justify-between gap-4">
                <dt className="text-sm font-semibold text-[#F4F1EA] shrink-0">
                  Easy
                </dt>
                <dd className="text-xs text-[#9EB3A8] text-right">
                  Relaxed high-card play for casual rounds
                </dd>
              </div>
              <div className="py-2.5 flex items-baseline justify-between gap-4">
                <dt className="text-sm font-semibold text-[#F4F1EA] shrink-0">
                  Medium
                </dt>
                <dd className="text-xs text-[#9EB3A8] text-right">
                  Tracks Aces and spades to protect bids
                </dd>
              </div>
              <div className="py-2.5 flex items-baseline justify-between gap-4">
                <dt className="text-sm font-semibold text-[#D99B26] shrink-0">
                  Hard
                </dt>
                <dd className="text-xs text-[#9EB3A8] text-right">
                  Infers suit voids and runs Monte Carlo rollouts
                </dd>
              </div>
            </dl>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/8 bg-[#08130E]/90">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 h-14 flex items-center justify-between gap-6 text-sm text-[#9EB3A8]">
          <span className="font-display font-semibold text-[#F4F1EA]">
            Call Break
          </span>
          <nav className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setRulesOpen(true)}
              className="hover:text-white transition-colors whitespace-nowrap cursor-pointer"
            >
              Rules
            </button>
            <a
              href="#scoring"
              className="hover:text-white transition-colors whitespace-nowrap"
            >
              Scoring
            </a>
            <a
              href="#bots"
              className="hover:text-white transition-colors whitespace-nowrap"
            >
              Bot AI
            </a>
          </nav>
        </div>
      </footer>

      <RulesModal open={rulesOpen} onOpenChange={setRulesOpen} />
    </div>
  );
};
