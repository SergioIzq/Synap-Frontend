import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AssistantService } from './assistant.service';
import { browserTimezone } from '../../utils/dates';

describe('AssistantService', () => {
  let service: AssistantService;
  let http: HttpTestingController;
  const url = `${environment.apiUrl}/assistant/ask`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AssistantService);
    http = TestBed.inject(HttpTestingController);
  });

  async function bodyOf(request: Promise<unknown>) {
    const req = http.expectOne(url);
    const body = req.request.body;
    req.flush({ value: { answer: 'a', sourceNoteIds: [], grounded: true, status: 'ok' } });
    await request;
    return body;
  }

  it('sends the question and the browser timezone for a new global conversation', async () => {
    const body = await bodyOf(firstValueFrom(service.ask('¿q?', { kind: 'global' })));
    // The timezone rides along with every question (assistant-reminders).
    expect(body).toEqual({ question: '¿q?', timezone: browserTimezone() });
  });

  it('sends the history of a global conversation too (assistant-agent-foundations)', async () => {
    const history = [{ question: 'x', answer: 'y' }];
    const body = await bodyOf(firstValueFrom(service.ask('¿q?', { kind: 'global' }, history)));
    expect(body).toEqual({ question: '¿q?', history, timezone: browserTimezone() });
  });

  it('sends a note scope with the recent history', async () => {
    const history = [{ question: 'resúmelo', answer: '1. uno' }];
    const body = await bodyOf(firstValueFrom(service.ask('¿y el 1?', { kind: 'note', noteId: 'n1', title: 'CORS' }, history)));
    expect(body).toEqual({ question: '¿y el 1?', scope: { noteId: 'n1' }, history, timezone: browserTimezone() });
  });

  it('sends a tag scope and leaves out an empty history', async () => {
    const body = await bodyOf(firstValueFrom(service.ask('¿qué sé?', { kind: 'tag', tag: 'docker' })));
    expect(body).toEqual({ question: '¿qué sé?', scope: { tag: 'docker' }, timezone: browserTimezone() });
  });
});
