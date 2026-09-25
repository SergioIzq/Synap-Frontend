import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTagsModule } from 'primeng/inputtags';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { Note, NoteType, RelatedNote } from '../../../core/models';
import { NoteService } from '../../../core/services/api/note.service';
import { MarkdownService } from '../../../core/services/markdown.service';
import { NotificationService } from '../../../core/services/notification.service';
import { formatDateTime, parseApiDate } from '../../../core/utils/dates';
import { RelativeTimePipe } from '../../../shared/pipes/relative-time.pipe';
import { NotesStore } from '../store/notes.store';
import { tagSuggestions } from '../../../shared/tag-suggestions';

const TYPE_META: Record<NoteType, { icon: string; label: string }> = {
  text: { icon: 'pi pi-align-left', label: 'Texto' },
  codeSnippet: { icon: 'pi pi-code', label: 'Código' },
  bookmark: { icon: 'pi pi-link', label: 'Enlace' },
};

@Component({
  selector: 'app-note-detail-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonModule,
    InputTagsModule,
    InputTextModule,
    MessageModule,
    SkeletonModule,
    TagModule,
    TextareaModule,
    RelativeTimePipe,
  ],
  styles: [`
    :host { display: block; max-width: 900px; }

    .toolbar { display: flex; align-items: center; gap: 0.25rem; margin-bottom: 1rem; }
    .toolbar .spacer { flex: 1; }

    .sheet {
      padding: 1.25rem 1.4rem;
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-border-radius-lg, 10px);
      background: var(--p-content-background);
    }

    h1 { margin: 0 0 0.4rem; font-size: 1.45rem; letter-spacing: -0.02em; line-height: 1.25; overflow-wrap: anywhere; }
    h1.untitled { color: var(--p-text-muted-color); font-weight: 500; }

    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem 0.9rem;
      margin-bottom: 1.1rem;
      font-size: 0.8rem;
      color: var(--p-text-muted-color);

      .type { color: var(--p-primary-color); font-weight: 600; }
      i { margin-right: 0.25rem; }
    }

    pre {
      margin: 0;
      padding: 1rem;
      overflow-x: auto;
      font-size: 0.875rem;
      font-family: var(--synap-font-mono, monospace);
      background: var(--synap-code-bg);
      border-radius: 8px;
    }

    .bookmark img { max-width: 100%; max-height: 220px; object-fit: cover; border-radius: 8px; margin-bottom: 0.75rem; }
    .bookmark h2 { margin: 0 0 0.35rem; font-size: 1.1rem; }
    .bookmark a { overflow-wrap: anywhere; }

    .tags { margin-top: 1.1rem; display: flex; flex-wrap: wrap; gap: 0.35rem; }

    .edit-form { display: grid; gap: 0.75rem; }
    .edit-form textarea { min-height: 240px; font-family: inherit; }
    .edit-actions { display: flex; justify-content: flex-end; align-items: center; gap: 0.5rem; }
    .hint { font-size: 0.75rem; color: var(--p-text-muted-color); margin-right: auto; }

    .related { margin-top: 1.5rem; }
    .related h3 { margin: 0 0 0.5rem; font-size: 0.95rem; }
    .related a { display: block; padding: 0.35rem 0; font-size: 0.9rem; color: var(--p-primary-color); text-decoration: none; }
    .related a:hover { text-decoration: underline; }

    @media (max-width: 767px) {
      .sheet { padding: 1rem; }
      .hint { display: none; }
    }
  `],
  template: `
    <div class="toolbar">
      <p-button routerLink="/app/notes" icon="pi pi-arrow-left" label="Notas" severity="secondary" [text]="true" />
      <span class="spacer"></span>
      @if (note(); as n) {
        @if (!editing()) {
          <p-button icon="pi pi-copy" severity="secondary" [text]="true" ariaLabel="Copiar contenido" (onClick)="copy(n)" />
          <p-button icon="pi pi-pencil" severity="secondary" [text]="true" ariaLabel="Editar nota" (onClick)="startEdit(n)" />
          <p-button icon="pi pi-trash" severity="danger" [text]="true" ariaLabel="Eliminar nota" (onClick)="confirmDelete()" />
        }
      }
    </div>

    @if (note(); as n) {
      <article class="sheet">
        @if (editing()) {
          <form class="edit-form" [formGroup]="editForm" (ngSubmit)="save(n)" (keydown)="onEditKeydown($event, n)">
            <input pInputText formControlName="title" placeholder="Título (opcional)" aria-label="Título" maxlength="200" />
            <textarea pTextarea formControlName="content" [autoResize]="true" rows="10" aria-label="Contenido"></textarea>
            @if (n.tags.length > 0) {
              <div class="tags" style="margin-top: 0">
                @for (tag of n.tags; track tag) {
                  <p-tag [value]="'#' + tag" severity="secondary" />
                }
              </div>
            }
            <p-inputtags
              formControlName="newTags"
              [suggestions]="tags.suggestions()"
              (input)="tags.onInput($event)"
              [typeahead]="true"
              [addOnBlur]="true"
              delimiter=","
              placeholder="Añadir etiquetas: escribe y pulsa Enter"
              ariaLabel="Añadir etiquetas"
              styleClass="w-full"
            />
            <div class="edit-actions">
              <span class="hint">Ctrl/⌘ + Enter para guardar · Esc para cancelar</span>
              <p-button type="button" label="Cancelar" severity="secondary" [text]="true" (onClick)="editing.set(false)" />
              <p-button type="submit" label="Guardar" icon="pi pi-check" [loading]="saving()" [disabled]="!editForm.getRawValue().content.trim()" />
            </div>
          </form>
        } @else {
          <h1 [class.untitled]="!displayTitle(n)">{{ displayTitle(n) ?? 'Sin título' }}</h1>
          <div class="meta">
            <span class="type"><i [class]="meta(n).icon"></i>{{ meta(n).label }}</span>
            <span [title]="fullDate(n.createdAt)"><i class="pi pi-calendar"></i>Creada {{ n.createdAt | relativeTime }}</span>
            @if (wasEdited(n)) {
              <span [title]="fullDate(n.updatedAt)"><i class="pi pi-pencil"></i>Editada {{ n.updatedAt | relativeTime }}</span>
            }
          </div>

          @switch (n.type) {
            @case ('codeSnippet') {
              <pre><code [innerHTML]="highlightedContent()"></code></pre>
            }
            @case ('bookmark') {
              <div class="bookmark">
                @if (n.metadataImageUrl) {
                  <img [src]="n.metadataImageUrl" alt="" />
                }
                @if (n.metadataDescription) {
                  <p>{{ n.metadataDescription }}</p>
                }
                <a [href]="n.content" target="_blank" rel="noopener">{{ n.content }} <i class="pi pi-external-link" style="font-size: 0.75rem"></i></a>
              </div>
            }
            @default {
              <!-- Markdown rendered via MarkdownService; content is from our own trusted backend -->
              <div class="markdown-body" [innerHTML]="renderedMarkdown()"></div>
            }
          }

          @if (n.tags.length > 0) {
            <div class="tags">
              @for (tag of n.tags; track tag) {
                <p-tag [value]="'#' + tag" severity="secondary" />
              }
            </div>
          }
        }
      </article>

      @if (relatedNotes().length > 0 && !editing()) {
        <section class="related">
          <h3>Notas relacionadas</h3>
          @for (related of relatedNotes(); track related.id) {
            <a [routerLink]="['/app/notes', related.id]">{{ related.title ?? preview(related.content) }}</a>
          }
        </section>
      }
    } @else if (loading()) {
      <p-skeleton height="2rem" width="60%" styleClass="mb-3" />
      <p-skeleton height="12rem" borderRadius="10px" />
    } @else {
      <div class="empty-block">
        <i class="pi pi-question-circle"></i>
        <h3>Nota no encontrada</h3>
        <p>Puede que se haya eliminado o que el enlace no sea correcto.</p>
        <p-button label="Volver a tus notas" icon="pi pi-arrow-left" routerLink="/app/notes" />
      </div>
    }
  `,
})
export class NoteDetailPage {
  protected readonly notesStore = inject(NotesStore);
  private readonly noteService = inject(NoteService);
  private readonly markdownService = inject(MarkdownService);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly formBuilder = inject(FormBuilder);

  /** Follows the route: moving to a related note reuses this component with a new id. */
  private readonly newTags = signal<string[]>([]);

  private readonly noteId = toSignal(inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('id')!)), {
    requireSync: true,
  });

  protected readonly note = computed(() => this.notesStore.noteById(this.noteId()));
  protected readonly relatedNotes = signal<RelatedNote[]>([]);
  protected readonly loading = signal(true);
  protected readonly editing = signal(false);
  protected readonly saving = signal(false);

  protected readonly editForm = this.formBuilder.nonNullable.group({
    title: [''],
    content: [''],
    newTags: this.formBuilder.nonNullable.control<string[]>([]),
  });

  /** Suggest only tags the note doesn't have yet (existing ones + ones typed in this edit). */
  protected readonly tags = tagSuggestions(
    this.notesStore.allTags,
    computed(() => [...(this.note()?.tags ?? []), ...this.newTags()]),
  );

  // toSafeHtml already calls bypassSecurityTrustHtml; content is from our own trusted backend
  protected readonly renderedMarkdown = computed(() => this.markdownService.toSafeHtml(this.note()?.content ?? ''));
  protected readonly highlightedContent = computed(() => this.markdownService.highlightCode(this.note()?.content ?? ''));

  constructor() {
    this.editForm.controls.newTags.valueChanges.pipe(takeUntilDestroyed()).subscribe((tags) => {
      this.newTags.set(tags);
      this.tags.reset(); // PrimeNG clears the field after adding a chip without an input event.
    });

    effect(() => {
      const id = this.noteId();
      untracked(() => void this.load(id));
    });
  }

  private async load(id: string): Promise<void> {
    this.editing.set(false);
    this.relatedNotes.set([]);
    this.loading.set(true);

    // The list is paged and may be filtered: a note opened from an assistant source, a related
    // note or a direct link is fetched by id when it isn't among the loaded ones.
    await this.notesStore.ensureNote(id);
    this.loading.set(false);

    // specs/ai-assistant "Semantic relations" - best-effort, empty panel is fine on failure
    this.noteService.getRelated(id).subscribe({
      next: (related) => this.relatedNotes.set(related),
      error: () => this.relatedNotes.set([]),
    });
  }

  protected meta(note: Note) {
    return TYPE_META[note.type] ?? TYPE_META.text;
  }

  protected displayTitle(note: Note): string | null {
    return note.title ?? (note.type === 'bookmark' ? note.metadataTitle : null);
  }

  protected wasEdited(note: Note): boolean {
    return parseApiDate(note.updatedAt).getTime() - parseApiDate(note.createdAt).getTime() > 60_000;
  }

  protected fullDate(value: string): string {
    return formatDateTime(value);
  }

  protected startEdit(note: Note): void {
    this.editForm.reset({ title: note.title ?? '', content: note.content, newTags: [] });
    this.newTags.set([]);
    this.tags.reset();
    this.editing.set(true);
  }

  protected onEditKeydown(event: KeyboardEvent, note: Note): void {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void this.save(note);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.editing.set(false);
    }
  }

  async save(note: Note): Promise<void> {
    const { title, content, newTags } = this.editForm.getRawValue();
    if (!content.trim() || this.saving()) return;

    const known = new Set(note.tags.map((t) => t.toLowerCase()));
    const tagsToAdd = newTags.map((t) => t.trim().replace(/^#/, '')).filter((t) => t && !known.has(t.toLowerCase()));

    this.saving.set(true);
    try {
      await this.notesStore.updateWithTags(note.id, { title: title.trim() || null, content }, tagsToAdd);
      this.editing.set(false);
    } catch {
      // Failure already reported as a toast by NotesStore; keep the form open.
    } finally {
      this.saving.set(false);
    }
  }

  /** specs/web-experience "Destructive actions require confirmation". */
  protected confirmDelete(): void {
    this.confirmationService.confirm({
      header: 'Eliminar nota',
      message: 'La nota se eliminará definitivamente. ¿Continuar?',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () => void this.deleteNote(),
    });
  }

  private async deleteNote(): Promise<void> {
    const note = this.note();
    if (!note) return;

    try {
      await this.notesStore.delete(note.id);
      await this.router.navigateByUrl('/app/notes');
    } catch {
      // Failure already reported as a toast by NotesStore
    }
  }

  protected async copy(note: Note): Promise<void> {
    try {
      await navigator.clipboard.writeText(note.content);
      this.notifications.success('Copiado');
    } catch {
      this.notifications.warn('No se pudo copiar', 'Selecciona el texto y cópialo manualmente.');
    }
  }

  protected preview(content: string): string {
    return content.length > 80 ? content.slice(0, 80) + '…' : content;
  }
}
