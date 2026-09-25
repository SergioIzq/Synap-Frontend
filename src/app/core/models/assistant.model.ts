/** One per outcome (byok-groq-and-settings design.md Decision 4). */
export type AssistantAnswerStatus =
  | 'ok'
  | 'noRelevantNotes'
  | 'keyMissing'
  | 'invalidKey'
  | 'rateLimited'
  | 'unavailable';

export interface AssistantSource {
  id: string;
  /** The note's title, or a content preview when it has none. */
  title: string;
}

export interface AssistantAnswer {
  answer: string;
  sourceNoteIds: string[];
  /** May be missing when talking to an older backend. */
  sources?: AssistantSource[];
  grounded: boolean;
  status: AssistantAnswerStatus;
}

export interface ChatMessage {
  question: string;
  answer: AssistantAnswer | null;
  pending: boolean;
}

/** Statuses whose fix is in Settings, so the answer offers a link there. */
export const SETTINGS_FIXABLE_STATUSES: readonly AssistantAnswerStatus[] = ['keyMissing', 'invalidKey'];
