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

export interface UserSettings {
  email: string;
  ai: AiSettings;
}
