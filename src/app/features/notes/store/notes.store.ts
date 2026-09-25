import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, firstValueFrom, from } from 'rxjs';
import { NoteService } from '../../../core/services/api/note.service';
import { NotificationService } from '../../../core/services/notification.service';
import { apiErrorMessage, isHandledGlobally } from '../../../core/utils/http-errors';
import { CreateNoteRequest, Note, NoteType, UpdateNoteRequest } from '../../../core/models';

export interface NoteFilters {
  term: string | null;
  tag: string | null;
  type: NoteType | null;
}

const NO_FILTERS: NoteFilters = { term: null, tag: null, type: null };

/**
 * Plain signals, not @ngrx/signals - see design.md Decision 10. The list is paged
 * (backend-hardening): `search()` loads page 1 for new filters, `loadMore()` appends the next
 * page. Notes opened directly (detail page, assistant sources) that aren't in the loaded pages
 * are fetched by id and kept apart in `_opened`.
 */
@Injectable({ providedIn: 'root' })
export class NotesStore {
  private readonly noteService = inject(NoteService);
  private readonly notifications = inject(NotificationService);

  private readonly _notes = signal<Note[]>([]);
  private readonly _opened = signal<Record<string, Note>>({});
  private readonly _page = signal(0);
  private readonly _totalCount = signal(0);
  private readonly _loading = signal(false);
  private readonly _loadingMore = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _filters = signal<NoteFilters>(NO_FILTERS);
  private readonly _tags = signal<string[]>([]);

  /** Bumped on every new search so a slow, stale response can't overwrite a newer one. */
  private searchGeneration = 0;

  readonly notes = this._notes.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly loadingMore = this._loadingMore.asReadonly();
  readonly error = this._error.asReadonly();
  readonly totalCount = this._totalCount.asReadonly();
  readonly filters = this._filters.asReadonly();
  readonly searchTerm = computed(() => this._filters().term);
  readonly tag = computed(() => this._filters().tag);
  readonly type = computed(() => this._filters().type);
  readonly hasMore = computed(() => this._notes().length < this._totalCount());
  /** All the user's tags (GET /api/tags) - not just those on the loaded page. */
  readonly allTags = this._tags.asReadonly();

  noteById(id: string): Note | undefined {
    return this._notes().find((n) => n.id === id) ?? this._opened()[id];
  }

  async search(filters: Partial<NoteFilters> = {}): Promise<void> {
    const next: NoteFilters = { ...NO_FILTERS, ...filters };
    this._filters.set(next);
    const generation = ++this.searchGeneration;

    this._loading.set(true);
    this._error.set(null);
    try {
      const page = await firstValueFrom(this.noteService.search({ ...next, page: 1 }));
      if (generation !== this.searchGeneration) return;
      this._notes.set(page.items);
      this._page.set(1);
      this._totalCount.set(page.totalCount);
    } catch (err) {
      if (generation !== this.searchGeneration) return;
      this._error.set(apiErrorMessage(err, 'No se pudieron cargar las notas.'));
    } finally {
      if (generation === this.searchGeneration) this._loading.set(false);
    }
  }

  async loadMore(): Promise<void> {
    if (this._loading() || this._loadingMore() || !this.hasMore()) return;

    const generation = this.searchGeneration;
    this._loadingMore.set(true);
    try {
      const page = await firstValueFrom(this.noteService.search({ ...this._filters(), page: this._page() + 1 }));
      if (generation !== this.searchGeneration) return;
      // A note created meanwhile shifts pages by one - never show the same note twice.
      const known = new Set(this._notes().map((n) => n.id));
      this._notes.update((notes) => [...notes, ...page.items.filter((n) => !known.has(n.id))]);
      this._page.set(page.page);
      this._totalCount.set(page.totalCount);
    } catch (err) {
      if (!isHandledGlobally(err)) {
        this.notifications.error(apiErrorMessage(err, 'No se pudieron cargar más notas.'));
      }
    } finally {
      this._loadingMore.set(false);
    }
  }

  async refresh(): Promise<void> {
    await this.search(this._filters());
  }

  async loadTags(): Promise<void> {
    try {
      this._tags.set(await firstValueFrom(this.noteService.listTags()));
    } catch {
      // Best-effort: the filter just offers fewer tags.
    }
  }

  /** Makes sure a note is available to noteById(), fetching it by id when it isn't loaded. */
  async ensureNote(id: string): Promise<void> {
    if (this.noteById(id)) return;
    try {
      this.remember(await firstValueFrom(this.noteService.getById(id)));
    } catch {
      // 404 (not the user's, or deleted): the detail page shows "not found".
    }
  }

  async create(request: CreateNoteRequest): Promise<void> {
    await this.mutate(this.noteService.create(request), 'Nota guardada', 'No se pudo crear la nota.');
    await this.refresh();
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
    this._notes.update((notes) => notes.filter((n) => n.id !== id));
    this._totalCount.update((total) => Math.max(0, total - 1));
    this._opened.update(({ [id]: _, ...rest }) => rest);
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
