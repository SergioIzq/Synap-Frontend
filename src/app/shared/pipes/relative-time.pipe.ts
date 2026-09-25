import { Pipe, PipeTransform } from '@angular/core';
import { parseApiDate } from '../../core/utils/dates';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Short for minutes/hours ("hace 2 h"), long for days ("hace 3 días" reads better than "3 d").
const relativeShort = new Intl.RelativeTimeFormat('es', { numeric: 'auto', style: 'short' });
const relativeLong = new Intl.RelativeTimeFormat('es', { numeric: 'auto', style: 'long' });
const sameYear = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });
const otherYear = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * "hace 5 min", "hace 2 h", "ayer", "hace 3 días"; after a week, the date ("12 sept").
 * specs/web-experience "Note summaries show type and age". Pure: it doesn't tick while a page
 * stays open, which is fine for a list that reloads on every visit.
 */
@Pipe({ name: 'relativeTime', standalone: true })
export class RelativeTimePipe implements PipeTransform {
  transform(value: string | null | undefined, now: number = Date.now()): string {
    if (!value) return '';

    const date = parseApiDate(value);
    const elapsed = now - date.getTime();

    if (elapsed < MINUTE) return 'hace un momento';
    if (elapsed < HOUR) return relativeShort.format(-Math.floor(elapsed / MINUTE), 'minute');
    if (elapsed < DAY) return relativeShort.format(-Math.floor(elapsed / HOUR), 'hour');
    if (elapsed < 7 * DAY) return relativeLong.format(-Math.floor(elapsed / DAY), 'day');

    return (date.getFullYear() === new Date(now).getFullYear() ? sameYear : otherYear).format(date);
  }
}
