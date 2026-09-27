import { NoteType } from './note.model';

/** One per outcome (byok-groq-and-settings design.md Decision 4). */
export type AssistantAnswerStatus =
  | 'ok'
  | 'noRelevantNotes'
  | 'keyMissing'
  | 'invalidKey'
  | 'rateLimited'
  | 'unavailable'
  /** A bookmark can't be asked about yet: only its link is stored (scoped-assistant). */
  | 'scopeUnsupported';

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
  /** Scoped answers only: the note(s) were cut down to fit, so only part was used. */
  partialContext?: boolean | null;
  /** Scoped answers only: what the answer is about. */
  scope?: { noteId?: string | null; tag?: string | null } | null;
}

/**
 * What the assistant is being asked about (scoped-assistant): the whole vault, one note or one
 * tag. `title`/`noteType` are only for display - the API only needs the id.
 */
export type AssistantScope =
  | { kind: 'global' }
  | { kind: 'note'; noteId: string; title?: string; noteType?: NoteType }
  | { kind: 'tag'; tag: string };

export const GLOBAL_SCOPE: AssistantScope = { kind: 'global' };

/** Identifies a scope's conversation: `global`, `note:<id>` or `tag:<name>`. */
export function scopeKey(scope: AssistantScope): string {
  switch (scope.kind) {
    case 'global':
      return 'global';
    case 'note':
      return `note:${scope.noteId}`;
    case 'tag':
      return `tag:${scope.tag}`;
  }
}

/** An earlier question and answer of a scoped conversation, sent for follow-up questions. */
export interface AssistantTurn {
  question: string;
  answer: string;
}

export interface ChatMessage {
  question: string;
  answer: AssistantAnswer | null;
  pending: boolean;
}

/** Statuses whose fix is in Settings, so the answer offers a link there. */
export const SETTINGS_FIXABLE_STATUSES: readonly AssistantAnswerStatus[] = ['keyMissing', 'invalidKey'];
