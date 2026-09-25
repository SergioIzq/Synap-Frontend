import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';

export type ThemePreference = 'light' | 'dark' | 'system';

/** Keep in sync with the inline script in index.html, which applies the theme before boot. */
export const THEME_STORAGE_KEY = 'synap.theme';
export const DARK_CLASS = 'app-dark';

/**
 * Light/dark/system preference, remembered per device (mobile-and-ux-polish design.md
 * Decision 2). Applies `.app-dark` on <html>, which is both PrimeNG's darkModeSelector and the
 * switch for Synap's own --synap-* tokens.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly media = this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)') ?? null;

  private readonly _preference = signal<ThemePreference>(this.readStoredPreference());
  private readonly _systemDark = signal(this.media?.matches ?? false);

  readonly preference = this._preference.asReadonly();
  readonly isDark = computed(() =>
    this._preference() === 'system' ? this._systemDark() : this._preference() === 'dark',
  );

  constructor() {
    this.media?.addEventListener('change', (event) => {
      this._systemDark.set(event.matches);
      this.apply();
    });
    this.apply();
  }

  setPreference(preference: ThemePreference): void {
    this._preference.set(preference);
    try {
      this.document.defaultView?.localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // Storage unavailable (private mode) - the choice still applies for this session.
    }
    this.apply();
  }

  private apply(): void {
    const root = this.document.documentElement;
    root.classList.toggle(DARK_CLASS, this.isDark());
    this.document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', this.isDark() ? '#09090b' : '#ffffff');
  }

  private readStoredPreference(): ThemePreference {
    try {
      const stored = this.document.defaultView?.localStorage.getItem(THEME_STORAGE_KEY);
      return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
    } catch {
      return 'system';
    }
  }
}
