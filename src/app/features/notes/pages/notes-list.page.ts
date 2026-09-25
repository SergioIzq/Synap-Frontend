import { ChangeDetectionStrategy, Component, ElementRef, HostListener, OnInit, ViewChild, computed, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { animate, query, stagger, style, transition, trigger } from '@angular/animations';
import { InputTextModule } from 'primeng/inputtext';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { NotesStore } from '../store/notes.store';
import { NoteCardComponent } from '../components/note-card.component';

const listAnimation = trigger('listAnimation', [
  transition('* => *', [
    query(':enter', [
      style({ opacity: 0, transform: 'translateY(6px)' }),
      stagger(55, [
        animate('220ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
    ], { optional: true }),
  ]),
]);

@Component({
  selector: 'app-notes-list-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  animations: [listAnimation],
  imports: [
    ReactiveFormsModule,
    InputTextModule,
    InputGroupModule,
    InputGroupAddonModule,
    ButtonModule,
    SelectModule,
    MessageModule,
    SkeletonModule,
    NoteCardComponent,
  ],
  styles: [`
    h2 { margin: 0 0 1.25rem; font-size: 1.15rem; font-weight: 700; letter-spacing: -0.02em; }

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

    kbd {
      font-family: inherit;
      font-size: 0.75rem;
      padding: 0.05rem 0.35rem;
      border: 1px solid var(--p-content-border-color);
      border-radius: 4px;
    }

    .search-row .search-input { flex: 1; min-width: 0; }

    @media (max-width: 767px) {
      .search-row { flex-direction: column; align-items: stretch; }
      .search-row p-select { width: 100%; }
      .shortcut-hint { display: none; }
    }
  `],
  template: `
    <h2>Tus notas <small class="shortcut-hint" style="font-weight: 400; font-size: 0.75rem; color: var(--p-text-muted-color)">· <kbd>/</kbd> para buscar</small></h2>

    <!-- Quick capture (specs/knowledge-vault: primary capture surface, always visible) -->
    <form class="capture-form" [formGroup]="quickCaptureForm" (ngSubmit)="submitQuickCapture()">
      <p-inputgroup>
        <input
          pInputText
          formControlName="content"
          placeholder="Anota un pensamiento, un fragmento, un enlace…"
          autocomplete="off"
          aria-label="Nueva nota"
          (keydown.control.enter)="submitQuickCapture()"
          (keydown.meta.enter)="submitQuickCapture()"
        />
        <p-button
          type="submit"
          icon="pi pi-plus"
          label="Añadir"
          [loading]="notesStore.loading()"
          [disabled]="!quickCaptureForm.getRawValue().content.trim()"
        />
      </p-inputgroup>
    </form>

    <!-- Search / filter -->
    <div class="search-row">
      <input
        #searchInput
        pInputText
        class="search-input"
        type="search"
        [formControl]="searchForm.controls.term"
        placeholder="Buscar notas…"
        aria-label="Buscar notas"
        aria-keyshortcuts="/"
        (input)="submitSearch()"
      />
      <p-select
        [formControl]="searchForm.controls.tag"
        [options]="tagOptions()"
        optionLabel="label"
        optionValue="value"
        placeholder="Todas las etiquetas"
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
      <p-skeleton height="80px" styleClass="mb-3" borderRadius="8px" />
      <p-skeleton height="80px" styleClass="mb-3" borderRadius="8px" />
      <p-skeleton height="80px" styleClass="mb-3" borderRadius="8px" />
    } @else if (notesStore.error()) {
      <!-- Load failed: the message above explains it - never claim the vault is empty. -->
    } @else if (notesStore.notes().length === 0 && hasFilters()) {
      <div class="empty-block">
        <i class="pi pi-search"></i>
        <h3>Sin resultados</h3>
        <p>Ninguna nota coincide con tu búsqueda.</p>
        <p-button label="Limpiar filtros" icon="pi pi-filter-slash" severity="secondary" [outlined]="true" (onClick)="clearFilters()" />
      </div>
    } @else if (notesStore.notes().length === 0) {
      <div class="empty-block">
        <i class="pi pi-lightbulb"></i>
        <h3>Tu segundo cerebro está vacío</h3>
        <p>Escribe arriba una idea, un fragmento de código o pega un enlace. Synap lo guarda y lo conecta con el resto.</p>
        <p-button label="Capturar la primera nota" icon="pi pi-pencil" (onClick)="focusCapture()" />
      </div>
    } @else {
      <div [@listAnimation]="notesStore.notes().length">
        @for (note of notesStore.notes(); track note.id) {
          <app-note-card [note]="note" />
        }
      </div>
    }
  `,
})
export class NotesListPage implements OnInit {
  protected readonly notesStore = inject(NotesStore);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly quickCaptureForm = this.formBuilder.nonNullable.group({ content: [''] });
  protected readonly searchForm = this.formBuilder.nonNullable.group({ term: [''], tag: [''] });

  @ViewChild('searchInput') private searchInput?: ElementRef<HTMLInputElement>;
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  protected readonly hasFilters = computed(() => !!this.notesStore.searchTerm() || !!this.notesStore.tag());

  /** "/" focuses search - unless the user is already typing somewhere. */
  @HostListener('document:keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;

    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;

    event.preventDefault();
    this.searchInput?.nativeElement.focus();
  }

  protected clearFilters(): void {
    this.searchForm.reset({ term: '', tag: '' });
    void this.notesStore.search(null, null);
  }

  protected focusCapture(): void {
    this.host.nativeElement.querySelector<HTMLInputElement>('.capture-form input')?.focus();
  }

  protected tagOptions() {
    return [
      { label: 'Todas las etiquetas', value: '' },
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
      // Failure already reported as a toast by NotesStore
    }
  }

  submitSearch(): void {
    const { term, tag } = this.searchForm.getRawValue();
    void this.notesStore.search(term.trim() || null, tag || null);
  }
}
