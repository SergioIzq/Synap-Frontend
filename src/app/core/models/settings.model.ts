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

/**
 * A connected CalDAV calendar (specs/calendar-integration).
 * Deliberately holds no credential of any kind: the API only ever says whether one is connected,
 * which form it is and since when (specs/calendar-integration "Stored calendar credentials are never disclosed").
 */
export interface CalendarConnectionStatus {
  provider: string;
  account: string;
  connectedAt: string;
  needsReconnect: boolean;
  needsReconnectSince: string | null;
}

/** The "calendar" block of GET /api/settings. `connection` is null when nothing is connected. */
export interface CalendarSettings {
  connection: CalendarConnectionStatus | null;
}

export interface UserSettings {
  email: string;
  ai: AiSettings;
  briefing: BriefingSettings;
  calendar?: CalendarSettings;
}
