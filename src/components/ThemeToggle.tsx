import React from 'react';
import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils.ts';
import {
  THEME_PREFERENCES,
  ThemePreference,
  setThemePreference,
  useThemePreference,
} from '../lib/theme.ts';

const THEME_OPTIONS: Record<ThemePreference, { label: string; icon: LucideIcon }> = {
  system: { label: 'System', icon: Monitor },
  light: { label: 'Light', icon: Sun },
  dark: { label: 'Dark', icon: Moon },
};

function nextPreference(current: ThemePreference): ThemePreference {
  const index = THEME_PREFERENCES.indexOf(current);
  return THEME_PREFERENCES[(index + 1) % THEME_PREFERENCES.length];
}

/**
 * Theme switch. "segmented" shows all three choices; "compact" is a single
 * button that cycles System → Light → Dark for tight toolbars.
 */
export const ThemeToggle: React.FC<{
  variant?: 'segmented' | 'compact';
  className?: string;
}> = ({ variant = 'segmented', className }) => {
  const preference = useThemePreference();

  if (variant === 'compact') {
    const { label, icon: Icon } = THEME_OPTIONS[preference];
    const upcoming = THEME_OPTIONS[nextPreference(preference)].label;
    return (
      <button
        type="button"
        onClick={() => setThemePreference(nextPreference(preference))}
        aria-label={`Theme: ${label}. Switch to ${upcoming}`}
        title={`Theme: ${label}`}
        className={cn(
          'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-2 transition-colors hover:bg-tint hover:text-brand-ink-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink cursor-pointer',
          className
        )}
      >
        <Icon className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn(
        'inline-flex shrink-0 items-center gap-0.5 rounded-lg border border-line bg-surface-muted p-0.5',
        className
      )}
    >
      {THEME_PREFERENCES.map((option) => {
        const { label, icon: Icon } = THEME_OPTIONS[option];
        const selected = option === preference;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${label} theme`}
            title={`${label} theme`}
            onClick={() => setThemePreference(option)}
            className={cn(
              'inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink cursor-pointer',
              selected
                ? 'bg-surface text-brand-ink shadow-sm'
                : 'text-ink-muted hover:text-ink'
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
};
