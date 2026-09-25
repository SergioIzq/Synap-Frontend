import { RelativeTimePipe } from './relative-time.pipe';

describe('RelativeTimePipe', () => {
  const pipe = new RelativeTimePipe();
  const now = Date.parse('2026-09-25T12:00:00Z');
  const ago = (ms: number) => new Date(now - ms).toISOString();

  it('handles empty values', () => {
    expect(pipe.transform(null, now)).toBe('');
  });

  it('seconds read as "a moment ago"', () => {
    expect(pipe.transform(ago(20_000), now)).toBe('hace un momento');
  });

  it('minutes, hours and days in Spanish', () => {
    expect(pipe.transform(ago(5 * 60_000), now)).toBe('hace 5 min');
    expect(pipe.transform(ago(2 * 3_600_000), now)).toBe('hace 2 h');
    expect(pipe.transform(ago(26 * 3_600_000), now)).toBe('ayer');
    expect(pipe.transform(ago(3 * 86_400_000), now)).toBe('hace 3 días');
  });

  it('shows the date after a week, with the year only when it differs', () => {
    expect(pipe.transform('2026-09-01T10:00:00Z', now)).toMatch(/^1 sept\.?$/);
    expect(pipe.transform('2025-12-24T10:00:00Z', now)).toMatch(/24 dic\.? 2025/);
  });

  it('treats timestamps without an offset as UTC (as the API sends them)', () => {
    expect(pipe.transform('2026-09-25T10:00:00', now)).toBe('hace 2 h');
  });
});
