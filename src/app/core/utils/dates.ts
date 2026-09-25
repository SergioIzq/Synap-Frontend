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
