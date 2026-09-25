import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { SettingsService } from '../../../core/services/api/settings.service';
import { AiSettings, ApiResult, UserSettings } from '../../../core/models';

/**
 * Plain signals, same shape as the other stores (see AuthStore's comment). Root-provided
 * because the assistant page also reads `hasGroqKey` to decide whether to show its warning.
 * Pages call `load()` on entry rather than trusting a cached value: after a logout/login on the
 * same device the cache would belong to the previous user.
 */
@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly settingsService = inject(SettingsService);

  private readonly _settings = signal<UserSettings | null>(null);
  private readonly _models = signal<string[]>([]);
  private readonly _loading = signal(false);
  private readonly _saving = signal(false);
  private readonly _modelsLoading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _modelsError = signal<string | null>(null);

  readonly settings = this._settings.asReadonly();
  readonly models = this._models.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly saving = this._saving.asReadonly();
  readonly modelsLoading = this._modelsLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly modelsError = this._modelsError.asReadonly();

  readonly loaded = computed(() => this._settings() !== null);
  readonly hasGroqKey = computed(() => this._settings()?.ai.hasGroqKey ?? false);

  async load(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    try {
      this._settings.set(await firstValueFrom(this.settingsService.get()));
    } catch (err) {
      this._error.set(extractErrorMessage(err, 'No se pudo cargar tu configuración.'));
    } finally {
      this._loading.set(false);
    }
  }

  /** Throws with a user-facing message on failure, so the page can show it next to the form. */
  async saveGroqKey(apiKey: string): Promise<void> {
    await this.mutateAi(() => this.settingsService.saveGroqKey(apiKey), 'No se pudo guardar la API key.');
    await this.loadModels();
  }

  async deleteGroqKey(): Promise<void> {
    await this.mutateAi(() => this.settingsService.deleteGroqKey(), 'No se pudo eliminar la API key.');
    this._models.set([]);
  }

  async setModel(model: string | null): Promise<void> {
    await this.mutateAi(() => this.settingsService.setModel(model), 'No se pudo cambiar el modelo.');
  }

  async loadModels(): Promise<void> {
    if (!this.hasGroqKey()) {
      this._models.set([]);
      return;
    }

    this._modelsLoading.set(true);
    this._modelsError.set(null);
    try {
      this._models.set(await firstValueFrom(this.settingsService.listModels()));
    } catch (err) {
      this._models.set([]);
      this._modelsError.set(extractErrorMessage(err, 'No se pudieron cargar los modelos disponibles.'));
    } finally {
      this._modelsLoading.set(false);
    }
  }

  private async mutateAi(request: () => Observable<AiSettings>, fallback: string): Promise<void> {
    this._saving.set(true);
    try {
      const ai = await firstValueFrom(request());
      this._settings.update((settings) => (settings ? { ...settings, ai } : settings));
    } catch (err) {
      throw new Error(extractErrorMessage(err, fallback));
    } finally {
      this._saving.set(false);
    }
  }
}

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 429) {
      return 'Demasiadas peticiones seguidas. Espera un momento y vuelve a intentarlo.';
    }
    const apiResult = err.error as ApiResult | undefined;
    return apiResult?.error?.message ?? fallback;
  }
  return fallback;
}
