import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { TagModule } from 'primeng/tag';
import { MessageModule } from 'primeng/message';
import { MarkdownService } from '../../../core/services/markdown.service';
import { NoteService } from '../../../core/services/api/note.service';
import { RelatedNote } from '../../../core/models';
import { NotesStore } from '../store/notes.store';

@Component({
  selector: 'app-note-detail-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    CardModule,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    TagModule,
    MessageModule,
  ],
  styles: [`
    .detail-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.5rem;

      h1 { margin: 0; font-size: 1.4rem; flex: 1; }
    }

    .actions {
      display: flex;
      gap: 0.5rem;
    }

    .markdown-body { margin-top: 0.5rem; }

    .code-block {
      position: relative;

      pre {
        margin: 0;
        padding: 1rem;
        background: var(--p-surface-100);
        border-radius: 6px;
        overflow-x: auto;
        font-size: 0.9rem;
      }

      .copy-btn {
        position: absolute;
        top: 0.5rem;
        right: 0.5rem;
      }
    }

    .tags-section {
      margin-top: 1.5rem;
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      align-items: center;
    }

    .add-tag-form {
      display: flex;
      gap: 0.4rem;
      align-items: center;

      input { width: 120px; }
    }

    .related-section {
      margin-top: 1.5rem;

      h3 { margin-bottom: 0.5rem; font-size: 1rem; }
    }

    .related-link {
      display: block;
      padding: 0.4rem 0;
      color: var(--p-primary-color);
      text-decoration: none;
      font-size: 0.9rem;

      &:hover { text-decoration: underline; }
    }

    .bookmark-image {
      max-width: 100%;
      max-height: 200px;
      object-fit: cover;
      border-radius: 6px;
      margin-bottom: 0.75rem;
    }

    .edit-form {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;

      textarea { min-height: 240px; }
    }
  `],
  template: `
    @if (note(); as note) {
      @if (editing()) {
        <form class="edit-form" [formGroup]="editForm" (ngSubmit)="save()">
          <input pInputText formControlName="title" placeholder="Título (opcional)" />
          <textarea pTextarea formControlName="content" [rows]="14" autoResize></textarea>
          <div class="actions">
            <p-button type="submit" label="Guardar" icon="pi pi-check" />
            <p-button
              type="button"
              label="Cancelar"
              icon="pi pi-times"
              severity="secondary"
              (onClick)="editing.set(false)"
            />
          </div>
        </form>
      } @else {
        <div class="detail-header">
          <p-button
            routerLink="/app/notes"
            icon="pi pi-arrow-left"
            severity="secondary"
            [text]="true"
            label="Volver"
          />
          @if (note.title) {
            <h1>{{ note.title }}</h1>
          }
          <div class="actions">
            <p-button
              icon="pi pi-pencil"
              severity="secondary"
              [text]="true"
              (onClick)="startEdit(note)"
            />
            <p-button
              icon="pi pi-trash"
              severity="danger"
              [text]="true"
              (onClick)="deleteNote()"
            />
          </div>
        </div>

        <p-card>
          @switch (note.type) {
            @case ('codeSnippet') {
              <div class="code-block">
                <p-button
                  class="copy-btn"
                  [label]="copied() ? '¡Copiado!' : 'Copiar'"
                  icon="pi pi-copy"
                  size="small"
                  severity="secondary"
                  [text]="true"
                  (onClick)="copyToClipboard(note.content)"
                />
                <pre><code [innerHTML]="highlightedContent()"></code></pre>
              </div>
            }
            @case ('bookmark') {
              @if (note.metadataImageUrl) {
                <img [src]="note.metadataImageUrl" alt="" class="bookmark-image" />
              }
              <h2>{{ note.metadataTitle ?? note.content }}</h2>
              @if (note.metadataDescription) {
                <p>{{ note.metadataDescription }}</p>
              }
              <a [href]="note.content" target="_blank" rel="noopener">{{ note.content }}</a>
            }
            @default {
              <!-- Markdown rendered via MarkdownService; content is from our own trusted backend -->
              <div class="markdown-body" [innerHTML]="renderedMarkdown()"></div>
            }
          }

          <div class="tags-section">
            @for (tag of note.tags; track tag) {
              <p-tag [value]="'#' + tag" severity="secondary" />
            }
            <form class="add-tag-form" [formGroup]="tagForm" (ngSubmit)="addTag()">
              <input pInputText formControlName="tagName" placeholder="Añadir etiqueta" />
              <p-button type="submit" icon="pi pi-tag" size="small" severity="secondary" />
            </form>
          </div>
        </p-card>

        @if (relatedNotes().length > 0) {
          <div class="related-section">
            <h3>Notas relacionadas</h3>
            @for (related of relatedNotes(); track related.id) {
              <a class="related-link" [routerLink]="['/app/notes', related.id]">
                {{ related.title ?? preview(related.content) }}
              </a>
            }
          </div>
        }
      }

      @if (notesStore.error()) {
        <p-message severity="error" styleClass="w-full" style="margin-top: 1rem">
          {{ notesStore.error() }}
        </p-message>
      }
    } @else {
      <p>Nota no encontrada.</p>
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

  // toSafeHtml already calls bypassSecurityTrustHtml; content is from our own trusted backend
  protected readonly renderedMarkdown = computed(() =>
    this.markdownService.toSafeHtml(this.note()?.content ?? ''),
  );

  protected readonly highlightedContent = computed(() =>
    this.markdownService.highlightCode(this.note()?.content ?? ''),
  );

  async ngOnInit(): Promise<void> {
    if (this.notesStore.notes().length === 0) {
      await this.notesStore.search(null, null);
    }

    const note = this.note();
    if (note) {
      this.editForm.setValue({ title: note.title ?? '', content: note.content });
    }

    // specs/ai-assistant "Semantic relations" - best-effort, empty panel is fine on failure
    this.noteService.getRelated(this.noteId()).subscribe({
      next: (related) => this.relatedNotes.set(related),
      error: () => this.relatedNotes.set([]),
    });
  }

  startEdit(note: { title: string | null; content: string }): void {
    this.editForm.setValue({ title: note.title ?? '', content: note.content });
    this.editing.set(true);
  }

  async save(): Promise<void> {
    const note = this.note();
    if (!note) return;

    const { title, content } = this.editForm.getRawValue();
    try {
      await this.notesStore.update(note.id, { title: title.trim() || null, content });
      this.editing.set(false);
    } catch {
      // Error surfaced via notesStore.error()
    }
  }

  async deleteNote(): Promise<void> {
    const note = this.note();
    if (!note) return;

    try {
      await this.notesStore.delete(note.id);
      await this.router.navigateByUrl('/app/notes');
    } catch {
      // Error surfaced via notesStore.error()
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
      // Error surfaced via notesStore.error()
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
