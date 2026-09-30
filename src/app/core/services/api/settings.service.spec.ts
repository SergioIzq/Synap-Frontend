import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { SettingsService } from './settings.service';

const AI = {
  hasGroqKey: true,
  groqKeyMasked: 'gsk_…a1B2',
  groqKeyUpdatedAt: '2026-09-25T10:00:00Z',
  groqModel: null,
  defaultGroqModel: 'default-model',
};

describe('SettingsService', () => {
  let service: SettingsService;
  let http: HttpTestingController;
  const base = `${environment.apiUrl}/settings`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(SettingsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('get() unwraps the settings', async () => {
    const briefing = { enabled: true, hour: 7, canBeDelivered: true };
    const promise = firstValueFrom(service.get());
    http.expectOne({ method: 'GET', url: base }).flush({ value: { email: 'a@b.c', ai: AI, briefing } });
    expect(await promise).toEqual({ email: 'a@b.c', ai: AI, briefing });
  });

  it('get() reads a response with no briefing block as the briefing being off', async () => {
    const promise = firstValueFrom(service.get());
    http.expectOne({ method: 'GET', url: base }).flush({ value: { email: 'a@b.c', ai: AI } });
    expect((await promise).briefing).toEqual({ enabled: false, hour: null, canBeDelivered: false });
  });

  it('setBriefing() sends the switch and the hour in a PUT', async () => {
    const promise = firstValueFrom(service.setBriefing(true, 7));
    const req = http.expectOne({ method: 'PUT', url: `${base}/briefing` });
    expect(req.request.body).toEqual({ enabled: true, hour: 7 });
    req.flush({ value: { enabled: true, hour: 7, canBeDelivered: true } });
    expect(await promise).toEqual({ enabled: true, hour: 7, canBeDelivered: true });
  });

  it('sendBriefingNow() issues a POST', async () => {
    const promise = firstValueFrom(service.sendBriefingNow());
    http.expectOne({ method: 'POST', url: `${base}/briefing/send` }).flush(null);
    expect(await promise).toBeUndefined();
  });

  it('saveGroqKey() sends the key in the body of a PUT', async () => {
    const promise = firstValueFrom(service.saveGroqKey('gsk_x'));
    const req = http.expectOne({ method: 'PUT', url: `${base}/ai/groq-key` });
    expect(req.request.body).toEqual({ apiKey: 'gsk_x' });
    req.flush({ value: AI });
    expect(await promise).toEqual(AI);
  });

  it('deleteGroqKey() issues a DELETE', async () => {
    const promise = firstValueFrom(service.deleteGroqKey());
    http.expectOne({ method: 'DELETE', url: `${base}/ai/groq-key` }).flush({ value: { ...AI, hasGroqKey: false } });
    expect((await promise).hasGroqKey).toBe(false);
  });

  it('listModels() returns the models and whether they support actions', async () => {
    const models = [
      { id: 'a', supportsActions: true },
      { id: 'b', supportsActions: false },
    ];
    const promise = firstValueFrom(service.listModels());
    http.expectOne({ method: 'GET', url: `${base}/ai/models` }).flush({ value: models });
    expect(await promise).toEqual(models);
  });

  it('setModel(null) resets to the default model', async () => {
    const promise = firstValueFrom(service.setModel(null));
    const req = http.expectOne({ method: 'PUT', url: `${base}/ai/model` });
    expect(req.request.body).toEqual({ model: null });
    req.flush({ value: AI });
    await promise;
  });
});

describe('SettingsService null handling', () => {
  it('restores properties the API omits when null', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const service = TestBed.inject(SettingsService);
    const http = TestBed.inject(HttpTestingController);

    const promise = firstValueFrom(service.get());
    http
      .expectOne(`${environment.apiUrl}/settings`)
      .flush({ value: { email: 'a@b.c', ai: { hasGroqKey: false, defaultGroqModel: 'm' } } });

    const settings = await promise;
    expect(settings.ai.groqModel).toBeNull();
    expect(settings.ai.groqKeyMasked).toBeNull();
    http.verify();
  });
});
