import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, firstValueFrom, from } from 'rxjs';
import { NOTES_PAGE_SIZE, NoteService } from '../../../core/services/api/note.service';
import { NotificationService } from '../../../core/services/notification.service';
import { apiErrorMessage, isHandledGlobally } from '../../../core/utils/http-errors';
import { CreateNoteRequest, Note, NoteType, UpdateNoteRequest } from '../../../core/models';

export interface NoteFilters {
  term: string | null;
  tag: string | null;
  type: NoteType | null;
}

/** Filters plus the page being shown - what the notes list mirrors in its URL. */
export interface NotesQuery extends NoteFilters {
  page: number;
  pageSize: number;
}

export const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
export const DEFAULT_PAGE_SIZE = NOTES_PAGE_SIZE;

export const DEFAULT_QUERY: NotesQuery = { term: null, tag: null, type: null, page: 1, pageSize: DEFAULT_PAGE_SIZE };

/**
 * Plain signals, not @ngrx/signals - see design.md Decision 10. The store holds exactly one
 * page of the list (fix-notes-list): `search()` replaces it, and a page past the last one is
 * clamped to the last. Notes opened directly (detail page, assistant sources) that aren't on
 * the loaded page are fetched by id and kept apart in `_opened`.
 */
@Injectable({ providedIn: 'root' })
export class NotesStore {
  private readonly noteService = inject(NoteService);
  private readonly notifications = inject(NotificationService);

  private readonly _notes = signal<Note[]>([]);
  private readonly _opened = signal<Record<string, Note>>({});
  private readonly _totalCount = signal(0);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _query = signal<NotesQuery>(DEFAULT_QUERY);
  private readonly _tags = signal<string[]>([]);

  /** Bumped on every new search so a slow, stale response can't overwrite a newer one. */
  private searchGeneration = 0;

  readonly notes = this._notes.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly totalCount = this._totalCount.asReadonly();
  /** The query of the page currently shown (after clamping). */
  readonly query = this._query.asReadonly();
  readonly searchTerm = computed(() => this._query().term);
  readonly tag = computed(() => this._query().tag);
  readonly type = computed(() => this._query().type);
  readonly page = computed(() => this._query().page);
  readonly pageSize = computed(() => this._query().pageSize);
  readonly pageCount = computed(() => Math.max(1, Math.ceil(this._totalCount() / this._query().pageSize)));
  /** All the user's tags (GET /api/tags) - not just those on the loaded page. */
  readonly allTags = this._tags.asReadonly();

  noteById(id: string): Note | undefined {
    return this._notes().find((n) => n.id === id) ?? this._opened()[id];
  }

  /** Loads the page described by `query`; anything left out takes its default (page 1, size 20, no filters). */
  async search(query: Partial<NotesQuery> = {}): Promise<void> {
    const next: NotesQuery = { ...DEFAULT_QUERY, ...query };
    this._query.set(next);
    const generation = ++this.searchGeneration;

    this._loading.set(true);
    this._error.set(null);
    try {
      const result = await firstValueFrom(this.noteService.search(next));
      if (generation !== this.searchGeneration) return;

      // Asked for a page that no longer exists (deleted notes, an old link): show the last one.
      const lastPage = Math.ceil(result.totalCount / next.pageSize);
      if (result.items.length === 0 && lastPage > 0 && next.page > lastPage) {
        await this.search({ ...next, page: lastPage });
        return;
      }

      this._notes.set(result.items);
      this._totalCount.set(result.totalCount);
    } catch (err) {
      if (generation !== this.searchGeneration) return;
      this._error.set(apiErrorMessage(err, 'No se pudieron cargar las notas.'));
    } finally {
      if (generation === this.searchGeneration) this._loading.set(false);
    }
  }

  /** Reloads the page currently shown. */
  async refresh(): Promise<void> {
    await this.search(this._query());
  }

  async loadTags(): Promise<void> {
    try {
      this._tags.set(await firstValueFrom(this.noteService.listTags()));
    } catch {
      // Best-effort: the filter just offers fewer tags.
    }
  }

  /**
   * Makes sure a note is available to noteById(), fetching it by id when it isn't loaded.
   * `missing` is a 404 (not the user's, or deleted); `error` any other failure.
   */
  async ensureNote(id: string): Promise<'found' | 'missing' | 'error'> {
    if (this.noteById(id)) return 'found';
    try {
      this.remember(await firstValueFrom(this.noteService.getById(id)));
      return 'found';
    } catch (err) {
      return err instanceof HttpErrorResponse && err.status === 404 ? 'missing' : 'error';
    }
  }

  async create(request: CreateNoteRequest): Promise<void> {
    await this.mutate(this.noteService.create(request), 'Nota guardada', 'No se pudo crear la nota.');
    // Newest first: the new note is on page 1 of the current filters.
    await this.search({ ...this._query(), page: 1 });
  }

  async update(id: string, request: UpdateNoteRequest): Promise<void> {
    await this.mutate(this.noteService.update(id, request), 'Nota actualizada', 'No se pudo actualizar la nota.');
    await this.reloadNote(id);
  }

  /**
   * Saves title/content and attaches any new tags as one user action - a single toast, then
   * the note and the tag list are refreshed once.
   */
  async updateWithTags(id: string, request: UpdateNoteRequest, newTags: string[]): Promise<void> {
    const saveAll = async () => {
      await firstValueFrom(this.noteService.update(id, request));
      for (const tag of newTags) {
        await firstValueFrom(this.noteService.addTag(id, tag));
      }
    };
    await this.mutate(from(saveAll()), 'Nota actualizada', 'No se pudo guardar la nota.');
    await this.reloadNote(id);
    if (newTags.length > 0) void this.loadTags();
  }

  async delete(id: string): Promise<void> {
    await this.mutate(this.noteService.delete(id), 'Nota eliminada', 'No se pudo eliminar la nota.');
    this._opened.update(({ [id]: _, ...rest }) => rest);
    // Refills the page from the next one; an emptied last page falls back to the previous one.
    await this.refresh();
    void this.loadTags();
  }

  async addTag(id: string, tagName: string): Promise<void> {
    await this.mutate(this.noteService.addTag(id, tagName), `Etiqueta #${tagName} añadida`, 'No se pudo añadir la etiqueta.');
    await this.reloadNote(id);
    void this.loadTags();
  }

  /** Re-fetches one note after a change, wherever it's held - no need to reload the whole list. */
  private async reloadNote(id: string): Promise<void> {
    try {
      this.remember(await firstValueFrom(this.noteService.getById(id)));
    } catch {
      await this.refresh();
    }
  }

  private remember(note: Note): void {
    if (this._notes().some((n) => n.id === note.id)) {
      this._notes.update((notes) => notes.map((n) => (n.id === note.id ? note : n)));
    } else {
      this._opened.update((opened) => ({ ...opened, [note.id]: note }));
    }
  }

  /**
   * Every write reports its outcome as a toast (specs/web-experience "Operation feedback").
   * Rethrows so callers can keep a form open on failure.
   */
  private async mutate(request: Observable<unknown>, successMessage: string, errorFallback: string): Promise<void> {
    try {
      await firstValueFrom(request);
      this.notifications.success(successMessage);
    } catch (err) {
      if (!isHandledGlobally(err)) {
        this.notifications.error(apiErrorMessage(err, errorFallback));
      }
      throw err;
    }
  }
}
