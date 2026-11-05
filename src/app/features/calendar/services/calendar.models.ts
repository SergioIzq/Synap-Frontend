export interface CalendarDto {
  id: string;
  name: string;
  color: string;
  scope: 'personal' | 'work';
  enabled: boolean;
  lastSyncedAt: string | null;
}

export interface CalendarListResponse {
  calendars: CalendarDto[];
}

export interface CalendarEventDto {
  id: string;
  calendarId: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  date: string | null;
  location: string | null;
  description: string | null;
  recurring: boolean;
  color: string;
  scope: 'personal' | 'work';
}

export interface CalendarEventsResponse {
  events: CalendarEventDto[];
}

export interface PatchCalendarRequest {
  scope?: 'personal' | 'work';
  color?: string;
  enabled?: boolean;
}

export type CalendarScope = 'personal' | 'work' | 'all';
