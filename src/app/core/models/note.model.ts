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
