import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { AssistantService } from '../../../core/services/api/assistant.service';
import { AssistantAnswer, AssistantAnswerStatus } from '../../../core/models';
import { SettingsStore } from '../../settings/store/settings.store';
import { AssistantStore } from './assistant.store';

function answer(status: AssistantAnswerStatus, text = 'texto'): AssistantAnswer {
  return { answer: text, sourceNoteIds: [], grounded: status === 'ok', status };
}

describe('AssistantStore', () => {
  let ask: ReturnType<typeof vi.fn>;
  let settingsLoad: ReturnType<typeof vi.fn>;
  let store: AssistantStore;

  beforeEach(() => {
    ask = vi.fn();
    settingsLoad = vi.fn(() => Promise.resolve());
    TestBed.configureTestingModule({
      providers: [
        { provide: AssistantService, useValue: { ask } },
        { provide: SettingsStore, useValue: { load: settingsLoad } },
      ],
    });
    store = TestBed.inject(AssistantStore);
  });

  it.each<AssistantAnswerStatus>(['ok', 'noRelevantNotes', 'keyMissing', 'invalidKey', 'rateLimited', 'unavailable'])(
    'keeps the %s status on the message',
    async (status) => {
      ask.mockReturnValue(of(answer(status)));
      await store.ask('¿pregunta?');
      const [message] = store.messages();
      expect(message.pending).toBe(false);
      expect(message.answer?.status).toBe(status);
    },
  );

  it.each<AssistantAnswerStatus>(['keyMissing', 'invalidKey'])('refreshes settings after %s', async (status) => {
    ask.mockReturnValue(of(answer(status)));
    await store.ask('¿pregunta?');
    expect(settingsLoad).toHaveBeenCalled();
  });

  it('does not refresh settings after a normal answer', async () => {
    ask.mockReturnValue(of(answer('ok')));
    await store.ask('¿pregunta?');
    expect(settingsLoad).not.toHaveBeenCalled();
  });

  it('turns an HTTP failure into a Spanish "unavailable" answer', async () => {
    ask.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    await store.ask('¿pregunta?');
    const [message] = store.messages();
    expect(message.answer?.status).toBe('unavailable');
    expect(message.answer?.answer).toBe('No se pudo contactar con el asistente.');
  });

  it('explains rate limiting (429) in Spanish', async () => {
    ask.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 429 })));
    await store.ask('¿pregunta?');
    expect(store.messages()[0].answer?.answer).toMatch(/demasiadas preguntas/);
  });
});
