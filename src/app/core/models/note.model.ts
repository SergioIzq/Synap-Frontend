export type NoteType = 'text' | 'codeSnippet' | 'bookmark';

export interface Note {
  id: string;
  title: string | null;
  content: string;
  type: NoteType;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  metadataTitle: string | null;
  metadataDescription: string | null;
  metadataImageUrl: string | null;
}

export interface CreateNoteRequest {
  type: NoteType;
  title: string | null;
  content: string;
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
  page?: number;
  pageSize?: number;
}
