import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { Subject, of, throwError } from 'rxjs';
import { AssistantService } from '../../../core/services/api/assistant.service';
import { AssistantAnswer, AssistantAnswerStatus, ChatMessage } from '../../../core/models';
import { AuthStore } from '../../../core/stores/auth.store';
import { SettingsStore } from '../../settings/store/settings.store';
import { AssistantStore, MAX_SCOPED_CONVERSATIONS, MAX_STORED_MESSAGES } from './assistant.store';

function answer(status: AssistantAnswerStatus, text = 'texto'): AssistantAnswer {
  return { answer: text, sourceNoteIds: [], grounded: status === 'ok', status };
}

const stored = (userId: string) => JSON.parse(localStorage.getItem(`synap.chat.${userId}`) ?? 'null');
/** The stored messages of one scope's conversation (`global` by default). */
const storedFor = (userId: string, key = 'global'): ChatMessage[] => stored(userId)?.conversations?.[key]?.messages ?? [];

describe('AssistantStore', () => {
  let ask: ReturnType<typeof vi.fn>;
  let settingsLoad: ReturnType<typeof vi.fn>;
  let userId: ReturnType<typeof signal<string | null>>;

  function createStore(): AssistantStore {
    const store = TestBed.inject(AssistantStore);
    TestBed.tick();
    return store;
  }

  beforeEach(() => {
    localStorage.clear();
    ask = vi.fn();
    settingsLoad = vi.fn(() => Promise.resolve());
    userId = signal<string | null>('user-a');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: AssistantService, useValue: { ask } },
        { provide: SettingsStore, useValue: { load: settingsLoad } },
        { provide: AuthStore, useValue: { userId } },
      ],
    });
  });

  it.each<AssistantAnswerStatus>(['ok', 'noRelevantNotes', 'keyMissing', 'invalidKey', 'rateLimited', 'unavailable'])(
    'keeps the %s status on the message',
    async (status) => {
      const store = createStore();
      ask.mockReturnValue(of(answer(status)));
      await store.ask('¿pregunta?');
      const [message] = store.messages();
      expect(message.pending).toBe(false);
      expect(message.answer?.status).toBe(status);
    },
  );

  it.each<AssistantAnswerStatus>(['keyMissing', 'invalidKey'])('refreshes settings after %s', async (status) => {
    const store = createStore();
    ask.mockReturnValue(of(answer(status)));
    await store.ask('¿pregunta?');
    expect(settingsLoad).toHaveBeenCalled();
  });

  it('does not refresh settings after a normal answer', async () => {
    const store = createStore();
    ask.mockReturnValue(of(answer('ok')));
    await store.ask('¿pregunta?');
    expect(settingsLoad).not.toHaveBeenCalled();
  });

  it('turns an HTTP failure into a Spanish "unavailable" answer', async () => {
    const store = createStore();
    ask.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    await store.ask('¿pregunta?');
    const [message] = store.messages();
    expect(message.answer?.status).toBe('unavailable');
    expect(message.answer?.answer).toBe('No se pudo contactar con el asistente.');
  });

  it('explains rate limiting (429) in Spanish', async () => {
    const store = createStore();
    ask.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 429 })));
    await store.ask('¿pregunta?');
    expect(store.messages()[0].answer?.answer).toMatch(/demasiadas preguntas/);
  });

  // ---- persistence ----

  it('persists the conversation per user and restores it after a reload', async () => {
    const store = createStore();
    ask.mockReturnValue(of(answer('ok', 'respuesta')));
    await store.ask('¿pregunta?');
    TestBed.tick();

    expect(storedFor('user-a')).toHaveLength(1);

    // "Reload": a fresh store reading the same storage.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: AssistantService, useValue: { ask } },
        { provide: SettingsStore, useValue: { load: settingsLoad } },
        { provide: AuthStore, useValue: { userId } },
      ],
    });
    const reloaded = createStore();
    expect(reloaded.messages().map((m) => m.answer?.answer)).toEqual(['respuesta']);
  });

  it('never stores pending messages', () => {
    const store = createStore();
    ask.mockReturnValue(of()); // never resolves with a value
    void store.ask('en vuelo');
    TestBed.tick();

    expect(store.messages()[0].pending).toBe(true);
    expect(storedFor('user-a')).toEqual([]);
  });

  it(`keeps only the last ${MAX_STORED_MESSAGES} interactions`, async () => {
    const store = createStore();
    ask.mockReturnValue(of(answer('ok')));
    for (let i = 0; i < MAX_STORED_MESSAGES + 5; i++) {
      await store.ask(`q${i}`);
    }
    TestBed.tick();

    const stored = storedFor('user-a');
    expect(stored).toHaveLength(MAX_STORED_MESSAGES);
    expect(stored[0].question).toBe('q5');
  });

  it('switches conversation when the user changes and empties it on sign out', async () => {
    localStorage.setItem(
      'synap.chat.user-b',
      JSON.stringify({ v: 2, conversations: { global: { messages: [{ question: 'de B', answer: answer('ok'), pending: false }], updatedAt: 1 } } }),
    );
    const store = createStore();
    ask.mockReturnValue(of(answer('ok')));
    await store.ask('de A');
    TestBed.tick();

    userId.set('user-b');
    TestBed.tick();
    expect(store.messages().map((m) => m.question)).toEqual(['de B']);

    userId.set(null);
    TestBed.tick();
    expect(store.messages()).toEqual([]);
    // A's conversation was never overwritten by B's.
    expect(storedFor('user-a').map((m) => m.question)).toEqual(['de A']);
  });

  it('clear() starts a new conversation and removes it from storage', async () => {
    const store = createStore();
    ask.mockReturnValue(of(answer('ok')));
    await store.ask('¿pregunta?');
    TestBed.tick();

    store.clear();
    TestBed.tick();

    expect(store.messages()).toEqual([]);
    expect(localStorage.getItem('synap.chat.user-a')).toBeNull();
  });

  // ---- scoped conversations (scoped-assistant) ----

  const note = { kind: 'note', noteId: 'n1', title: 'CORS' } as const;
  const tag = { kind: 'tag', tag: 'docker' } as const;

  it('migrates a stored pre-scopes conversation to the global one', () => {
    localStorage.setItem('synap.chat.user-a', JSON.stringify([{ question: 'antigua', answer: answer('ok'), pending: false }]));
    const store = createStore();

    expect(store.messages().map((m) => m.question)).toEqual(['antigua']);
    TestBed.tick();
    expect(stored('user-a').v).toBe(2);
    expect(storedFor('user-a').map((m) => m.question)).toEqual(['antigua']);
  });

  it('keeps each scope in its own conversation', async () => {
    const store = createStore();
    ask.mockReturnValue(of(answer('ok')));

    store.setScope(note);
    await store.ask('sobre la nota');
    store.setScope({ kind: 'global' });
    await store.ask('global');
    expect(store.messages().map((m) => m.question)).toEqual(['global']);

    store.setScope(note);
    expect(store.messages().map((m) => m.question)).toEqual(['sobre la nota']);
    TestBed.tick();
    expect(storedFor('user-a', 'note:n1').map((m) => m.question)).toEqual(['sobre la nota']);
  });

  it('sends the scope and the last settled turns only for scoped questions', async () => {
    const store = createStore();
    ask.mockImplementation((question: string) => of(answer('ok', `r-${question}`)));

    store.setScope(tag);
    for (const q of ['q1', 'q2', 'q3', 'q4']) await store.ask(q);

    expect(ask).toHaveBeenLastCalledWith('q4', tag, [
      { question: 'q1', answer: 'r-q1' },
      { question: 'q2', answer: 'r-q2' },
      { question: 'q3', answer: 'r-q3' },
    ]);

    store.setScope({ kind: 'global' });
    await store.ask('global');
    expect(ask).toHaveBeenLastCalledWith('global', { kind: 'global' }, []);
  });

  it('delivers a late answer to the scope it was asked in', async () => {
    const store = createStore();
    const late = new Subject<AssistantAnswer>();
    ask.mockReturnValue(late);

    store.setScope(note);
    const asking = store.ask('lenta');
    store.setScope({ kind: 'global' });
    late.next(answer('ok', 'llegó'));
    late.complete();
    await asking;

    expect(store.messages()).toEqual([]);
    store.setScope(note);
    expect(store.messages().map((m) => m.answer?.answer)).toEqual(['llegó']);
  });

  it('clear() only clears the active scope', async () => {
    const store = createStore();
    ask.mockReturnValue(of(answer('ok')));
    await store.ask('global');
    store.setScope(note);
    await store.ask('nota');

    store.clear();
    TestBed.tick();

    expect(store.messages()).toEqual([]);
    expect(storedFor('user-a').map((m) => m.question)).toEqual(['global']);
    expect(stored('user-a').conversations['note:n1']).toBeUndefined();
  });

  it(`keeps at most ${MAX_SCOPED_CONVERSATIONS} scoped conversations, dropping the least recent`, async () => {
    const store = createStore();
    ask.mockReturnValue(of(answer('ok')));
    await store.ask('global');
    const now = vi.spyOn(Date, 'now');
    for (let i = 0; i < MAX_SCOPED_CONVERSATIONS + 2; i++) {
      now.mockReturnValue(1_000 + i);
      store.setScope({ kind: 'tag', tag: `t${i}` });
      await store.ask(`q${i}`);
    }
    now.mockRestore();
    TestBed.tick();

    const keys = Object.keys(stored('user-a').conversations);
    expect(keys).toContain('global');
    expect(keys.filter((k) => k.startsWith('tag:'))).toHaveLength(MAX_SCOPED_CONVERSATIONS);
    expect(keys).not.toContain('tag:t0');
    expect(keys).not.toContain('tag:t1');
  });

  it('forget() discards a scope, e.g. a deleted note', async () => {
    const store = createStore();
    ask.mockReturnValue(of(answer('ok')));
    store.setScope(note);
    await store.ask('nota');

    store.forget(note);
    TestBed.tick();

    expect(store.messages()).toEqual([]);
    expect(stored('user-a')).toBeNull();
  });
});
