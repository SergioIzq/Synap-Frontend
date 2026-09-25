import { TestBed } from '@angular/core/testing';
import { DARK_CLASS, THEME_STORAGE_KEY, ThemeService } from './theme.service';

/** A controllable prefers-color-scheme media query. */
function mockSystemDark(initial: boolean) {
  const listeners: ((e: { matches: boolean }) => void)[] = [];
  const mql = {
    matches: initial,
    addEventListener: (_: string, cb: (e: { matches: boolean }) => void) => listeners.push(cb),
  };
  // jsdom has no matchMedia at all, so it's defined rather than spied on.
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => mql });
  return (matches: boolean) => {
    mql.matches = matches;
    listeners.forEach((cb) => cb({ matches }));
  };
}

const isDarkApplied = () => document.documentElement.classList.contains(DARK_CLASS);

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove(DARK_CLASS);
    TestBed.resetTestingModule();
  });

  afterEach(() => vi.restoreAllMocks());

  it('defaults to system and follows the OS', () => {
    const setSystemDark = mockSystemDark(false);
    const service = TestBed.inject(ThemeService);

    expect(service.preference()).toBe('system');
    expect(isDarkApplied()).toBe(false);

    setSystemDark(true);
    expect(service.isDark()).toBe(true);
    expect(isDarkApplied()).toBe(true);
  });

  it('dark preference applies and persists', () => {
    mockSystemDark(false);
    const service = TestBed.inject(ThemeService);

    service.setPreference('dark');

    expect(isDarkApplied()).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('light preference ignores a dark OS', () => {
    const setSystemDark = mockSystemDark(true);
    const service = TestBed.inject(ThemeService);

    service.setPreference('light');
    setSystemDark(true);

    expect(isDarkApplied()).toBe(false);
  });

  it('restores the stored preference on startup', () => {
    mockSystemDark(false);
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');

    const service = TestBed.inject(ThemeService);

    expect(service.preference()).toBe('dark');
    expect(isDarkApplied()).toBe(true);
  });

  it('ignores an unknown stored value', () => {
    mockSystemDark(false);
    localStorage.setItem(THEME_STORAGE_KEY, 'purple');

    expect(TestBed.inject(ThemeService).preference()).toBe('system');
  });
});
