/**
 * How a reminder repeats (specs/reminders). `null` is a one-off; the rest are the exact strings the
 * server stores: `weekly:<0-6>` with 0 = Monday, `monthly:<1-28>`.
 */
export type Recurrence = string | null;

/** One reminder of the signed-in user. `dueAt` is an ISO instant in UTC; shown in local time. */
export interface Reminder {
  id: string;
  text: string;
  dueAt: string;
  recurrence: Recurrence;
  noteId: string | null;
  noteTitle: string | null;
}

/**
 * GET /api/reminders: the pending reminders soonest first, plus what the page needs to warn that
 * nothing will arrive until Telegram is connected.
 */
export interface ReminderList {
  reminders: Reminder[];
  telegramConnected: boolean;
  maxTextLength: number;
}

/** What a reminder is created or edited with. `timezone` is the browser's, stored server-side. */
export interface ReminderInput {
  text: string;
  dueAtUtc: string;
  recurrence?: Recurrence;
  noteId?: string | null;
  timezone?: string;
}

/** GET /api/settings/telegram. */
export interface TelegramStatus {
  connected: boolean;
  timezone: string | null;
}

/** POST /api/settings/telegram/link: the single-use code, returned only once. */
export interface TelegramLinkInstructions {
  code: string;
  botUsername: string;
  expiresAtUtc: string;
}

/** The three fixed snooze options the bot offers, for the labels the web app shows. */
export const RECURRENCE_NONE = null;

/** The weekdays a weekly reminder can fall on, in the server's own 0 = Monday order. */
export const WEEKDAYS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'] as const;

/** A Spanish label for a stored recurrence string, for the list and the selector. */
export function describeRecurrence(recurrence: Recurrence): string {
  if (!recurrence) {
    return 'Una vez';
  }

  if (recurrence === 'daily') {
    return 'Todos los días';
  }

  const [kind, value] = recurrence.split(':');
  if (kind === 'weekly') {
    return `Todos los ${WEEKDAYS[Number(value)] ?? ''}`.trimEnd();
  }

  return kind === 'monthly' ? `El día ${value} de cada mes` : recurrence;
}
