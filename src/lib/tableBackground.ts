import { useSyncExternalStore } from 'react';

export type TableBackground = 'felt' | 'plain' | 'diamonds' | 'stripes' | 'dots';

export const TABLE_BACKGROUNDS: readonly { value: TableBackground; label: string }[] = [
  { value: 'felt', label: 'Felt' },
  { value: 'plain', label: 'Plain' },
  { value: 'diamonds', label: 'Diamonds' },
  { value: 'stripes', label: 'Stripes' },
  { value: 'dots', label: 'Dots' },
];

const DEFAULT_TABLE_BACKGROUND: TableBackground = 'felt';
const STORAGE_KEY = 'cb_table_bg';

const listeners = new Set<() => void>();

function isTableBackground(value: unknown): value is TableBackground {
  return TABLE_BACKGROUNDS.some((option) => option.value === value);
}

function readStored(): TableBackground {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isTableBackground(stored) ? stored : DEFAULT_TABLE_BACKGROUND;
  } catch {
    // Storage unavailable (private mode): use the default table.
    return DEFAULT_TABLE_BACKGROUND;
  }
}

let current: TableBackground = readStored();

export function setTableBackground(value: TableBackground): void {
  current = value;
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Not persisted; the choice still applies for this visit.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The player's chosen table background, saved per browser. */
export function useTableBackground(): TableBackground {
  return useSyncExternalStore(subscribe, () => current);
}
