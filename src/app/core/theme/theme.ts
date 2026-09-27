import { Injectable, Pipe, PipeTransform, signal } from '@angular/core';

export type ThemeMode = 'system' | 'light' | 'dark';
const KEY = 'theme-mode';

/** Light / dark / follow-the-device, remembered on this device. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly mode = signal<ThemeMode>(this.read());

  constructor() {
    this.apply(this.mode());
  }

  set(mode: ThemeMode) {
    this.mode.set(mode);
    this.apply(mode);
    try {
      localStorage.setItem(KEY, mode);
    } catch {
      // storage unavailable; the choice lasts for this visit
    }
  }

  cycle() {
    const order: ThemeMode[] = ['system', 'light', 'dark'];
    this.set(order[(order.indexOf(this.mode()) + 1) % order.length]);
  }

  private apply(mode: ThemeMode) {
    const root = document.documentElement;
    if (mode === 'system') delete root.dataset['theme'];
    else root.dataset['theme'] = mode;
  }

  private read(): ThemeMode {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
    } catch {
      // fall through
    }
    return 'system';
  }
}

/** Dark-surface steps for the chart palette (dataviz reference palette). */
const DARK_STEPS: Record<string, string> = {
  '#2a78d6': '#3987e5',
  '#eb6834': '#d95926',
  '#1baf7a': '#199e70',
  '#eda100': '#c98500',
  '#e87ba4': '#d55181',
  '#008300': '#008300',
  '#4a3aa7': '#9085e9',
  '#e34948': '#e66767',
};

/** A category colour as a CSS value that switches to its dark step in dark mode. */
export function themed(color: string | undefined | null): string {
  if (!color) return 'var(--viz-series-1)';
  const dark = DARK_STEPS[color.toLowerCase()];
  return dark ? `light-dark(${color}, ${dark})` : color;
}

@Pipe({ name: 'themed' })
export class ThemedPipe implements PipeTransform {
  transform(color: string | undefined | null): string {
    return themed(color);
  }
}

export function themeIcon(mode: ThemeMode): string {
  return mode === 'light' ? 'light_mode' : mode === 'dark' ? 'dark_mode' : 'contrast';
}
