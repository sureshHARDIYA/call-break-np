import React from 'react';
import { BookOpen, RotateCcw } from 'lucide-react';
import {
  setTableBackground,
  TABLE_BACKGROUNDS,
  useTableBackground,
} from '../lib/tableBackground.ts';
import { cn } from '../lib/utils.ts';
import { useGameStore } from '../store/gameStore.ts';
import { ThemeToggle } from './ThemeToggle.tsx';
import { Button } from './ui/button.tsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog.tsx';
import { Switch } from './ui/switch.tsx';

interface GameSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Only the host can restart the match. */
  isHost: boolean;
  onOpenRules: () => void;
  onRequestRestart: () => void;
}

export const GameSettingsDialog: React.FC<GameSettingsDialogProps> = ({
  open,
  onOpenChange,
  isHost,
  onOpenRules,
  onRequestRestart,
}) => {
  const tableBackground = useTableBackground();
  const muted = useGameStore((s) => s.muted);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription className="text-sm">
            Look and sound are saved on this device only.
          </DialogDescription>
        </DialogHeader>

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-ink">Table background</legend>
          <div className="grid grid-cols-5 gap-2">
            {TABLE_BACKGROUNDS.map((option) => {
              const selected = option.value === tableBackground;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setTableBackground(option.value)}
                  className="group flex flex-col items-center gap-1.5 rounded-lg p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink cursor-pointer"
                >
                  <span
                    data-table-bg={option.value}
                    className={cn(
                      'table-surface block aspect-[4/3] w-full rounded-md border-2 transition-colors',
                      selected ? 'border-brand-ink' : 'border-line group-hover:border-line-strong'
                    )}
                  />
                  <span
                    className={cn(
                      'text-xs font-semibold',
                      selected ? 'text-brand-ink' : 'text-ink-muted'
                    )}
                  >
                    {option.label}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="divide-y divide-line-soft border-y border-line">
          <div className="flex items-center justify-between gap-4 py-3">
            <span className="text-[15px] font-semibold text-ink">Theme</span>
            <ThemeToggle />
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <label htmlFor="setting-sound" className="text-[15px] font-semibold text-ink">
              Sound effects
            </label>
            <Switch
              id="setting-sound"
              checked={!muted}
              onCheckedChange={() => useGameStore.getState().toggleMute()}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              onOpenRules();
            }}
          >
            <BookOpen className="h-4 w-4 text-brand-ink" />
            Rules &amp; scoring
          </Button>
          {isHost && (
            <Button
              variant="ghost"
              className="text-danger-ink hover:bg-danger-tint hover:text-danger-ink-strong"
              onClick={() => {
                onOpenChange(false);
                onRequestRestart();
              }}
            >
              <RotateCcw className="h-4 w-4" />
              Restart match
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
