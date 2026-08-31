import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { NoteService } from '../../../core/services/api/note.service';
import { ApiResult, CreateNoteRequest, Note, UpdateNoteRequest } from '../../../core/models';

/** Plain signals, not @ngrx/signals - see design.md Decision 10. */
@Injectable({ providedIn: 'root' })
export class NotesStore {
  private readonly noteService = inject(NoteService);

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
      this._error.set(this.extractErrorMessage(err, 'Could not load notes.'));
    } finally {
      this._loading.set(false);
    }
  }

  async refresh(): Promise<void> {
    await this.search(this._searchTerm(), this._tag());
  }

  async create(request: CreateNoteRequest): Promise<void> {
    this._error.set(null);
    try {
      await firstValueFrom(this.noteService.create(request));
      await this.refresh();
    } catch (err) {
      this._error.set(this.extractErrorMessage(err, 'Could not create note.'));
      throw err;
    }
  }

  async update(id: string, request: UpdateNoteRequest): Promise<void> {
    this._error.set(null);
    try {
      await firstValueFrom(this.noteService.update(id, request));
      await this.refresh();
    } catch (err) {
      this._error.set(this.extractErrorMessage(err, 'Could not update note.'));
      throw err;
    }
  }

  async delete(id: string): Promise<void> {
    this._error.set(null);
    try {
      await firstValueFrom(this.noteService.delete(id));
      this._notes.update((notes) => notes.filter((n) => n.id !== id));
    } catch (err) {
      this._error.set(this.extractErrorMessage(err, 'Could not delete note.'));
      throw err;
    }
  }

  async addTag(id: string, tagName: string): Promise<void> {
    this._error.set(null);
    try {
      await firstValueFrom(this.noteService.addTag(id, tagName));
      await this.refresh();
    } catch (err) {
      this._error.set(this.extractErrorMessage(err, 'Could not add tag.'));
      throw err;
    }
  }

  private extractErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof HttpErrorResponse) {
      const apiResult = err.error as ApiResult | undefined;
      return apiResult?.error?.message ?? fallback;
    }
    return fallback;
  }
}
