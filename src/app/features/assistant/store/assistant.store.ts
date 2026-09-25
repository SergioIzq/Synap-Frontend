import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AssistantService } from '../../../core/services/api/assistant.service';
import { ApiResult, ChatMessage, SETTINGS_FIXABLE_STATUSES } from '../../../core/models';
import { AuthStore, USER_CACHE_PREFIX } from '../../../core/stores/auth.store';
import { SettingsStore } from '../../settings/store/settings.store';

/** specs/ai-assistant "Conversation persists on the device" - capped so storage can't grow forever. */
export const MAX_STORED_MESSAGES = 50;

/**
 * Plain signals, not @ngrx/signals - see design.md Decision 10. The conversation is mirrored to
 * localStorage per user (key `synap.chat.<userId>`), reloaded whenever the signed-in user
 * changes, and wiped by AuthStore.logout().
 */
@Injectable({ providedIn: 'root' })
export class AssistantStore {
  private readonly assistantService = inject(AssistantService);
  private readonly settingsStore = inject(SettingsStore);
  private readonly authStore = inject(AuthStore);

  private readonly _messages = signal<ChatMessage[]>([]);
  private readonly _error = signal<string | null>(null);

  readonly messages = this._messages.asReadonly();
  readonly error = this._error.asReadonly();

  /** Whose conversation `_messages` currently holds - writes are only allowed for that user. */
  private loadedFor: string | null = null;

  constructor() {
    // Swap conversations when the user changes (login, logout, another account).
    effect(() => {
      const userId = this.authStore.userId();
      untracked(() => {
        this.loadedFor = userId;
        this._messages.set(userId ? readConversation(userId) : []);
      });
    });

    // Never write before the load above has run for this user, or the initial empty list
    // would overwrite the stored conversation.
    effect(() => {
      const messages = this._messages();
      const userId = untracked(() => this.authStore.userId());
      if (userId && userId === this.loadedFor) writeConversation(userId, messages);
    });
  }

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

  /** "Nueva conversación". */
  clear(): void {
    this._error.set(null);
    this._messages.set([]);
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

function storageKey(userId: string): string {
  return `${USER_CACHE_PREFIX}${userId}`;
}

function readConversation(userId: string): ChatMessage[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(userId)) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((m) => m && !m.pending && m.answer) : [];
  } catch {
    return [];
  }
}

function writeConversation(userId: string, messages: ChatMessage[]): void {
  try {
    // In-flight questions are never stored: after a reload they'd spin forever.
    const settled = messages.filter((m) => !m.pending).slice(-MAX_STORED_MESSAGES);
    if (settled.length === 0) {
      localStorage.removeItem(storageKey(userId));
    } else {
      localStorage.setItem(storageKey(userId), JSON.stringify(settled));
    }
  } catch {
    // Storage full or unavailable - the conversation just won't survive a reload.
  }
}
