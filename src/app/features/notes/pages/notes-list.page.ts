import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { MessageModule } from 'primeng/message';
import { NotesStore } from '../store/notes.store';
import { NoteCardComponent } from '../components/note-card.component';

@Component({
  selector: 'app-notes-list-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    ReactiveFormsModule,
    InputTextModule,
    InputGroupModule,
    InputGroupAddonModule,
    ButtonModule,
    SelectModule,
    MessageModule,
    NoteCardComponent,
  ],
  styles: [`
    h2 { margin: 0 0 1.25rem; font-size: 1.2rem; }

    .capture-form,
    .search-row {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1.25rem;
      align-items: center;
    }

    .capture-form {
      ::ng-deep input { flex: 1; }
    }

    .search-row {
      ::ng-deep input { flex: 1; }
    }

    .empty-state {
      color: var(--p-text-muted-color);
      text-align: center;
      padding: 2rem 0;
    }
  `],
  template: `
    <h2>Your notes</h2>

    <!-- Quick capture (specs/knowledge-vault: primary capture surface, always visible) -->
    <form class="capture-form" [formGroup]="quickCaptureForm" (ngSubmit)="submitQuickCapture()">
      <p-inputgroup>
        <input
          pInputText
          formControlName="content"
          placeholder="Capture a thought, a snippet, a link…"
          autocomplete="off"
        />
        <p-button
          type="submit"
          icon="pi pi-plus"
          label="Add"
          [loading]="notesStore.loading()"
          [disabled]="!quickCaptureForm.getRawValue().content.trim()"
        />
      </p-inputgroup>
    </form>

    <!-- Search / filter -->
    <div class="search-row">
      <input
        pInputText
        [formControl]="searchForm.controls.term"
        placeholder="Search notes…"
        (input)="submitSearch()"
        style="flex:1"
      />
      <p-select
        [formControl]="searchForm.controls.tag"
        [options]="tagOptions()"
        optionLabel="label"
        optionValue="value"
        placeholder="All tags"
        (onChange)="submitSearch()"
        style="min-width: 140px"
      />
    </div>

    @if (notesStore.error()) {
      <p-message severity="error" styleClass="w-full" style="margin-bottom: 1rem">
        {{ notesStore.error() }}
      </p-message>
    }

    @if (notesStore.loading()) {
      <p class="empty-state">Loading…</p>
    } @else if (notesStore.notes().length === 0) {
      <p class="empty-state">No notes yet — capture your first one above.</p>
    } @else {
      @for (note of notesStore.notes(); track note.id) {
        <app-note-card [note]="note" />
      }
    }
  `,
})
export class NotesListPage implements OnInit {
  protected readonly notesStore = inject(NotesStore);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly quickCaptureForm = this.formBuilder.nonNullable.group({ content: [''] });
  protected readonly searchForm = this.formBuilder.nonNullable.group({ term: [''], tag: [''] });

  protected tagOptions() {
    return [
      { label: 'All tags', value: '' },
      ...this.notesStore.allTags().map((t) => ({ label: `#${t}`, value: t })),
    ];
  }

  ngOnInit(): void {
    void this.notesStore.search(null, null);
  }

  async submitQuickCapture(): Promise<void> {
    const content = this.quickCaptureForm.getRawValue().content.trim();
    if (!content) return;

    try {
      await this.notesStore.create({ type: 'text', title: null, content });
      this.quickCaptureForm.reset({ content: '' });
    } catch {
      // Error surfaced via notesStore.error()
    }
  }

  submitSearch(): void {
    const { term, tag } = this.searchForm.getRawValue();
    void this.notesStore.search(term.trim() || null, tag || null);
  }
}
