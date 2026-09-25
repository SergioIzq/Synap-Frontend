import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { AssistantService } from '../../../core/services/api/assistant.service';
import { AssistantAnswer, AssistantAnswerStatus, ChatMessage } from '../../../core/models';
import { AuthStore } from '../../../core/stores/auth.store';
import { SettingsStore } from '../../settings/store/settings.store';
import { AssistantStore, MAX_STORED_MESSAGES } from './assistant.store';

function answer(status: AssistantAnswerStatus, text = 'texto'): AssistantAnswer {
  return { answer: text, sourceNoteIds: [], grounded: status === 'ok', status };
}

const storedFor = (userId: string): ChatMessage[] => JSON.parse(localStorage.getItem(`synap.chat.${userId}`) ?? '[]');

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
    localStorage.setItem('synap.chat.user-b', JSON.stringify([{ question: 'de B', answer: answer('ok'), pending: false }]));
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
});
