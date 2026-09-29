/** One fact the assistant keeps about the user (specs/assistant-memory). */
export interface MemoryEntry {
  id: string;
  text: string;
  updatedAt: string;
}

/** GET /api/memory: the entries, most recently updated first, plus the server's limits. */
export interface MemoryList {
  entries: MemoryEntry[];
  maxEntries: number;
  maxTextLength: number;
}
