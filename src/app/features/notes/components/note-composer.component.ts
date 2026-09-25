import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  afterNextRender,
  inject,
  Injector,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTagsModule } from 'primeng/inputtags';
import { InputTextModule } from 'primeng/inputtext';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TextareaModule } from 'primeng/textarea';
import { NoteType } from '../../../core/models';
import { NotesStore } from '../store/notes.store';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { tagSuggestions } from '../../../shared/tag-suggestions';

const MAX_TAGS = 10;

/**
 * Capture a complete note - title, content, tags and type - without leaving the list
 * (specs/knowledge-vault "Capture a note"). Collapsed it's the familiar one-line input;
 * focusing it (or pressing "n" anywhere, or ?compose=1) expands the full form.
 */
@Component({
  selector: 'app-note-composer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ReactiveFormsModule, ButtonModule, InputTagsModule, InputTextModule, SelectButtonModule, TextareaModule],
  styles: [`
    :host { display: block; margin-bottom: 1.25rem; }

    .collapsed {
      display: flex;
      gap: 0.5rem;
      input { flex: 1; min-width: 0; cursor: text; }
    }

    .composer {
      display: grid;
      gap: 0.6rem;
      padding: 0.9rem;
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-border-radius-lg, 10px);
      background: var(--p-content-background);
      box-shadow: var(--synap-card-hover-shadow);
      animation: open 0.16s ease-out;
    }

    @keyframes open { from { opacity: 0; transform: translateY(-4px); } }

    .title { font-weight: 600; }
    textarea { min-height: 96px; resize: vertical; }

    .footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .actions { display: flex; align-items: center; gap: 0.4rem; margin-left: auto; }
    .hint { font-size: 0.75rem; color: var(--p-text-muted-color); }

    @media (max-width: 767px) {
      .hint { display: none; }
      .footer p-selectbutton { width: 100%; }
    }
  `],
  template: `
    @if (!expanded()) {
      <div class="collapsed">
        <input
          pInputText
          readonly
          placeholder="Anota un pensamiento, un fragmento, un enlace…"
          aria-label="Nueva nota"
          (focus)="open()"
          (click)="open()"
        />
        <p-button icon="pi pi-plus" label="Nueva" (onClick)="open()" />
      </div>
    } @else {
      <form class="composer" [formGroup]="form" (ngSubmit)="save()" (keydown)="onKeydown($event)" aria-label="Nueva nota">
        <input pInputText class="title" formControlName="title" placeholder="Título (opcional)" maxlength="200" aria-label="Título" />
        <textarea
          #content
          pTextarea
          formControlName="content"
          [autoResize]="true"
          rows="3"
          placeholder="Escribe la nota, pega un fragmento de código o un enlace…"
          aria-label="Contenido"
        ></textarea>
        <p-inputtags
          formControlName="tags"
          [suggestions]="tags.suggestions()"
          (input)="tags.onInput($event)"
          [typeahead]="true"
          [addOnBlur]="true"
          [addOnTab]="true"
          delimiter=","
          [max]="maxTags"
          placeholder="Etiquetas (Enter o coma para añadir)"
          ariaLabel="Etiquetas"
          styleClass="w-full"
        />
        <div class="footer">
          <p-selectbutton
            formControlName="type"
            [options]="typeOptions"
            optionLabel="label"
            optionValue="value"
            [allowEmpty]="false"
            size="small"
            aria-label="Tipo de nota"
          />
          <div class="actions">
            <span class="hint">Ctrl/⌘ + Enter</span>
            <p-button label="Cancelar" severity="secondary" [text]="true" size="small" (onClick)="cancel()" />
            <p-button type="submit" label="Guardar" icon="pi pi-check" size="small" [loading]="saving()" [disabled]="!hasContent()" />
          </div>
        </div>
      </form>
    }
  `,
})
export class NoteComposerComponent {
  protected readonly notesStore = inject(NotesStore);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly injector = inject(Injector);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly maxTags = MAX_TAGS;
  protected readonly typeOptions: { label: string; value: NoteType | null }[] = [
    { label: 'Auto', value: null },
    { label: 'Texto', value: 'text' },
    { label: 'Código', value: 'codeSnippet' },
    { label: 'Enlace', value: 'bookmark' },
  ];

  protected readonly form = this.formBuilder.group({
    title: this.formBuilder.nonNullable.control(''),
    content: this.formBuilder.nonNullable.control(''),
    tags: this.formBuilder.nonNullable.control<string[]>([]),
    type: this.formBuilder.control<NoteType | null>(null),
  });

  protected readonly tags = tagSuggestions(
    this.notesStore.allTags,
    toSignal(this.form.controls.tags.valueChanges, { initialValue: [] as string[] }),
  );

  protected readonly expanded = signal(false);

  constructor() {
    // PrimeNG clears the field after adding a chip without an input event - reset the filter.
    this.form.controls.tags.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.tags.reset());
  }
  protected readonly saving = signal(false);

  /** Expands the composer and focuses the content (used by the "n" shortcut and ?compose=1). */
  open(): void {
    this.expanded.set(true);
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLTextAreaElement>('textarea')?.focus(), {
      injector: this.injector,
    });
  }

  protected hasContent(): boolean {
    return this.form.controls.content.value.trim().length > 0;
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void this.save();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.cancel();
    }
  }

  async save(): Promise<void> {
    if (!this.hasContent() || this.saving()) return;

    const { title, content, tags, type } = this.form.getRawValue();
    this.saving.set(true);
    try {
      await this.notesStore.create({ type, title: title.trim() || null, content, tags });
      void this.notesStore.loadTags();
      this.close();
    } catch {
      // NotesStore already showed the error toast; keep the text so nothing is lost.
    } finally {
      this.saving.set(false);
    }
  }

  protected cancel(): void {
    const { title, content, tags } = this.form.getRawValue();
    if (!title.trim() && !content.trim() && tags.length === 0) {
      this.close();
      return;
    }

    this.confirmationService.confirm({
      header: 'Descartar nota',
      message: 'Perderás lo que has escrito. ¿Descartar?',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Descartar',
      rejectLabel: 'Seguir escribiendo',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () => this.close(),
    });
  }

  /** Esc anywhere collapses an empty composer, even when focus is outside the form. */
  @HostListener('document:keydown.escape')
  protected onDocumentEscape(): void {
    if (this.expanded() && !this.host.nativeElement.contains(document.activeElement)) {
      this.cancel();
    }
  }

  private close(): void {
    this.form.reset({ title: '', content: '', tags: [], type: null });
    this.tags.reset();
    this.expanded.set(false);
  }
}
