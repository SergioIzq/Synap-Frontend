/**
 * API timestamps come from "timestamp without time zone" columns written with UTC values, so
 * they arrive without an offset - the browser would otherwise read them as local time (hours
 * off). Anything without an explicit offset is treated as UTC.
 */
export function parseApiDate(value: string): Date {
  const hasOffset = /(Z|[+-]\d{2}:?\d{2})$/.test(value);
  return new Date(hasOffset ? value : `${value}Z`);
}

export function formatDateTime(value: string): string {
  return parseApiDate(value).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * The browser's IANA timezone, sent with assistant questions and reminder writes: the server stores
 * it so a snooze pressed later in Telegram - where nothing can send it - still knows what
 * "09:00 mañana" means (assistant-reminders design.md Context).
 */
export function browserTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    // Ancient or locked-down browsers: the server falls back to UTC.
    return undefined;
  }
}

/**
 * A `datetime-local` value ("2026-10-03T09:00", always local) as the UTC instant the API takes.
 * Seconds are dropped: reminders are minute-precision (see Reminder.AsDueMoment server-side).
 */
export function localInputToUtcIso(value: string): string {
  const local = new Date(value);
  local.setSeconds(0, 0);
  return local.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** A UTC instant from the API as the `datetime-local` value that shows the same wall clock. */
export function utcIsoToLocalInput(value: string): string {
  const date = parseApiDate(value);
  const pad = (n: number) => `${n}`.padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
