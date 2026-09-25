import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { SettingsService } from '../../../core/services/api/settings.service';
import { AiSettings } from '../../../core/models';
import { SettingsStore } from './settings.store';

const NO_KEY: AiSettings = {
  hasGroqKey: false,
  groqKeyMasked: null,
  groqKeyUpdatedAt: null,
  groqModel: null,
  defaultGroqModel: 'default-model',
};
const WITH_KEY: AiSettings = { ...NO_KEY, hasGroqKey: true, groqKeyMasked: 'gsk_…a1B2' };

function apiError(status: number, message?: string) {
  return new HttpErrorResponse({ status, error: message ? { error: { message } } : null });
}

describe('SettingsStore', () => {
  let service: Record<keyof SettingsService, ReturnType<typeof vi.fn>>;
  let store: SettingsStore;

  beforeEach(() => {
    service = {
      get: vi.fn(() => of({ email: 'a@b.c', ai: NO_KEY })),
      saveGroqKey: vi.fn(() => of(WITH_KEY)),
      deleteGroqKey: vi.fn(() => of(NO_KEY)),
      listModels: vi.fn(() => of(['model-a', 'model-b'])),
      setModel: vi.fn((model: string | null) => of({ ...WITH_KEY, groqModel: model })),
    };
    TestBed.configureTestingModule({ providers: [{ provide: SettingsService, useValue: service }] });
    store = TestBed.inject(SettingsStore);
  });

  it('load() exposes settings and hasGroqKey', async () => {
    expect(store.loaded()).toBe(false);
    await store.load();
    expect(store.loaded()).toBe(true);
    expect(store.hasGroqKey()).toBe(false);
    expect(store.settings()?.email).toBe('a@b.c');
  });

  it('load() failure sets a Spanish error', async () => {
    service.get.mockReturnValue(throwError(() => apiError(500)));
    await store.load();
    expect(store.error()).toBe('No se pudo cargar tu configuración.');
  });

  it('saveGroqKey() updates hasGroqKey and loads the models', async () => {
    await store.load();
    await store.saveGroqKey('gsk_valid');
    expect(service.saveGroqKey).toHaveBeenCalledWith('gsk_valid');
    expect(store.hasGroqKey()).toBe(true);
    expect(store.models()).toEqual(['model-a', 'model-b']);
    expect(store.saving()).toBe(false);
  });

  it('saveGroqKey() rejects with the backend message and keeps the previous state', async () => {
    await store.load();
    service.saveGroqKey.mockReturnValue(throwError(() => apiError(400, 'La API key de Groq no es válida.')));
    await expect(store.saveGroqKey('bad')).rejects.toThrow('La API key de Groq no es válida.');
    expect(store.hasGroqKey()).toBe(false);
  });

  it('deleteGroqKey() clears the key and the models', async () => {
    service.get.mockReturnValue(of({ email: 'a@b.c', ai: WITH_KEY }));
    await store.load();
    await store.loadModels();
    await store.deleteGroqKey();
    expect(store.hasGroqKey()).toBe(false);
    expect(store.models()).toEqual([]);
  });

  it('loadModels() does not call the API without a key', async () => {
    await store.load();
    await store.loadModels();
    expect(service.listModels).not.toHaveBeenCalled();
  });

  it('setModel() stores the chosen model', async () => {
    service.get.mockReturnValue(of({ email: 'a@b.c', ai: WITH_KEY }));
    await store.load();
    await store.setModel('model-b');
    expect(store.settings()?.ai.groqModel).toBe('model-b');
  });

  it('rate limiting gets its own message', async () => {
    await store.load();
    service.saveGroqKey.mockReturnValue(throwError(() => apiError(429)));
    await expect(store.saveGroqKey('k')).rejects.toThrow(/Demasiadas peticiones/);
  });
});
