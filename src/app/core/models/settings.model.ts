/** The "ai" block of GET /api/settings - never contains the key itself, only a masked form. */
export interface AiSettings {
  hasGroqKey: boolean;
  groqKeyMasked: string | null;
  groqKeyUpdatedAt: string | null;
  /** Null means the server's default model is used. */
  groqModel: string | null;
  defaultGroqModel: string;
}

export interface UserSettings {
  email: string;
  ai: AiSettings;
}
