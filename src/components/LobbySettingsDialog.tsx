import React from 'react';
import { BotDifficulty, RoomSettings } from '../engine/types.ts';
import { cn } from '../lib/utils.ts';
import { Button } from './ui/button.tsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog.tsx';
import { Switch } from './ui/switch.tsx';

interface LobbySettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: RoomSettings;
  /** Only the host may change settings; everyone else sees them read-only. */
  canEdit: boolean;
  onUpdateSettings: (partial: Partial<RoomSettings>) => void;
}

const TRADITIONAL_RULES: Pick<
  RoomSettings,
  'rounds' | 'maxBid' | 'strictMustBeat' | 'strictMustTrump'
> = {
  rounds: 5,
  maxBid: 8,
  strictMustBeat: true,
  strictMustTrump: true,
};

export function usesTraditionalRules(settings: RoomSettings): boolean {
  return (
    settings.rounds === TRADITIONAL_RULES.rounds &&
    settings.maxBid === TRADITIONAL_RULES.maxBid &&
    settings.strictMustBeat === TRADITIONAL_RULES.strictMustBeat &&
    settings.strictMustTrump === TRADITIONAL_RULES.strictMustTrump
  );
}

const BOT_DIFFICULTY_LABELS: Record<BotDifficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

/** One-line summary shown in the lobby, e.g. "5 rounds · Bids 1–8 · Medium bots". */
export function summarizeSettings(settings: RoomSettings): string {
  const parts = [
    `${settings.rounds} ${settings.rounds === 1 ? 'round' : 'rounds'}`,
    `Bids 1–${settings.maxBid}`,
    `${BOT_DIFFICULTY_LABELS[settings.botDifficulty]} bots`,
    usesTraditionalRules(settings) ? 'Traditional rules' : 'Custom rules',
  ];
  if (settings.turnTimerEnabled) parts.push(`${settings.turnTimerSeconds}s turn timer`);
  return parts.join(' · ');
}

interface SegmentedOption<T> {
  value: T;
  label: string;
}

function SegmentedChoice<T extends string | number>({
  label,
  options,
  value,
  disabled,
  onChange,
}: {
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  disabled: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="text-sm font-semibold text-ink">{label}</legend>
      <div
        className="grid gap-1 rounded-lg border border-line bg-surface-muted p-1"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={String(option.value)}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              className={cn(
                'h-11 rounded-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink',
                disabled ? 'cursor-not-allowed' : 'cursor-pointer',
                selected
                  ? 'bg-brand text-white shadow-xs'
                  : cn('text-ink-2', !disabled && 'hover:bg-tint hover:text-brand-ink-strong'),
                disabled && !selected && 'opacity-55'
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function ToggleRow({
  id,
  title,
  hint,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  title: string;
  hint: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <label htmlFor={id} className="min-w-0">
        <span className="block text-[15px] font-semibold text-ink">{title}</span>
        <span className="block text-sm text-ink-muted">{hint}</span>
      </label>
      <Switch id={id} disabled={disabled} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

const ROUND_OPTIONS: readonly SegmentedOption<RoomSettings['rounds']>[] = [
  { value: 1, label: '1' },
  { value: 3, label: '3' },
  { value: 5, label: '5' },
];

const MAX_BID_OPTIONS: readonly SegmentedOption<RoomSettings['maxBid']>[] = [
  { value: 8, label: '8 (traditional)' },
  { value: 13, label: '13' },
];

const BOT_OPTIONS: readonly SegmentedOption<BotDifficulty>[] = [
  { value: 'easy', label: BOT_DIFFICULTY_LABELS.easy },
  { value: 'medium', label: BOT_DIFFICULTY_LABELS.medium },
  { value: 'hard', label: BOT_DIFFICULTY_LABELS.hard },
];

export const LobbySettingsDialog: React.FC<LobbySettingsDialogProps> = ({
  open,
  onOpenChange,
  settings,
  canEdit,
  onUpdateSettings,
}) => {
  const disabled = !canEdit;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Match settings</DialogTitle>
          <DialogDescription className="text-sm">
            {canEdit
              ? 'Traditional Nepali rules are on by default.'
              : 'Only the host can change these before the match starts.'}
          </DialogDescription>
        </DialogHeader>

        <SegmentedChoice
          label="Rounds"
          options={ROUND_OPTIONS}
          value={settings.rounds}
          disabled={disabled}
          onChange={(rounds) => onUpdateSettings({ rounds })}
        />
        <SegmentedChoice
          label="Highest bid allowed"
          options={MAX_BID_OPTIONS}
          value={settings.maxBid}
          disabled={disabled}
          onChange={(maxBid) => onUpdateSettings({ maxBid })}
        />
        <SegmentedChoice
          label="Bot difficulty"
          options={BOT_OPTIONS}
          value={settings.botDifficulty}
          disabled={disabled}
          onChange={(botDifficulty) => onUpdateSettings({ botDifficulty })}
        />

        <div className="divide-y divide-line-soft border-t border-line">
          <ToggleRow
            id="setting-must-beat"
            title="Must beat the lead card"
            hint="Play a higher card of the suit if you have one"
            checked={settings.strictMustBeat}
            disabled={disabled}
            onChange={(strictMustBeat) => onUpdateSettings({ strictMustBeat })}
          />
          <ToggleRow
            id="setting-must-trump"
            title="Must trump when out of suit"
            hint="Play a spade if you cannot follow the lead"
            checked={settings.strictMustTrump}
            disabled={disabled}
            onChange={(strictMustTrump) => onUpdateSettings({ strictMustTrump })}
          />
          <ToggleRow
            id="setting-turn-timer"
            title={`Turn timer (${settings.turnTimerSeconds} seconds)`}
            hint="Plays for a player who takes too long"
            checked={settings.turnTimerEnabled}
            disabled={disabled}
            onChange={(turnTimerEnabled) => onUpdateSettings({ turnTimerEnabled })}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          {canEdit && !usesTraditionalRules(settings) ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-brand-ink"
              onClick={() => onUpdateSettings(TRADITIONAL_RULES)}
            >
              Reset to traditional
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
