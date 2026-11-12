import { useSyncExternalStore } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';

export const THEME_PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark'];

// Keep in sync with public/theme-init.js, which applies the saved choice before first paint.
const THEME_STORAGE_KEY = 'cb_theme';
const THEME_ATTRIBUTE = 'data-theme';

const listeners = new Set<() => void>();

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

function readStoredPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : 'system';
  } catch {
    // Storage unavailable (private mode): behave as "system".
    return 'system';
  }
}

let currentPreference: ThemePreference = readStoredPreference();

function applyPreference(preference: ThemePreference): void {
  const root = document.documentElement;
  if (preference === 'system') {
    // No attribute: CSS follows the OS through prefers-color-scheme.
    root.removeAttribute(THEME_ATTRIBUTE);
  } else {
    root.setAttribute(THEME_ATTRIBUTE, preference);
  }
}

export function setThemePreference(preference: ThemePreference): void {
  currentPreference = preference;
  applyPreference(preference);
  try {
    if (preference === 'system') {
      localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      localStorage.setItem(THEME_STORAGE_KEY, preference);
    }
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

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, () => currentPreference);
}

applyPreference(currentPreference);
