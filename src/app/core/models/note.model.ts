export type NoteType = 'text' | 'codeSnippet' | 'bookmark';

/**
 * What a note is, as work. A note may carry none, and that is the default: a bookmark or a snippet
 * is material, not a task (note-status design.md Decision 1).
 */
export type NoteStatus = 'pending' | 'inProgress' | 'paused' | 'completed';

/**
 * A value of the status *filter*, never of a note's status: 'none' asks for the notes that carry no
 * status at all - the reference library (design.md Decision 4).
 */
export type NoteStatusFilterValue = NoteStatus | 'none';

export const NOTE_STATUSES: readonly NoteStatus[] = ['pending', 'inProgress', 'paused', 'completed'];

/** What the list shows with no status filter: everything live, completed left out. */
export const DEFAULT_STATUS_FILTER: readonly NoteStatusFilterValue[] = ['pending', 'inProgress', 'paused', 'none'];

/** The chip that means "my tasks" - everything the user marked as work, done ones aside. */
export const WORK_STATUS_FILTER: readonly NoteStatusFilterValue[] = ['pending', 'inProgress', 'paused'];

/** The Spanish labels, which are the only place these are named for the user. */
export const NOTE_STATUS_LABELS: Record<NoteStatus, string> = {
  pending: 'Pendiente',
  inProgress: 'En desarrollo',
  paused: 'Pausado',
  completed: 'Completado',
};

export interface Note {
  id: string;
  title: string | null;
  content: string;
  type: NoteType;
  status: NoteStatus | null;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  metadataTitle: string | null;
  metadataDescription: string | null;
  metadataImageUrl: string | null;
}

export interface CreateNoteRequest {
  /** Null lets the API infer it: a lone URL becomes a bookmark, anything else text. */
  type: NoteType | null;
  title: string | null;
  content: string;
  tags?: string[];
  /** Omitted or null creates a note with no status, which is the default. */
  status?: NoteStatus | null;
}

export interface UpdateNoteRequest {
  title: string | null;
  content: string;
}

export interface QuickCaptureRequest {
  content: string;
  type: NoteType | null;
}

export interface RelatedNote {
  id: string;
  title: string | null;
  content: string;
  type: NoteType;
  similarity: number;
}

/** GET /api/notes/search - one page of results plus the total (backend-hardening). */
export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface NoteSearchParams {
  term?: string | null;
  tag?: string | null;
  type?: NoteType | null;
  /** Empty or omitted means the API's default: everything except completed. */
  status?: readonly NoteStatusFilterValue[] | null;
  page?: number;
  pageSize?: number;
}
