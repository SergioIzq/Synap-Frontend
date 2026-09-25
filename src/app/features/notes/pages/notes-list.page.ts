import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  Injector,
  afterNextRender,
  effect,
  OnInit,
  ViewChild,
  computed,
  inject,
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
import { NoteType } from '../../../core/models';
import { NotesStore } from '../store/notes.store';
import { NoteCardComponent } from '../components/note-card.component';
import { NoteComposerComponent } from '../components/note-composer.component';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

/** How far before the end of the list the next page starts loading. */
const PREFETCH_PX = 400;

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
    FormsModule,
    NoteCardComponent,
    NoteComposerComponent,
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

    .load-more { display: flex; justify-content: center; padding: 0.5rem 0 1rem; }

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

    <div class="type-row">
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
      @if (!notesStore.loading() && notesStore.totalCount() > 0) {
        <span class="count">{{ notesStore.notes().length }} de {{ notesStore.totalCount() }} notas</span>
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

    <!-- Infinite scroll: the sentinel loads the next page as it nears the viewport; the button
         is the accessible/keyboard fallback and shows while a page is loading. -->
    <div #sentinel class="scroll-sentinel" aria-hidden="true"></div>
    @if (notesStore.hasMore() && !notesStore.loading() && !notesStore.error()) {
      <div class="load-more">
        <p-button
          label="Cargar más"
          icon="pi pi-angle-down"
          severity="secondary"
          [outlined]="true"
          [loading]="notesStore.loadingMore()"
          (onClick)="notesStore.loadMore()"
        />
      </div>
    }
  `,
})
export class NotesListPage implements OnInit, AfterViewInit {
  protected readonly notesStore = inject(NotesStore);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly searchForm = this.formBuilder.nonNullable.group({ term: [''], tag: [''] });

  @ViewChild('searchInput') private searchInput?: ElementRef<HTMLInputElement>;
  @ViewChild('sentinel') private sentinel?: ElementRef<HTMLElement>;
  @ViewChild(NoteComposerComponent) private composer?: NoteComposerComponent;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private observer?: IntersectionObserver;

  constructor() {
    // After every render of the list, check again: on a tall screen the sentinel can stay
    // visible after a page is appended, and the observer only reports *changes*.
    effect(() => {
      this.notesStore.notes();
      this.scheduleLoadCheck();
    });
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
    void this.notesStore.search();
  }

  protected changeType(type: NoteType | null): void {
    const { term, tag } = this.searchForm.getRawValue();
    void this.notesStore.search({ term: term.trim() || null, tag: tag || null, type });
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
    void this.notesStore.search();
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

    if (!this.sentinel || typeof IntersectionObserver === 'undefined') return;

    // Starts loading a little before the end is actually reached.
    // The observer's entries can be computed before a freshly loaded page is painted (the
    // sentinel still sits at the top), so they only trigger a check against the live layout.
    this.observer = new IntersectionObserver(() => this.scheduleLoadCheck(), { rootMargin: `0px 0px ${PREFETCH_PX}px 0px` });
    this.observer.observe(this.sentinel.nativeElement);
    this.destroyRef.onDestroy(() => this.observer?.disconnect());
  }

  /** Loads the next page once the current one is rendered, if the end is near by then. */
  private scheduleLoadCheck(): void {
    afterNextRender(
      () => {
        const sentinel = this.sentinel?.nativeElement;
        if (!sentinel || this.notesStore.notes().length === 0) return;
        if (sentinel.getBoundingClientRect().top <= window.innerHeight + PREFETCH_PX) {
          void this.notesStore.loadMore();
        }
      },
      { injector: this.injector },
    );
  }

  submitSearch(): void {
    const { term, tag } = this.searchForm.getRawValue();
    void this.notesStore.search({ term: term.trim() || null, tag: tag || null, type: this.notesStore.type() });
  }
}
