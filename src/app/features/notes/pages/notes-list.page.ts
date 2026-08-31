import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { NotesStore } from '../store/notes.store';
import { NoteCardComponent } from '../components/note-card.component';

@Component({
  selector: 'app-notes-list-page',
  standalone: true,
  imports: [ReactiveFormsModule, NoteCardComponent],
  template: `
    <main class="notes-page">
      <h1>Synap</h1>

      <!-- Primary capture surface (specs/knowledge-vault) - always visible, no menu to dig through. -->
      <form class="quick-capture" [formGroup]="quickCaptureForm" (ngSubmit)="submitQuickCapture()">
        <input
          type="text"
          formControlName="content"
          placeholder="Capture a thought, a snippet, a link..."
          autocomplete="off"
        />
        <button type="submit" [disabled]="quickCaptureForm.invalid || notesStore.loading()">Add</button>
      </form>

      <form class="search-bar" [formGroup]="searchForm" (ngSubmit)="submitSearch()">
        <input type="search" formControlName="term" placeholder="Search notes..." />
        <select formControlName="tag" (change)="submitSearch()">
          <option value="">All tags</option>
          @for (tag of notesStore.allTags(); track tag) {
            <option [value]="tag">#{{ tag }}</option>
          }
        </select>
      </form>

      @if (notesStore.error()) {
        <p class="error" role="alert">{{ notesStore.error() }}</p>
      }

      @if (notesStore.loading()) {
        <p>Loading...</p>
      } @else if (notesStore.notes().length === 0) {
        <p>No notes yet - capture your first one above.</p>
      } @else {
        @for (note of notesStore.notes(); track note.id) {
          <app-note-card [note]="note" />
        }
      }
    </main>
  `,
})
export class NotesListPage implements OnInit {
  protected readonly notesStore = inject(NotesStore);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly quickCaptureForm = this.formBuilder.nonNullable.group({ content: [''] });
  protected readonly searchForm = this.formBuilder.nonNullable.group({ term: [''], tag: [''] });

  ngOnInit(): void {
    void this.notesStore.search(null, null);
  }

  async submitQuickCapture(): Promise<void> {
    const content = this.quickCaptureForm.getRawValue().content.trim();
    if (!content) {
      return;
    }

    try {
      await this.notesStore.create({ type: 'text', title: null, content });
      this.quickCaptureForm.reset({ content: '' });
    } catch {
      // Error is already surfaced via notesStore.error().
    }
  }

  submitSearch(): void {
    const { term, tag } = this.searchForm.getRawValue();
    void this.notesStore.search(term.trim() || null, tag.trim() || null);
  }
}
