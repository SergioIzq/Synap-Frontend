import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { AssistantService } from '../../../core/services/api/assistant.service';
import { NoteService } from '../../../core/services/api/note.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AssistantAnswer, Note, NoteType } from '../../../core/models';
import { AuthStore } from '../../../core/stores/auth.store';
import { SettingsStore } from '../../settings/store/settings.store';
import { AssistantStore } from '../store/assistant.store';
import { AssistantPage, noteLabel, quickActions, scopeToken } from './assistant.page';

const note = (id: string, type: NoteType = 'text', title: string | null = 'Arreglo CORS'): Note => ({
  id,
  title,
  content: 'Reinicia la API con **LocalhostPolicy**.',
  type,
  createdAt: '',
  updatedAt: '',
  tags: [],
  metadataTitle: null,
  metadataDescription: null,
  metadataImageUrl: null,
});

const answer = (extra: Partial<AssistantAnswer> = {}): AssistantAnswer => ({
  answer: 'respuesta',
  sourceNoteIds: [],
  grounded: true,
  status: 'ok',
  ...extra,
});

describe('assistant page helpers', () => {
  it('detects the "@" / "#" token being typed at the end', () => {
    expect(scopeToken('¿qué dice @cors')).toEqual({ trigger: '@', text: 'cors', start: 10 });
    expect(scopeToken('#')).toEqual({ trigger: '#', text: '', start: 0 });
    expect(scopeToken('correo@dominio')).toBeNull();
    expect(scopeToken('@cors y más')).toBeNull();
  });

  it('labels a note by title, or by a short plain preview', () => {
    expect(noteLabel({ title: ' CORS ', content: 'x' })).toBe('CORS');
    expect(noteLabel({ title: null, content: '# Título\n**negrita**' })).toBe('Título negrita');
    expect(noteLabel({ title: null, content: 'a'.repeat(80) })).toBe(`${'a'.repeat(60)}…`);
  });

  it('offers quick actions suited to the scope', () => {
    expect(quickActions({ kind: 'global' })).toEqual([]);
    expect(quickActions({ kind: 'note', noteId: 'n', noteType: 'text' })).toEqual(['Resume esta nota', '¿Cuáles son los puntos clave?']);
    expect(quickActions({ kind: 'note', noteId: 'n', noteType: 'codeSnippet' })).toContain('Explícame este código paso a paso');
    expect(quickActions({ kind: 'note', noteId: 'n', noteType: 'bookmark' })).toEqual([]);
    expect(quickActions({ kind: 'tag', tag: 'python' })).toContain('Resume lo que sé sobre #python');
  });
});

describe('AssistantPage scopes', () => {
  let ask: ReturnType<typeof vi.fn>;
  let getById: ReturnType<typeof vi.fn>;
  let search: ReturnType<typeof vi.fn>;
  let warn: ReturnType<typeof vi.fn>;

  async function open(url: string) {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, AssistantPage);
    await settle(harness);
    return harness;
  }

  async function settle(harness: RouterTestingHarness) {
    for (let i = 0; i < 3; i++) {
      await new Promise((r) => setTimeout(r));
      harness.detectChanges();
    }
  }

  const text = (harness: RouterTestingHarness) => harness.routeNativeElement!.textContent ?? '';
  const buttons = (harness: RouterTestingHarness) =>
    [...harness.routeNativeElement!.querySelectorAll('button')].map((b) => b.textContent?.trim()).filter(Boolean);

  beforeEach(() => {
    localStorage.clear();
    ask = vi.fn(() => of(answer()));
    getById = vi.fn((id: string) => of(note(id)));
    search = vi.fn(() => of({ items: [note('n1'), note('b1', 'bookmark', 'Un enlace')], page: 1, pageSize: 8, totalCount: 2 }));
    warn = vi.fn();
    Element.prototype.scrollIntoView = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'assistant', component: AssistantPage }]),
        provideNoopAnimations(),
        { provide: AssistantService, useValue: { ask } },
        { provide: NoteService, useValue: { getById, search, listTags: vi.fn(() => of(['docker', 'python'])) } },
        { provide: NotificationService, useValue: { warn, success: vi.fn(), error: vi.fn() } },
        { provide: AuthStore, useValue: { userId: signal('user-a') } },
        {
          provide: SettingsStore,
          useValue: { load: vi.fn(() => Promise.resolve()), loaded: signal(true), hasGroqKey: signal(true) },
        },
      ],
    });
  });

  it('opens a note scope from the URL with its title and quick actions', async () => {
    const harness = await open('/assistant?note=n1');

    expect(text(harness)).toContain('Sobre: Arreglo CORS');
    expect(buttons(harness)).toEqual(expect.arrayContaining(['Resume esta nota', '¿Cuáles son los puntos clave?']));
    expect(buttons(harness)).not.toContain('Explícame este código paso a paso');
  });

  it('offers the code explanation for a code note and asks within the scope', async () => {
    getById.mockReturnValue(of(note('c1', 'codeSnippet')));
    const harness = await open('/assistant?note=c1');
    const explain = [...harness.routeNativeElement!.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Explícame este código'),
    )!;

    explain.click();
    await settle(harness);

    expect(ask).toHaveBeenCalledWith('Explícame este código paso a paso', expect.objectContaining({ kind: 'note', noteId: 'c1' }), []);
  });

  it('opens a tag scope from the URL', async () => {
    const harness = await open('/assistant?tag=python');

    expect(text(harness)).toContain('Sobre: #python');
    expect(buttons(harness)).toContain('Resume lo que sé sobre #python');
  });

  it('removing the scope goes back to the global conversation', async () => {
    const harness = await open('/assistant?tag=python');
    const page = harness.routeDebugElement!.componentInstance as { clearScope(): void };

    page.clearScope();
    await settle(harness);

    expect(TestBed.inject(Router).url).toBe('/assistant');
    expect(TestBed.inject(AssistantStore).scope()).toEqual({ kind: 'global' });
    expect(text(harness)).not.toContain('Sobre:');
  });

  it('a deleted note is announced, its conversation dropped, and the global scope restored', async () => {
    localStorage.setItem(
      'synap.chat.user-a',
      JSON.stringify({ v: 2, conversations: { 'note:gone': { messages: [{ question: 'q', answer: answer(), pending: false }], updatedAt: 1 } } }),
    );
    getById.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));

    const harness = await open('/assistant?note=gone');

    expect(warn).toHaveBeenCalledWith('La nota ya no existe', expect.any(String));
    expect(TestBed.inject(Router).url).toBe('/assistant');
    expect(TestBed.inject(AssistantStore).scope()).toEqual({ kind: 'global' });
    TestBed.tick();
    expect(localStorage.getItem('synap.chat.user-a')).toBeNull();
    expect(harness).toBeTruthy();
  });

  it('a network failure does not discard the note conversation', async () => {
    getById.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));

    await open('/assistant?note=n9');

    expect(warn).not.toHaveBeenCalled();
    expect(TestBed.inject(AssistantStore).scope()).toEqual({ kind: 'note', noteId: 'n9' });
  });

  it('a bookmark scope explains it is not available and cannot be asked', async () => {
    getById.mockReturnValue(of(note('b1', 'bookmark', 'Un enlace')));
    const harness = await open('/assistant?note=b1');

    expect(text(harness)).toContain('Todavía no puedes preguntar sobre enlaces');
    expect(buttons(harness)).not.toContain('Resume esta nota');
  });

  it('shows the partial-context hint under a partial answer', async () => {
    ask.mockReturnValue(of(answer({ partialContext: true, scope: { noteId: 'n1' } })));
    const harness = await open('/assistant?note=n1');
    const page = harness.routeDebugElement!.componentInstance as { askSuggestion(q: string): void };

    page.askSuggestion('Resume esta nota');
    await settle(harness);

    expect(text(harness)).toContain('La nota es larga: solo se ha usado el principio.');
  });

  it('"#" picks one of the user\'s tags and keeps the rest of the question', async () => {
    const harness = await open('/assistant');
    const input = harness.routeNativeElement!.querySelector('input')!;

    input.value = 'resume #pyt';
    input.dispatchEvent(new Event('input'));
    await settle(harness);
    expect(harness.routeNativeElement!.querySelector('[role=listbox]')?.textContent).toContain('#python');

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await settle(harness);

    expect(TestBed.inject(Router).url).toBe('/assistant?tag=python');
    expect(input.value).toBe('resume');
    expect(ask).not.toHaveBeenCalled();
  });

  it('"@" searches notes and shows bookmarks as unavailable', async () => {
    vi.useFakeTimers();
    try {
      const harness = await RouterTestingHarness.create();
      await harness.navigateByUrl('/assistant', AssistantPage);
      const input = harness.routeNativeElement!.querySelector('input')!;

      input.value = '@cor';
      input.dispatchEvent(new Event('input'));
      await vi.advanceTimersByTimeAsync(250);
      harness.detectChanges();

      expect(search).toHaveBeenCalledWith({ term: 'cor', page: 1, pageSize: 8 });
      const options = [...harness.routeNativeElement!.querySelectorAll('[role=option]')];
      expect(options.map((o) => o.getAttribute('aria-disabled'))).toEqual(['false', 'true']);
      expect(options[1].textContent).toContain('Los enlaces aún no se pueden preguntar');

      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      await vi.advanceTimersByTimeAsync(50);

      expect(TestBed.inject(Router).url).toBe('/assistant?note=n1');
    } finally {
      vi.useRealTimers();
    }
  });
});
