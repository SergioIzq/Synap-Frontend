import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MarkdownService } from '../../../core/services/markdown.service';
import { NoteService } from '../../../core/services/api/note.service';
import { RelatedNote } from '../../../core/models';
import { NotesStore } from '../store/notes.store';

@Component({
  selector: 'app-note-detail-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    @if (note(); as note) {
      <main class="note-detail-page">
        <a routerLink="/notes">&larr; Back</a>

        @if (editing()) {
          <form [formGroup]="editForm" (ngSubmit)="save()">
            <input type="text" formControlName="title" placeholder="Title (optional)" />
            <textarea formControlName="content" rows="12"></textarea>
            <div class="actions">
              <button type="submit">Save</button>
              <button type="button" (click)="editing.set(false)">Cancel</button>
            </div>
          </form>
        } @else {
          @if (note.title) {
            <h1>{{ note.title }}</h1>
          }

          @switch (note.type) {
            @case ('codeSnippet') {
              <div class="code-block">
                <button type="button" (click)="copyToClipboard(note.content)">
                  {{ copied() ? 'Copied!' : 'Copy' }}
                </button>
                <pre><code [innerHTML]="highlightedContent()"></code></pre>
              </div>
            }
            @case ('bookmark') {
              <div class="bookmark-card">
                @if (note.metadataImageUrl) {
                  <img [src]="note.metadataImageUrl" alt="" />
                }
                <h2>{{ note.metadataTitle ?? note.content }}</h2>
                @if (note.metadataDescription) {
                  <p>{{ note.metadataDescription }}</p>
                }
                <a [href]="note.content" target="_blank" rel="noopener">{{ note.content }}</a>
              </div>
            }
            @default {
              <div [innerHTML]="renderedMarkdown()"></div>
            }
          }

          <div class="actions">
            <button type="button" (click)="editing.set(true)">Edit</button>
            <button type="button" (click)="deleteNote()">Delete</button>
          </div>

          <section class="tags">
            @for (tag of note.tags; track tag) {
              <span class="tag-chip">#{{ tag }}</span>
            }
            <form [formGroup]="tagForm" (ngSubmit)="addTag()">
              <input type="text" formControlName="tagName" placeholder="Add tag" />
              <button type="submit">Add</button>
            </form>
          </section>

          @if (relatedNotes().length > 0) {
            <section class="related-notes">
              <h3>Related notes</h3>
              @for (related of relatedNotes(); track related.id) {
                <a class="related-note" [routerLink]="['/notes', related.id]">
                  {{ related.title ?? preview(related.content) }}
                </a>
              }
            </section>
          }
        }

        @if (notesStore.error()) {
          <p class="error" role="alert">{{ notesStore.error() }}</p>
        }
      </main>
    } @else {
      <p>Note not found.</p>
    }
  `,
})
export class NoteDetailPage implements OnInit {
  protected readonly notesStore = inject(NotesStore);
  private readonly noteService = inject(NoteService);
  private readonly markdownService = inject(MarkdownService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);

  private readonly noteId = signal(this.route.snapshot.paramMap.get('id')!);
  protected readonly note = computed(() => this.notesStore.noteById(this.noteId()));
  protected readonly relatedNotes = signal<RelatedNote[]>([]);

  protected readonly editing = signal(false);
  protected readonly copied = signal(false);

  protected readonly editForm = this.formBuilder.nonNullable.group({ title: [''], content: [''] });
  protected readonly tagForm = this.formBuilder.nonNullable.group({ tagName: [''] });

  protected readonly renderedMarkdown = computed(() => this.markdownService.toSafeHtml(this.note()?.content ?? ''));
  protected readonly highlightedContent = computed(() => this.markdownService.highlightCode(this.note()?.content ?? ''));

  async ngOnInit(): Promise<void> {
    if (this.notesStore.notes().length === 0) {
      await this.notesStore.search(null, null);
    }

    const note = this.note();
    if (note) {
      this.editForm.setValue({ title: note.title ?? '', content: note.content });
    }

    // specs/ai-assistant "Semantic relations between notes" - best-effort: an empty panel is a
    // fine fallback if the AI service is briefly unavailable, not worth surfacing as an error.
    this.noteService.getRelated(this.noteId()).subscribe({
      next: (related) => this.relatedNotes.set(related),
      error: () => this.relatedNotes.set([]),
    });
  }

  async save(): Promise<void> {
    const note = this.note();
    if (!note) return;

    const { title, content } = this.editForm.getRawValue();
    try {
      await this.notesStore.update(note.id, { title: title.trim() || null, content });
      this.editing.set(false);
    } catch {
      // Error is already surfaced via notesStore.error().
    }
  }

  async deleteNote(): Promise<void> {
    const note = this.note();
    if (!note) return;

    try {
      await this.notesStore.delete(note.id);
      await this.router.navigateByUrl('/notes');
    } catch {
      // Error is already surfaced via notesStore.error().
    }
  }

  async addTag(): Promise<void> {
    const note = this.note();
    const tagName = this.tagForm.getRawValue().tagName.trim();
    if (!note || !tagName) return;

    try {
      await this.notesStore.addTag(note.id, tagName);
      this.tagForm.reset({ tagName: '' });
    } catch {
      // Error is already surfaced via notesStore.error().
    }
  }

  async copyToClipboard(content: string): Promise<void> {
    await navigator.clipboard.writeText(content);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }

  preview(content: string): string {
    return content.length > 80 ? content.slice(0, 80) + '…' : content;
  }
}
