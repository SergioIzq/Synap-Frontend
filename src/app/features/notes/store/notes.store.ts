import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { NoteService } from '../../../core/services/api/note.service';
import { NotificationService } from '../../../core/services/notification.service';
import { apiErrorMessage, isHandledGlobally } from '../../../core/utils/http-errors';
import { CreateNoteRequest, Note, UpdateNoteRequest } from '../../../core/models';

/** Plain signals, not @ngrx/signals - see design.md Decision 10. */
@Injectable({ providedIn: 'root' })
export class NotesStore {
  private readonly noteService = inject(NoteService);
  private readonly notifications = inject(NotificationService);

  private readonly _notes = signal<Note[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _searchTerm = signal<string | null>(null);
  private readonly _tag = signal<string | null>(null);

  readonly notes = this._notes.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly searchTerm = this._searchTerm.asReadonly();
  readonly tag = this._tag.asReadonly();

  readonly allTags = computed(() => {
    const tags = new Set<string>();
    for (const note of this._notes()) {
      for (const tag of note.tags) tags.add(tag);
    }
    return [...tags].sort();
  });

  noteById(id: string): Note | undefined {
    return this._notes().find((n) => n.id === id);
  }

  async search(searchTerm: string | null, tag: string | null): Promise<void> {
    this._searchTerm.set(searchTerm);
    this._tag.set(tag);
    this._loading.set(true);
    this._error.set(null);
    try {
      this._notes.set(await firstValueFrom(this.noteService.search(searchTerm, tag)));
    } catch (err) {
      this._error.set(apiErrorMessage(err, 'No se pudieron cargar las notas.'));
    } finally {
      this._loading.set(false);
    }
  }

  async refresh(): Promise<void> {
    await this.search(this._searchTerm(), this._tag());
  }

  async create(request: CreateNoteRequest): Promise<void> {
    await this.mutate(this.noteService.create(request), 'Nota guardada', 'No se pudo crear la nota.');
    await this.refresh();
  }

  async update(id: string, request: UpdateNoteRequest): Promise<void> {
    await this.mutate(this.noteService.update(id, request), 'Nota actualizada', 'No se pudo actualizar la nota.');
    await this.refresh();
  }

  async delete(id: string): Promise<void> {
    await this.mutate(this.noteService.delete(id), 'Nota eliminada', 'No se pudo eliminar la nota.');
    this._notes.update((notes) => notes.filter((n) => n.id !== id));
  }

  async addTag(id: string, tagName: string): Promise<void> {
    await this.mutate(this.noteService.addTag(id, tagName), `Etiqueta #${tagName} añadida`, 'No se pudo añadir la etiqueta.');
    await this.refresh();
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
