import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  OnInit,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { animate, query, stagger, style, transition, trigger } from '@angular/animations';
import { InputTextModule } from 'primeng/inputtext';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { SelectButtonModule } from 'primeng/selectbutton';
import { PaginatorModule, PaginatorState } from 'primeng/paginator';
import { NoteType } from '../../../core/models';
import { DEFAULT_QUERY, NotesQuery, NotesStore, PAGE_SIZE_OPTIONS } from '../store/notes.store';
import { NoteCardComponent } from '../components/note-card.component';
import { NoteComposerComponent } from '../components/note-composer.component';
import { ActivatedRoute, ParamMap, Params, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

const NOTE_TYPES: readonly NoteType[] = ['text', 'codeSnippet', 'bookmark'];

/** Reads the list's URL (`?q=&tag=&type=&page=&size=`), clamping anything invalid to its default. */
export function queryFromParams(params: ParamMap): NotesQuery {
  const type = params.get('type') as NoteType | null;
  const page = Number(params.get('page'));
  const size = Number(params.get('size'));
  return {
    term: params.get('q')?.trim() || null,
    tag: params.get('tag') || null,
    type: type && NOTE_TYPES.includes(type) ? type : null,
    page: Number.isInteger(page) && page >= 1 ? page : DEFAULT_QUERY.page,
    pageSize: (PAGE_SIZE_OPTIONS as readonly number[]).includes(size) ? size : DEFAULT_QUERY.pageSize,
  };
}

/** Only non-default values end up in the URL; null removes a param when merging. */
export function paramsFromQuery(query: NotesQuery): Params {
  return {
    q: query.term || null,
    tag: query.tag || null,
    type: query.type || null,
    page: query.page !== DEFAULT_QUERY.page ? query.page : null,
    size: query.pageSize !== DEFAULT_QUERY.pageSize ? query.pageSize : null,
  };
}

function sameQuery(a: NotesQuery, b: NotesQuery): boolean {
  return a.term === b.term && a.tag === b.tag && a.type === b.type && a.page === b.page && a.pageSize === b.pageSize;
}

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
    SelectButtonModule,
    PaginatorModule,
    FormsModule,
    NoteCardComponent,
    NoteComposerComponent,
    RouterLink,
  ],
  styles: [`
    h2 { margin: 0 0 1.25rem; font-size: 1.15rem; font-weight: 700; letter-spacing: -0.02em; }

    .search-row {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1.25rem;
      align-items: center;
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

    .type-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 1.25rem;

      .count { font-size: 0.8rem; color: var(--p-text-muted-color); }
    }

    .pager { padding: 0.5rem 0 1rem; }
    .pager ::ng-deep .p-paginator { background: transparent; flex-wrap: wrap; row-gap: 0.25rem; }
    .pager ::ng-deep .p-paginator-current { width: 100%; justify-content: center; text-align: center; order: 9; }

    @media (max-width: 767px) {
      .search-row { flex-direction: column; align-items: stretch; }
      .type-row p-selectbutton { width: 100%; overflow-x: auto; }
      .search-row p-select { width: 100%; }
      .shortcut-hint { display: none; }
    }
  `],
  template: `
    <h2>Tus notas <small class="shortcut-hint" style="font-weight: 400; font-size: 0.75rem; color: var(--p-text-muted-color)">· <kbd>/</kbd> para buscar</small></h2>

    <!-- Composer (specs/knowledge-vault "Capture a note": title, tags and type in one step) -->
    <app-note-composer />

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

    <div class="type-row" #listTop>
      <p-selectbutton
        [options]="typeOptions"
        [ngModel]="notesStore.type()"
        (ngModelChange)="changeType($event)"
        optionLabel="label"
        optionValue="value"
        [allowEmpty]="false"
        size="small"
        aria-label="Filtrar por tipo"
      />
      @if (notesStore.tag(); as tag) {
        <p-button
          icon="pi pi-sparkles"
          [label]="'Preguntar sobre #' + tag"
          size="small"
          severity="secondary"
          [outlined]="true"
          routerLink="/app/assistant"
          [queryParams]="{ tag: tag }"
        />
      }
      @if (!notesStore.loading() && notesStore.totalCount() > 0) {
        <span class="count">{{ notesStore.totalCount() }} {{ notesStore.totalCount() === 1 ? 'nota' : 'notas' }}</span>
      }
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

    <!-- Page controls (fix-notes-list): hidden when everything fits on one page. -->
    @if (!notesStore.error() && notesStore.pageCount() > 1) {
      <nav class="pager" aria-label="Paginación de notas">
        <p-paginator
          [first]="(notesStore.page() - 1) * notesStore.pageSize()"
          [rows]="notesStore.pageSize()"
          [totalRecords]="notesStore.totalCount()"
          [rowsPerPageOptions]="pageSizeOptions"
          [pageLinkSize]="narrow() ? 3 : 5"
          [showCurrentPageReport]="true"
          currentPageReportTemplate="Mostrando {first}–{last} de {totalRecords}"
          (onPageChange)="changePage($event)"
        />
      </nav>
    }
  `,
})
export class NotesListPage implements OnInit, AfterViewInit {
  protected readonly notesStore = inject(NotesStore);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly searchForm = this.formBuilder.nonNullable.group({ term: [''], tag: [''] });
  protected readonly pageSizeOptions = [...PAGE_SIZE_OPTIONS];

  @ViewChild('searchInput') private searchInput?: ElementRef<HTMLInputElement>;
  @ViewChild('listTop') private listTop?: ElementRef<HTMLElement>;
  @ViewChild(NoteComposerComponent) private composer?: NoteComposerComponent;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** Fewer page links on phones so the controls fit at 360px. */
  protected readonly narrow = signal(false);

  constructor() {
    // The URL drives the list, but the store can settle on another page than the one asked
    // for (a page past the last one, a deleted note, a new note on page 1): mirror that back
    // without adding a history entry.
    effect(() => {
      const shown = this.notesStore.query();
      if (this.notesStore.loading()) return;
      untracked(() => {
        if (!sameQuery(shown, queryFromParams(this.route.snapshot.queryParamMap))) {
          void this.navigate(shown, true);
        }
      });
    });

    if (typeof matchMedia !== 'undefined') {
      const mobile = matchMedia('(max-width: 767px)');
      this.narrow.set(mobile.matches);
      const onChange = (e: MediaQueryListEvent) => this.narrow.set(e.matches);
      mobile.addEventListener('change', onChange);
      this.destroyRef.onDestroy(() => mobile.removeEventListener('change', onChange));
    }
  }

  protected readonly typeOptions: { label: string; value: NoteType | null }[] = [
    { label: 'Todas', value: null },
    { label: 'Texto', value: 'text' },
    { label: 'Código', value: 'codeSnippet' },
    { label: 'Enlaces', value: 'bookmark' },
  ];

  protected readonly hasFilters = computed(
    () => !!this.notesStore.searchTerm() || !!this.notesStore.tag() || !!this.notesStore.type(),
  );

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
    void this.navigate({ ...this.notesStore.query(), term: null, tag: null, type: null, page: 1 });
  }

  protected changeType(type: NoteType | null): void {
    void this.navigate({ ...this.formFilters(), type, page: 1 });
  }

  protected changePage(event: PaginatorState): void {
    const current = this.notesStore.query();
    const pageSize = event.rows ?? current.pageSize;
    // A new page size starts over at page 1: the old page number means other notes now.
    const page = pageSize !== current.pageSize ? 1 : (event.page ?? 0) + 1;
    if (page === current.page && pageSize === current.pageSize) return;

    void this.navigate({ ...current, page, pageSize }).then(() =>
      this.listTop?.nativeElement.scrollIntoView({ block: 'start' }),
    );
  }

  protected focusCapture(): void {
    this.composer?.open();
  }

  protected tagOptions() {
    return [
      { label: 'Todas las etiquetas', value: '' },
      ...this.notesStore.allTags().map((t) => ({ label: `#${t}`, value: t })),
    ];
  }

  ngOnInit(): void {
    // Every URL change (typing a filter, a page, Back/Forward, a shared link) loads that page;
    // the first emission always loads, so the list is fresh when coming back to it.
    let first = true;
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const query = queryFromParams(params);
      this.searchForm.setValue({ term: query.term ?? '', tag: query.tag ?? '' }, { emitEvent: false });
      if (first || !sameQuery(query, this.notesStore.query())) {
        void this.notesStore.search(query);
      }
      first = false;
    });
    void this.notesStore.loadTags();
  }

  ngAfterViewInit(): void {
    // "n" shortcut / links land here with ?compose=1: open the composer, then drop the flag so
    // a reload or Back doesn't reopen it.
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      if (params.get('compose') !== '1') return;
      this.composer?.open();
      void this.router.navigate([], { queryParams: { compose: null }, queryParamsHandling: 'merge', replaceUrl: true });
    });
  }

  submitSearch(): void {
    // Typing replaces the history entry instead of adding one per keystroke.
    void this.navigate({ ...this.formFilters(), type: this.notesStore.type(), page: 1 }, true);
  }

  /** The search box and tag select as filters, keeping the current page size. */
  private formFilters(): NotesQuery {
    const { term, tag } = this.searchForm.getRawValue();
    return { ...this.notesStore.query(), term: term.trim() || null, tag: tag || null };
  }

  private navigate(query: NotesQuery, replaceUrl = false): Promise<boolean> {
    return this.router.navigate([], {
      relativeTo: this.route,
      queryParams: paramsFromQuery(query),
      queryParamsHandling: 'merge',
      replaceUrl,
    });
  }
}
