import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, catchError, debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ChipModule } from 'primeng/chip';
import { NotificationService } from '../../../core/services/notification.service';
import { MarkdownService } from '../../../core/services/markdown.service';
import { NoteService } from '../../../core/services/api/note.service';
import {
  AssistantAction,
  AssistantAnswer,
  AssistantScope,
  GLOBAL_SCOPE,
  Note,
  SETTINGS_FIXABLE_STATUSES,
} from '../../../core/models';
import { NotesStore } from '../../notes/store/notes.store';
import { SettingsStore } from '../../settings/store/settings.store';
import { AssistantStore } from '../store/assistant.store';

/** Preview used for a note without a title (same length as the backend's source titles). */
const PREVIEW_CHARS = 60;

export function noteLabel(note: Pick<Note, 'title' | 'content'>): string {
  const title = note.title?.trim();
  if (title) return title;
  const text = note.content.replace(/[#>*_`~\[\]()!-]/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length <= PREVIEW_CHARS ? text : `${text.slice(0, PREVIEW_CHARS).trimEnd()}…`;
}

/** The "@texto" / "#texto" being typed at the end of the input, if any. */
export function scopeToken(value: string): { trigger: '@' | '#'; text: string; start: number } | null {
  const match = /(^|\s)([@#])([^\s@#]*)$/.exec(value);
  if (!match) return null;
  return { trigger: match[2] as '@' | '#', text: match[3], start: match.index + match[1].length };
}

/** Predefined questions per scope (scoped-assistant design.md Decision 5). */
export function quickActions(scope: AssistantScope): string[] {
  switch (scope.kind) {
    case 'global':
      return [];
    case 'note':
      return scope.noteType === 'bookmark'
        ? []
        : [
            'Resume esta nota',
            '¿Cuáles son los puntos clave?',
            ...(scope.noteType === 'codeSnippet' ? ['Explícame este código paso a paso'] : []),
          ];
    case 'tag':
      return [`Resume lo que sé sobre #${scope.tag}`, `¿Qué conclusiones o patrones se repiten en #${scope.tag}?`];
  }
}

/** How an action is shown under its answer: label, icon and where selecting it leads. */
export interface ActionChip {
  label: string;
  icon: string;
  link: string[];
  fragment?: string;
}

/** specs/ai-assistant "Actions shown in the answer". */
export function actionChip(action: AssistantAction): ActionChip {
  const note = action.title?.trim() || 'una nota';
  const noteLink = action.noteId ? ['/app/notes', action.noteId] : ['/app/notes'];
  switch (action.type) {
    case 'noteCreated':
      return { label: `Nota creada: ${note}`, icon: 'pi pi-file-plus', link: noteLink };
    case 'tagsAdded': {
      const tags = (action.tags ?? []).map((tag) => `#${tag}`).join(' ');
      const plural = (action.tags?.length ?? 0) > 1;
      return {
        label: `${plural ? 'Etiquetas' : 'Etiqueta'} ${tags} ${plural ? 'añadidas' : 'añadida'} a ${note}`,
        icon: 'pi pi-tag',
        link: noteLink,
      };
    }
    case 'memorySaved':
      return { label: `Recordado: ${action.text ?? ''}`.trim(), icon: 'pi pi-lightbulb', link: ['/app/settings'], fragment: 'memoria' };
  }
}

interface PickerOption {
  label: string;
  hint?: string;
  disabled?: boolean;
  scope: AssistantScope;
}

@Component({
  selector: 'app-assistant-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    NgTemplateOutlet,
    ReactiveFormsModule,
    RouterLink,
    InputGroupModule,
    InputTextModule,
    ButtonModule,
    MessageModule,
    ChipModule,
  ],
  styles: [`
    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      margin-bottom: 1.5rem;

      h2 { margin: 0; font-size: 1.15rem; font-weight: 700; letter-spacing: -0.02em; }
    }

    .suggestions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 0.5rem;
      margin-top: 0.5rem;
    }

    .sources {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.4rem;
      margin-top: 0.6rem;

      a { text-decoration: none; }
      ::ng-deep .p-chip { cursor: pointer; font-size: 0.8rem; }
    }

    .done-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      margin-top: 0.6rem;

      a { text-decoration: none; max-width: 100%; }
      ::ng-deep .p-chip { cursor: pointer; font-size: 0.8rem; max-width: 100%; }
      ::ng-deep .p-chip-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    }

    .answer-actions { display: flex; justify-content: flex-end; margin-top: 0.25rem; }

    .scope-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 1rem;

      ::ng-deep .p-chip { max-width: 100%; }
      ::ng-deep .p-chip-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    }

    .quick-actions { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 1rem; }

    .partial-note { margin-top: 0.5rem; font-size: 0.8rem; color: var(--p-text-muted-color); }

    .input-wrap { position: relative; }

    .picker {
      position: absolute;
      left: 0;
      right: 0;
      bottom: calc(100% + 0.35rem);
      max-height: 16rem;
      overflow-y: auto;
      margin: 0;
      padding: 0.25rem;
      list-style: none;
      background: var(--p-content-background);
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-border-radius, 6px);
      box-shadow: 0 6px 20px rgb(0 0 0 / 0.12);
      z-index: 10;

      li {
        padding: 0.5rem 0.65rem;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.9rem;
        overflow-wrap: anywhere;

        &.active { background: var(--p-content-hover-background, var(--synap-nav-hover-bg)); }
        &[aria-disabled='true'] { cursor: not-allowed; opacity: 0.6; }
        small { display: block; color: var(--p-text-muted-color); font-size: 0.75rem; }
      }
    }

    .chat-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-bottom: 1.5rem;
    }

    /* Each exchange: user bubble then Synap bubble */
    .msg-exchange {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      animation: msgIn 0.2s ease-out;
    }

    @keyframes msgIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .msg-user {
      align-self: flex-end;
      max-width: 75%;
      background: var(--synap-bubble-user-bg);
      color: var(--synap-bubble-user-text);
      border-radius: 16px 16px 4px 16px;
      padding: 0.625rem 1rem;
      font-size: 0.925rem;
      line-height: 1.5;
    }

    .msg-synap-wrap {
      align-self: flex-start;
      max-width: 85%;
    }

    .msg-synap-label {
      font-size: 0.675rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--p-primary-color);
      margin: 0 0 0.3rem 0.75rem;
    }

    .msg-synap {
      background: var(--p-content-background);
      border: 1px solid var(--p-content-border-color);
      border-radius: 16px 16px 16px 4px;
      padding: 0.75rem 1rem;
      font-size: 0.925rem;
      line-height: 1.55;
    }

    /* Typing indicator */
    .typing-dots {
      display: flex;
      gap: 5px;
      align-items: center;
      padding: 0.25rem 0;
    }

    .typing-dots span {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--p-text-muted-color);
      animation: dotPulse 1.2s ease-in-out infinite;
    }

    .typing-dots span:nth-child(2) { animation-delay: 0.16s; }
    .typing-dots span:nth-child(3) { animation-delay: 0.32s; }

    @keyframes dotPulse {
      0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
      40%           { transform: scale(1);   opacity: 1; }
    }

    .grounded-note {
      margin-top: 0.5rem;
      font-size: 0.8rem;
      color: var(--p-text-muted-color);
    }

    .input-row {
      display: flex;
      gap: 0.5rem;
    }

    /* Answers that are a problem (no key, invalid key, quota, outage) rather than content */
    .msg-synap.is-problem {
      background: color-mix(in srgb, var(--synap-warn) 8%, var(--p-content-background));
      border-color: color-mix(in srgb, var(--synap-warn) 35%, transparent);
    }

    .problem-body {
      display: flex;
      gap: 0.6rem;
      align-items: flex-start;

      > i { color: var(--synap-warn); margin-top: 0.2rem; }
    }

    .problem-action { margin-top: 0.6rem; }

    .key-warning {
      margin-bottom: 1.5rem;

      .key-warning-body {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
        align-items: flex-start;
      }

      strong { display: block; margin-bottom: 0.15rem; }
      p { margin: 0; line-height: 1.5; }
    }
  `],
  template: `
    <div class="page-header">
      <h2>Pregunta a Synap</h2>
      @if (assistantStore.messages().length > 0) {
        <p-button
          label="Nueva conversación"
          icon="pi pi-plus"
          size="small"
          severity="secondary"
          [text]="true"
          [disabled]="isPending()"
          (onClick)="assistantStore.clear()"
        />
      }
    </div>

    @if (scope().kind !== 'global') {
      <div class="scope-bar">
        <p-chip
          [label]="'Sobre: ' + scopeLabel()"
          [icon]="scope().kind === 'tag' ? 'pi pi-hashtag' : 'pi pi-file'"
          [removable]="true"
          (onRemove)="clearScope()"
        />
      </div>
      @if (scopeUnsupported()) {
        <p-message severity="info" styleClass="w-full" style="display: block; margin-bottom: 1rem">
          Todavía no puedes preguntar sobre enlaces: Synap solo guarda la dirección, no el contenido del artículo.
        </p-message>
      } @else if (actions().length > 0 && !needsKey()) {
        <div class="quick-actions">
          @for (action of actions(); track action) {
            <p-button [label]="action" size="small" severity="secondary" [outlined]="true" [rounded]="true" [disabled]="isPending()" (onClick)="askSuggestion(action)" />
          }
        </div>
      }
    }

    @if (needsKey()) {
      <div class="key-warning">
      <p-message severity="warn" styleClass="w-full">
        <div class="key-warning-body">
          <div>
            <strong>Configura tu API key de Groq para usar el asistente</strong>
            <p>
              Cada usuario usa su propia key (Groq tiene un plan gratuito), así el asistente responde con tu cuenta.
              Solo tardas un minuto.
            </p>
          </div>
          <p-button label="Configurar API key" icon="pi pi-key" size="small" routerLink="/app/settings" fragment="ai" />
        </div>
      </p-message>
      </div>
    }

    @if (assistantStore.messages().length === 0 && !needsKey() && scope().kind === 'global') {
      <div class="empty-block">
        <i class="pi pi-sparkles"></i>
        <h3>Pregunta sobre lo que has guardado</h3>
        <p>Synap responde a partir de tus propias notas y te dice en cuáles se ha basado.</p>
        <div class="suggestions">
          @for (suggestion of suggestions; track suggestion) {
            <p-button [label]="suggestion" size="small" severity="secondary" [outlined]="true" [rounded]="true" (onClick)="askSuggestion(suggestion)" />
          }
        </div>
      </div>
    }

    <div class="chat-list" #chatList>
      @for (message of assistantStore.messages(); track $index) {
        <div class="msg-exchange">
          <div class="msg-user">{{ message.question }}</div>

          <div class="msg-synap-wrap">
            <p class="msg-synap-label">Synap</p>
            <div class="msg-synap" [class.is-problem]="isProblem(message.answer)">
              @if (message.pending) {
                <div class="typing-dots">
                  <span></span><span></span><span></span>
                </div>
              } @else if (message.answer && isProblem(message.answer)) {
                <div class="problem-body">
                  <i class="pi pi-exclamation-triangle"></i>
                  <div>
                    <div>{{ message.answer.answer }}</div>
                    @if (needsSettingsLink(message.answer)) {
                      <p-button
                        styleClass="problem-action"
                        label="Ir a Configuración"
                        icon="pi pi-cog"
                        size="small"
                        [outlined]="true"
                        routerLink="/app/settings"
                        fragment="ai"
                      />
                    }
                    <ng-container *ngTemplateOutlet="doneActions; context: { $implicit: message.answer }" />
                  </div>
                </div>
              } @else if (message.answer) {
                <!-- Markdown rendered via MarkdownService; content is from our own trusted backend -->
                <div class="markdown-body" [innerHTML]="renderMarkdown(message.answer.answer)"></div>
                @if (message.answer.partialContext) {
                  <p class="partial-note">
                    <i class="pi pi-info-circle"></i>
                    {{ message.answer.scope?.tag
                      ? 'No cabían todas las notas de la etiqueta: se han usado las más relacionadas con tu pregunta.'
                      : 'La nota es larga: solo se ha usado el principio.' }}
                  </p>
                }
                @if (message.answer.grounded) {
                  @if (message.answer.sources?.length) {
                    <div class="sources">
                      <span class="grounded-note" style="margin: 0">Fuentes:</span>
                      @for (source of message.answer.sources; track source.id) {
                        <a [routerLink]="['/app/notes', source.id]" [attr.aria-label]="'Abrir nota ' + source.title">
                          <p-chip [label]="source.title" icon="pi pi-file" />
                        </a>
                      }
                    </div>
                  } @else {
                    <p class="grounded-note">
                      <i class="pi pi-book"></i>
                      Basado en {{ message.answer.sourceNoteIds.length }} de tus notas.
                    </p>
                  }
                }
                <ng-container *ngTemplateOutlet="doneActions; context: { $implicit: message.answer }" />
                <div class="answer-actions">
                  <p-button
                    icon="pi pi-copy"
                    size="small"
                    severity="secondary"
                    [text]="true"
                    [rounded]="true"
                    ariaLabel="Copiar respuesta"
                    (onClick)="copyAnswer(message.answer.answer)"
                  />
                </div>
              }
            </div>
          </div>
        </div>
      }
    </div>

    <!-- What the assistant did while answering, kept even when the answer then failed. -->
    <ng-template #doneActions let-answer>
      @if (answer.actions?.length) {
        <div class="done-actions" aria-label="Acciones realizadas">
          @for (action of answer.actions; track $index) {
            @let chip = actionChip(action);
            <a [routerLink]="chip.link" [fragment]="chip.fragment" [attr.aria-label]="chip.label">
              <p-chip [label]="chip.label" [icon]="chip.icon" />
            </a>
          }
        </div>
      }
    </ng-template>

    <div class="input-row input-wrap">
      @if (pickerOpen()) {
        <ul class="picker" role="listbox" id="scope-picker" [attr.aria-label]="picker()!.trigger === '@' ? 'Elegir nota' : 'Elegir etiqueta'">
          @for (option of pickerOptions(); track $index) {
            <li
              role="option"
              [id]="'scope-option-' + $index"
              [class.active]="$index === activeOption()"
              [attr.aria-selected]="$index === activeOption()"
              [attr.aria-disabled]="!!option.disabled"
              (mousedown)="$event.preventDefault(); pick(option)"
            >
              {{ option.label }}
              @if (option.hint) {
                <small>{{ option.hint }}</small>
              }
            </li>
          } @empty {
            <li aria-disabled="true">{{ picker()!.trigger === '@' ? 'Ninguna nota coincide' : 'Ninguna etiqueta coincide' }}</li>
          }
        </ul>
      }
      <p-inputgroup style="flex: 1">
        <input
          #questionInput
          pInputText
          [formControl]="questionControl"
          [placeholder]="placeholder()"
          autocomplete="off"
          role="combobox"
          aria-autocomplete="list"
          [attr.aria-expanded]="pickerOpen()"
          aria-controls="scope-picker"
          [attr.aria-activedescendant]="pickerOpen() ? 'scope-option-' + activeOption() : null"
          (input)="onInput()"
          (keydown)="onKeydown($event)"
          (blur)="closePicker()"
        />
        <p-button
          icon="pi pi-send"
          label="Preguntar"
          [disabled]="!questionControl.value?.trim() || needsKey() || !settingsStore.loaded() || scopeUnsupported()"
          [loading]="isPending()"
          (onClick)="submit()"
        />
      </p-inputgroup>
    </div>
  `,
})
export class AssistantPage implements OnInit {
  protected readonly assistantStore = inject(AssistantStore);
  protected readonly settingsStore = inject(SettingsStore);
  private readonly markdownService = inject(MarkdownService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly notifications = inject(NotificationService);
  private readonly notesStore = inject(NotesStore);
  private readonly noteService = inject(NoteService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly actionChip = actionChip;
  protected readonly scope = this.assistantStore.scope;
  protected readonly actions = computed(() => quickActions(this.scope()));
  protected readonly scopeUnsupported = computed(() => {
    const scope = this.scope();
    return scope.kind === 'note' && scope.noteType === 'bookmark';
  });
  protected readonly scopeLabel = computed(() => {
    const scope = this.scope();
    if (scope.kind === 'tag') return `#${scope.tag}`;
    if (scope.kind === 'note') return scope.title ?? 'Nota';
    return '';
  });
  protected readonly placeholder = computed(() => {
    if (this.needsKey()) return 'Configura tu API key para preguntar';
    const scope = this.scope();
    if (scope.kind === 'note') return 'Pregunta sobre esta nota…';
    if (scope.kind === 'tag') return `Pregunta sobre #${scope.tag}…`;
    return 'Haz una pregunta… (@ para una nota, # para una etiqueta)';
  });

  // "@" / "#" pickers (scoped-assistant task 4.3)
  protected readonly picker = signal<ReturnType<typeof scopeToken>>(null);
  protected readonly pickerOptions = signal<PickerOption[]>([]);
  protected readonly activeOption = signal(0);
  protected readonly pickerOpen = computed(() => this.picker() !== null);
  private readonly noteQuery = new Subject<string>();

  protected readonly suggestions = [
    '¿Cómo resolví el último error que anoté?',
    '¿Qué enlaces guardé sobre Angular?',
    'Resume mis notas de esta semana',
  ];

  protected readonly isPending = computed(() => !!this.assistantStore.messages().at(-1)?.pending);

  @ViewChild('chatList') private chatList?: ElementRef<HTMLElement>;

  protected readonly questionControl = this.formBuilder.nonNullable.control('');

  /** Only once settings are actually loaded - never flash the warning for a user who has a key. */
  protected readonly needsKey = computed(() => this.settingsStore.loaded() && !this.settingsStore.hasGroqKey());

  constructor() {
    this.noteQuery
      .pipe(
        debounceTime(200),
        distinctUntilChanged(),
        switchMap((term) =>
          this.noteService.search({ term: term || null, page: 1, pageSize: 8 }).pipe(
            map((page) => page.items),
            catchError(() => of([] as Note[])),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((notes) => {
        if (this.picker()?.trigger !== '@') return;
        this.setOptions(notes.map((note) => this.noteOption(note)));
      });

    // specs/ai-assistant "Warning shown on entering the assistant": input disabled without a key.
    effect(() => {
      if (this.needsKey()) {
        this.questionControl.disable({ emitEvent: false });
      } else {
        this.questionControl.enable({ emitEvent: false });
      }
    });
  }

  ngOnInit(): void {
    // Always reload: a cached value may belong to a previous session on this device.
    void this.settingsStore.load();
    void this.notesStore.loadTags();

    // The scope lives in the URL (?note=<id> / ?tag=<name>), so entry points are plain links
    // and a reload keeps it (scoped-assistant design.md Decision 5).
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const noteId = params.get('note');
      const tag = params.get('tag')?.trim().replace(/^#+/, '').trim();
      if (noteId) {
        void this.openNoteScope(noteId);
      } else if (tag) {
        this.assistantStore.setScope({ kind: 'tag', tag });
      } else {
        this.assistantStore.setScope(GLOBAL_SCOPE);
      }
    });
  }

  private async openNoteScope(noteId: string): Promise<void> {
    const cached = this.notesStore.noteById(noteId);
    // Show the right conversation straight away; the title arrives with the note.
    this.assistantStore.setScope(cached ? this.noteScope(cached) : { kind: 'note', noteId });
    if (cached) return;

    const outcome = await this.notesStore.ensureNote(noteId);
    const note = this.notesStore.noteById(noteId);
    if (this.route.snapshot.queryParamMap.get('note') !== noteId) return;

    if (outcome === 'missing') {
      // specs/ai-assistant "Scoped note deleted".
      this.notifications.warn('La nota ya no existe', 'Se ha descartado su conversación.');
      this.assistantStore.forget({ kind: 'note', noteId });
      void this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
    } else if (note) {
      this.assistantStore.setScope(this.noteScope(note));
    }
  }

  private noteScope(note: Note): AssistantScope {
    return { kind: 'note', noteId: note.id, title: noteLabel(note), noteType: note.type };
  }

  protected clearScope(): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }

  // ---- "@" / "#" pickers ----

  protected onInput(): void {
    const token = scopeToken(this.questionControl.value);
    this.picker.set(token);
    if (!token) return;

    if (token.trigger === '#') {
      const text = token.text.toLowerCase();
      const tags = this.notesStore.allTags().filter((t) => t.toLowerCase().includes(text)).slice(0, 8);
      this.setOptions(tags.map((tag) => ({ label: `#${tag}`, scope: { kind: 'tag', tag } })));
    } else {
      this.noteQuery.next(token.text);
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (!this.pickerOpen()) {
      if (event.key === 'Enter') {
        event.preventDefault();
        void this.submit();
      }
      return;
    }

    const count = this.pickerOptions().length;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (count) this.activeOption.update((i) => (i + (event.key === 'ArrowDown' ? 1 : count - 1)) % count);
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      const option = this.pickerOptions()[this.activeOption()];
      if (option) {
        event.preventDefault();
        this.pick(option);
      } else if (event.key === 'Enter') {
        event.preventDefault();
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.closePicker();
    }
  }

  protected pick(option: PickerOption): void {
    const token = this.picker();
    if (option.disabled || !token) return;

    // The "@texto" goes away; whatever else was typed stays for the question.
    this.questionControl.setValue(this.questionControl.value.slice(0, token.start).trimEnd());
    this.closePicker();

    const scope = option.scope;
    const queryParams = scope.kind === 'note' ? { note: scope.noteId } : scope.kind === 'tag' ? { tag: scope.tag } : {};
    void this.router.navigate([], { relativeTo: this.route, queryParams });
  }

  protected closePicker(): void {
    this.picker.set(null);
    this.pickerOptions.set([]);
  }

  private setOptions(options: PickerOption[]): void {
    this.pickerOptions.set(options);
    this.activeOption.set(Math.max(0, options.findIndex((o) => !o.disabled)));
  }

  private noteOption(note: Note): PickerOption {
    const bookmark = note.type === 'bookmark';
    return {
      label: noteLabel(note),
      hint: bookmark ? 'Los enlaces aún no se pueden preguntar: solo se guarda la dirección.' : undefined,
      disabled: bookmark,
      scope: this.noteScope(note),
    };
  }

  protected isProblem(answer: AssistantAnswer | null): boolean {
    return !!answer && answer.status !== 'ok' && answer.status !== 'noRelevantNotes';
  }

  protected needsSettingsLink(answer: AssistantAnswer): boolean {
    return SETTINGS_FIXABLE_STATUSES.includes(answer.status);
  }

  // toSafeHtml already calls bypassSecurityTrustHtml; content is from our own trusted backend
  protected renderMarkdown(text: string) {
    return this.markdownService.toSafeHtml(text);
  }

  protected askSuggestion(suggestion: string): void {
    this.questionControl.setValue(suggestion);
    void this.submit();
  }

  async copyAnswer(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.notifications.success('Copiado');
    } catch {
      this.notifications.warn('No se pudo copiar', 'Selecciona el texto y cópialo manualmente.');
    }
  }

  async submit(): Promise<void> {
    const question = this.questionControl.value.trim();
    if (!question || this.needsKey() || this.scopeUnsupported()) return;

    this.questionControl.reset('');
    await this.assistantStore.ask(question);

    // Scroll to latest answer after render
    setTimeout(() => {
      this.chatList?.nativeElement.lastElementChild?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  }
}
