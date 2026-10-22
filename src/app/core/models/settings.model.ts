/** The "ai" block of GET /api/settings - never contains the key itself, only a masked form. */
export interface AiSettings {
  hasGroqKey: boolean;
  groqKeyMasked: string | null;
  groqKeyUpdatedAt: string | null;
  /** Null means the server's default model is used. */
  groqModel: string | null;
  defaultGroqModel: string;
}

/** A chat model the user's key can use (specs/user-settings "Choose the assistant model"). */
export interface LlmModel {
  id: string;
  /** Whether the assistant can perform actions (create notes, tag, remember) with it. */
  supportsActions: boolean;
}

/**
 * The "briefing" block of GET /api/settings (specs/briefing). `canBeDelivered` is false when no
 * Telegram chat is linked, which is the only part of a briefing not arriving that the user can
 * fix themselves.
 */
export interface BriefingSettings {
  enabled: boolean;
  /** The local hour it arrives, 0-23. Null when one was never chosen. */
  hour: number | null;
  canBeDelivered: boolean;
}

/** Which of the two forms a connected calendar takes (specs/calendar-integration). */
export type CalendarKind = 'Google' | 'CalDav';

/**
 * GET /api/settings/calendar. Deliberately holds no credential of any kind - not even masked: the
 * API only ever says whether one is connected, which form it is and since when
 * (specs/calendar-integration "Stored calendar credentials are never disclosed").
 *
 * `googleAvailable` is false on a deployment with no OAuth client registered, where the Google way
 * is not offered at all rather than offered and then refused.
 */
export interface CalendarConnection {
  connected: boolean;
  kind: CalendarKind | null;
  connectedAt: string | null;
  googleAvailable: boolean;
}

/** POST /api/settings/calendar/google/authorize: where to send the user, and the state to return with. */
export interface GoogleCalendarAuthorization {
  authorizationUrl: string;
  state: string;
}

export interface UserSettings {
  email: string;
  ai: AiSettings;
  briefing: BriefingSettings;
}
