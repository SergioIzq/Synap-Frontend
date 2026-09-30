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

export interface UserSettings {
  email: string;
  ai: AiSettings;
  briefing: BriefingSettings;
}
