import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AssistantService } from '../../../core/services/api/assistant.service';
import { ApiResult, ChatMessage, SETTINGS_FIXABLE_STATUSES } from '../../../core/models';
import { SettingsStore } from '../../settings/store/settings.store';

/** Plain signals, not @ngrx/signals - see design.md Decision 10. */
@Injectable({ providedIn: 'root' })
export class AssistantStore {
  private readonly assistantService = inject(AssistantService);
  private readonly settingsStore = inject(SettingsStore);

  private readonly _messages = signal<ChatMessage[]>([]);
  private readonly _error = signal<string | null>(null);

  readonly messages = this._messages.asReadonly();
  readonly error = this._error.asReadonly();

  async ask(question: string): Promise<void> {
    this._error.set(null);
    this._messages.update((messages) => [...messages, { question, answer: null, pending: true }]);

    try {
      const answer = await firstValueFrom(this.assistantService.ask(question));
      this.updateLastMessage({ question, answer, pending: false });

      // The key was removed/revoked since the page loaded - refresh so the page shows its
      // "configure your key" warning instead of letting the user keep asking.
      if (SETTINGS_FIXABLE_STATUSES.includes(answer.status)) {
        void this.settingsStore.load();
      }
    } catch (err) {
      const message = this.extractErrorMessage(err);
      this._error.set(message);
      this.updateLastMessage({
        question,
        answer: { answer: message, sourceNoteIds: [], grounded: false, status: 'unavailable' },
        pending: false,
      });
    }
  }

  private updateLastMessage(message: ChatMessage): void {
    this._messages.update((messages) => [...messages.slice(0, -1), message]);
  }

  private extractErrorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 429) {
        return 'Has hecho demasiadas preguntas seguidas. Espera un minuto y vuelve a intentarlo.';
      }
      const apiResult = err.error as ApiResult | undefined;
      return apiResult?.error?.message ?? 'No se pudo contactar con el asistente.';
    }
    return 'No se pudo contactar con el asistente.';
  }
}
