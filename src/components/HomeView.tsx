import React, { useState } from 'react';
import { ArrowRight, Bot } from 'lucide-react';
import { toast } from 'sonner';
import { BotDifficulty, DEFAULT_ROOM_SETTINGS } from '../engine/types.ts';
import { cn } from '../lib/utils.ts';
import { getSavedDisplayName, saveDisplayName } from '../store/gameStore.ts';
import { RulesModal } from './RulesModal.tsx';
import { ThemeToggle } from './ThemeToggle.tsx';
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
  { code: '0D', label: '10 of Diamonds', rotate: '-10deg', translate: 'translate-y-3' },
  { code: 'QH', label: 'Queen of Hearts', rotate: '-3.5deg', translate: 'translate-y-1' },
  { code: 'KS', label: 'King of Spades', rotate: '3deg', translate: 'translate-y-0' },
  { code: 'AS', label: 'Ace of Spades', rotate: '9.5deg', translate: 'translate-y-2' },
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
    <div className="min-h-screen bg-canvas text-ink flex flex-col">
      {/* Minimal Header */}
      <header className="border-b border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 sm:px-8 h-16 flex items-center justify-between">
          <a
            href="/"
            className="flex items-baseline gap-2.5 whitespace-nowrap shrink-0"
          >
            <span className="font-display text-2xl font-bold tracking-tight text-brand-ink">
              Call Break
            </span>
            <span className="text-sm font-medium text-ink-muted">कल ब्रेक</span>
          </a>
          <div className="flex items-center gap-4">
            <span
              aria-hidden="true"
              className="hidden sm:inline text-base tracking-[0.35em] text-brand-ink/65 select-none"
            >
              ♠ ♥ ♦ ♣
            </span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Band 1: Soft Mint Hero + Crisp White Calculator-Style Room Card */}
        <section className="bg-gradient-to-b from-tint via-tint/75 to-canvas py-10 sm:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* Left: Fanned Vector Playing Cards + 48px Display Heading */}
            <div className="lg:col-span-5 flex flex-col items-center lg:items-start text-center lg:text-left space-y-6">
              <div className="relative flex items-center justify-center pt-2 pb-1">
                <div className="flex items-end -space-x-7 sm:-space-x-8">
                  {HERO_CARDS.map((c) => (
                    <div
                      key={c.code}
                      style={{ transform: `rotate(${c.rotate})` }}
                      className={cn(
                        'w-20 sm:w-24 aspect-[175/251] rounded-md bg-white border border-black/10 shadow-[0_12px_24px_rgba(0,70,70,0.14)] overflow-hidden transition-transform duration-200 hover:-translate-y-2',
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
                <p className="text-sm font-semibold text-brand-ink">
                  4 Seats · 13 Tricks · Spades Trump
                </p>
                <h1 className="font-display text-4xl sm:text-[3rem] sm:leading-[3.5rem] font-semibold tracking-[-0.02em] text-ink">
                  Nepali Call Break, ready in one link.
                </h1>
              </div>
            </div>

            {/* Right: Crisp Eufemia White Configurator Card */}
            <div className="lg:col-span-7">
              <div className="rounded-xl border border-line bg-surface p-6 sm:p-8 shadow-[0_10px_32px_rgba(0,70,70,0.07)]">
                <Tabs defaultValue="create" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="create">Create Room</TabsTrigger>
                    <TabsTrigger value="join">Join by Code</TabsTrigger>
                  </TabsList>

                  <div className="mt-5 space-y-1.5">
                    <Label htmlFor="table-entry-name">
                      Display Name <span className="text-danger-ink" aria-hidden="true">*</span>
                    </Label>
                    <Input
                      id="table-entry-name"
                      required
                      aria-required="true"
                      placeholder="e.g., Suresh, Priya, Kiran"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      maxLength={24}
                    />
                  </div>

                  <TabsContent value="create" className="space-y-5 mt-5">
                    <div className="space-y-1.5">
                      <Label htmlFor="room-name">
                        Table Name{' '}
                        <span className="font-normal text-ink-muted">
                          (optional)
                        </span>
                      </Label>
                      <Input
                        id="room-name"
                        placeholder="Friday Night Taas"
                        value={roomName}
                        onChange={(e) => setRoomName(e.target.value)}
                        maxLength={36}
                      />
                    </div>

                    {/* Tactile Segmented Controls */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>Rounds</Label>
                        <div className="grid grid-cols-3 gap-1 rounded-lg bg-surface-muted p-1 border border-line">
                          {ROUND_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setRounds(opt.value)}
                              className={cn(
                                'h-9 rounded-md text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap',
                                rounds === opt.value
                                  ? 'bg-brand text-white shadow-xs'
                                  : 'text-ink-2 hover:text-brand-ink-strong'
                              )}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label>Bot AI</Label>
                        <div className="grid grid-cols-3 gap-1 rounded-lg bg-surface-muted p-1 border border-line">
                          {BOT_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setBotDifficulty(opt.value)}
                              className={cn(
                                'h-9 rounded-md text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap',
                                botDifficulty === opt.value
                                  ? 'bg-brand text-white shadow-xs'
                                  : 'text-ink-2 hover:text-brand-ink-strong'
                              )}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Live Configuration Summary Strip */}
                    <div className="rounded-lg bg-surface-muted border border-line px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="text-ink-3">Selected table setup</span>
                      <span className="font-semibold text-ink tabular-nums">
                        {rounds} {Number(rounds) === 1 ? 'Round' : 'Rounds'} ·{' '}
                        <span className="capitalize">{botDifficulty}</span> Bot AI
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button
                        size="lg"
                        className="flex-1"
                        disabled={isCreating}
                        onClick={() => handleCreate(false)}
                      >
                        Create Invite Room
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                      <Button
                        size="lg"
                        variant="secondary"
                        className="flex-1"
                        disabled={isCreating}
                        onClick={() => handleCreate(true)}
                      >
                        <Bot className="h-4 w-4" />
                        Play vs 3 Bots
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="join" className="mt-5">
                    <form onSubmit={handleJoinSubmit} className="space-y-5">
                      <div className="space-y-1.5">
                        <Label htmlFor="join-code">Room Code</Label>
                        <Input
                          id="join-code"
                          placeholder="ABCD12"
                          value={joinCode}
                          onChange={(e) =>
                            setJoinCode(e.target.value.toUpperCase())
                          }
                          maxLength={8}
                          className="font-mono uppercase tracking-[0.25em]"
                        />
                      </div>
                      <Button type="submit" size="lg" className="w-full">
                        Enter Table Lobby
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>

                <div className="mt-6 pt-4 border-t border-line flex items-center justify-between text-sm text-ink-muted">
                  <span>52 cards · Counterclockwise play · Live multiplayer</span>
                  <button
                    type="button"
                    onClick={() => setRulesOpen(true)}
                    className="font-semibold text-brand-ink hover:underline cursor-pointer shrink-0 ml-3"
                  >
                    Rules
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Band 2: Pistachio Surface with Crisp White Modular Reference Cards */}
        <section
          id="scoring"
          className="bg-surface-muted border-t border-line py-12 sm:py-16"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-8 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="rounded-xl border border-line bg-surface p-6 sm:p-8 space-y-4">
              <h2 className="font-display text-2xl font-semibold text-ink">
                Fractional Scoring
              </h2>
              <p className="text-base text-ink-2 leading-relaxed">
                Meet your bid to earn{' '}
                <span className="font-mono font-semibold text-brand-ink">+0.1</span>{' '}
                per overtrick. Fall short by even one trick and your entire bid is deducted.
              </p>
              <div className="rounded-lg border border-line bg-surface overflow-hidden">
                <table className="w-full text-left text-base">
                  <thead className="bg-surface-muted border-b border-line text-sm text-ink-3">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Bid</th>
                      <th className="px-4 py-2.5 font-semibold">Won</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft font-mono tabular-nums">
                    <tr>
                      <td className="px-4 py-2.5">3</td>
                      <td className="px-4 py-2.5">3</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-positive">
                        +3.0
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5">3</td>
                      <td className="px-4 py-2.5">5</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-positive">
                        +3.2
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5">4</td>
                      <td className="px-4 py-2.5">2</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-danger-ink">
                        -4.0
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div
              id="bots"
              className="rounded-xl border border-line bg-surface p-6 sm:p-8 space-y-4"
            >
              <h2 className="font-display text-2xl font-semibold text-ink">
                AI Table Partners
              </h2>
              <p className="text-base text-ink-2 leading-relaxed">
                Bots fill any vacant seats, play purely from public trick history
                without peeking at hidden hands, and chat back when you ping them.
              </p>
              <dl className="divide-y divide-line-soft rounded-lg border border-line bg-surface px-5">
                <div className="py-3.5 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 sm:gap-4">
                  <dt className="text-base font-semibold text-ink shrink-0">
                    Easy
                  </dt>
                  <dd className="text-sm sm:text-base text-ink-3 sm:text-right">
                    Relaxed high-card play for casual rounds
                  </dd>
                </div>
                <div className="py-3.5 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 sm:gap-4">
                  <dt className="text-base font-semibold text-ink shrink-0">
                    Medium
                  </dt>
                  <dd className="text-sm sm:text-base text-ink-3 sm:text-right">
                    Tracks Aces and spades to protect bids
                  </dd>
                </div>
                <div className="py-3.5 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 sm:gap-4">
                  <dt className="text-base font-semibold text-brand-ink shrink-0">
                    Hard
                  </dt>
                  <dd className="text-sm sm:text-base text-ink-3 sm:text-right">
                    Infers suit voids and runs Monte Carlo rollouts
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </section>
      </main>

      {/* Clean Footer with Rules, Scoring, Bot AI at bottom */}
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 sm:px-8 h-16 flex items-center justify-between gap-6 text-base text-ink-3">
          <span className="font-display font-bold text-brand-ink">Call Break</span>
          <nav className="flex items-center gap-6 sm:gap-8 font-medium">
            <button
              type="button"
              onClick={() => setRulesOpen(true)}
              className="text-ink-2 hover:text-brand-ink hover:underline transition-colors whitespace-nowrap cursor-pointer"
            >
              Rules
            </button>
            <a
              href="#scoring"
              className="text-ink-2 hover:text-brand-ink hover:underline transition-colors whitespace-nowrap"
            >
              Scoring
            </a>
            <a
              href="#bots"
              className="text-ink-2 hover:text-brand-ink hover:underline transition-colors whitespace-nowrap"
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
