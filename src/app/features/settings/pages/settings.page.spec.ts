import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { ConfirmationService } from 'primeng/api';
import { AuthService } from '../../../core/services/api/auth.service';
import { AccountService } from '../../../core/services/api/account.service';
import { MemoryService } from '../../../core/services/api/memory.service';
import { SettingsService } from '../../../core/services/api/settings.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthStore } from '../../../core/stores/auth.store';
import { AiSettings, LlmModel } from '../../../core/models';
import { SettingsPage } from './settings.page';

const NO_KEY: AiSettings = {
  hasGroqKey: false,
  groqKeyMasked: null,
  groqKeyUpdatedAt: null,
  groqModel: null,
  defaultGroqModel: 'plain-default',
};
const WITH_KEY: AiSettings = { ...NO_KEY, hasGroqKey: true, groqKeyMasked: 'gsk_…a1B2' };
const MODELS: LlmModel[] = [
  { id: 'plain-default', supportsActions: false },
  { id: 'capable-model', supportsActions: true },
];

const HINT = 'solo responde preguntas';

describe('SettingsPage', () => {
  let settingsService: { get: ReturnType<typeof vi.fn>; listModels: ReturnType<typeof vi.fn> };

  async function render(ai: AiSettings) {
    settingsService.get.mockReturnValue(of({ email: 'a@b.c', ai }));
    const fixture = TestBed.createComponent(SettingsPage);
    fixture.detectChanges();
    for (let i = 0; i < 3; i++) {
      await fixture.whenStable();
      fixture.detectChanges();
    }
    return fixture;
  }

  const text = (fixture: Awaited<ReturnType<typeof render>>) => (fixture.nativeElement as HTMLElement).textContent ?? '';

  beforeEach(() => {
    settingsService = { get: vi.fn(), listModels: vi.fn(() => of(MODELS)) };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: SettingsService, useValue: settingsService },
        { provide: AuthService, useValue: { getApiTokenStatus: vi.fn(() => of({ hasToken: false, createdAt: null })) } },
        { provide: AccountService, useValue: {} },
        { provide: AuthStore, useValue: {} },
        { provide: MemoryService, useValue: { list: vi.fn(() => of({ entries: [], maxEntries: 25, maxTextLength: 200 })) } },
        { provide: ConfirmationService, useValue: { confirm: vi.fn() } },
        { provide: NotificationService, useValue: { success: vi.fn(), error: vi.fn(), warn: vi.fn() } },
      ],
    });
  });

  it('shows the Memoria section even without a Groq key', async () => {
    const fixture = await render(NO_KEY);

    expect((fixture.nativeElement as HTMLElement).querySelector('#memoria')).not.toBeNull();
    expect(text(fixture)).toContain('0/25 recuerdos');
  });

  it('tags the models that support actions in the selector', async () => {
    // PrimeNG's overlay asks for matchMedia, which jsdom lacks.
    window.matchMedia ??= ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} })) as never;
    const fixture = await render({ ...WITH_KEY, groqModel: 'capable-model' });

    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('p-select')!.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const options = [...document.querySelectorAll('.model-option')].map((o) => ({
      label: o.querySelector('span')?.textContent?.trim(),
      actions: o.textContent?.includes('Acciones'),
    }));
    expect(options).toEqual([
      { label: 'Por defecto (plain-default)', actions: false },
      { label: 'plain-default', actions: false },
      { label: 'capable-model', actions: true },
    ]);
  });

  it('explains that a model without actions will only answer questions', async () => {
    const fixture = await render({ ...WITH_KEY, groqModel: null });

    expect(text(fixture)).toContain(HINT);
  });

  it('says nothing when the selected model supports actions', async () => {
    const fixture = await render({ ...WITH_KEY, groqModel: 'capable-model' });

    expect(text(fixture)).not.toContain(HINT);
  });

  it('says nothing when action support is unknown', async () => {
    const fixture = await render({ ...WITH_KEY, groqModel: 'retired-model' });

    expect(text(fixture)).toContain('ya no está disponible');
    expect(text(fixture)).not.toContain(HINT);
  });
});
