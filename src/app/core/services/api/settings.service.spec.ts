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
    const promise = firstValueFrom(service.get());
    http.expectOne({ method: 'GET', url: base }).flush({ value: { email: 'a@b.c', ai: AI } });
    expect(await promise).toEqual({ email: 'a@b.c', ai: AI });
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

  it('listModels() returns the model ids', async () => {
    const promise = firstValueFrom(service.listModels());
    http.expectOne({ method: 'GET', url: `${base}/ai/models` }).flush({ value: ['a', 'b'] });
    expect(await promise).toEqual(['a', 'b']);
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
