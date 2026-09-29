import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AssistantService } from '../../../core/services/api/assistant.service';
import {
  AssistantScope,
  AssistantTurn,
  ChatMessage,
  GLOBAL_SCOPE,
  SETTINGS_FIXABLE_STATUSES,
  scopeKey,
} from '../../../core/models';
import { AuthStore, USER_CACHE_PREFIX } from '../../../core/stores/auth.store';
import { SettingsStore } from '../../settings/store/settings.store';
import { apiErrorMessage } from '../../../core/utils/http-errors';

/** specs/ai-assistant "Conversation persists on the device" - capped so storage can't grow forever. */
export const MAX_STORED_MESSAGES = 50;

/** How many note/tag conversations are kept; the least recently used go first. */
export const MAX_SCOPED_CONVERSATIONS = 20;

/** Earlier turns sent with every question, global or scoped: the conversation's short memory. */
export const HISTORY_TURNS = 3;

export interface Conversation {
  messages: ChatMessage[];
  updatedAt: number;
}

type Conversations = Record<string, Conversation>;

/**
 * Plain signals, not @ngrx/signals - see design.md Decision 10. One conversation per scope
 * (global, each note, each tag), mirrored to localStorage per user (key `synap.chat.<userId>`,
 * `{ v: 2, conversations }`), reloaded whenever the signed-in user changes, and wiped by
 * AuthStore.logout().
 */
@Injectable({ providedIn: 'root' })
export class AssistantStore {
  private readonly assistantService = inject(AssistantService);
  private readonly settingsStore = inject(SettingsStore);
  private readonly authStore = inject(AuthStore);

  private readonly _conversations = signal<Conversations>({});
  private readonly _scope = signal<AssistantScope>(GLOBAL_SCOPE);
  private readonly _error = signal<string | null>(null);

  /** What new questions are about. */
  readonly scope = this._scope.asReadonly();
  /** The active scope's conversation. */
  readonly messages = computed(() => this._conversations()[scopeKey(this._scope())]?.messages ?? []);
  readonly error = this._error.asReadonly();

  /** Whose conversations `_conversations` currently holds - writes are only allowed for that user. */
  private loadedFor: string | null = null;

  constructor() {
    // Swap conversations when the user changes (login, logout, another account).
    effect(() => {
      const userId = this.authStore.userId();
      untracked(() => {
        this.loadedFor = userId;
        this._conversations.set(userId ? readConversations(userId) : {});
      });
    });

    // Never write before the load above has run for this user, or the initial empty state
    // would overwrite the stored conversations.
    effect(() => {
      const conversations = this._conversations();
      const userId = untracked(() => this.authStore.userId());
      if (userId && userId === this.loadedFor) writeConversations(userId, conversations);
    });
  }

  /** Switches the conversation shown and what new questions are about. */
  setScope(scope: AssistantScope): void {
    this._error.set(null);
    this._scope.set(scope);
  }

  async ask(question: string): Promise<void> {
    const scope = this._scope();
    // Captured now: the user may switch scope while the answer is on its way.
    const key = scopeKey(scope);
    const history = recentTurns(this._conversations()[key]?.messages ?? []);
    const pending: ChatMessage = { question, answer: null, pending: true };

    this._error.set(null);
    this.updateConversation(key, (messages) => [...messages, pending]);

    try {
      const answer = await firstValueFrom(this.assistantService.ask(question, scope, history));
      this.settle(key, pending, { question, answer, pending: false });

      // The key was removed/revoked since the page loaded - refresh so the page shows its
      // "configure your key" warning instead of letting the user keep asking.
      if (SETTINGS_FIXABLE_STATUSES.includes(answer.status)) {
        void this.settingsStore.load();
      }
    } catch (err) {
      const message = this.extractErrorMessage(err);
      this._error.set(message);
      this.settle(key, pending, {
        question,
        answer: { answer: message, sourceNoteIds: [], grounded: false, status: 'unavailable' },
        pending: false,
      });
    }
  }

  /** "Nueva conversación": clears only the active scope's conversation. */
  clear(): void {
    this._error.set(null);
    this.forget(this._scope());
  }

  /** Drops a scope's conversation, e.g. when its note no longer exists. */
  forget(scope: AssistantScope): void {
    const key = scopeKey(scope);
    this._conversations.update(({ [key]: _, ...rest }) => rest);
  }

  private updateConversation(key: string, change: (messages: ChatMessage[]) => ChatMessage[]): void {
    this._conversations.update((all) => ({
      ...all,
      [key]: { messages: change(all[key]?.messages ?? []), updatedAt: Date.now() },
    }));
  }

  /** Replaces the in-flight message - unless its conversation was cleared meanwhile. */
  private settle(key: string, pending: ChatMessage, settled: ChatMessage): void {
    if (!this._conversations()[key]?.messages.includes(pending)) return;
    this.updateConversation(key, (messages) => messages.map((m) => (m === pending ? settled : m)));
  }

  private extractErrorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 429) {
        return 'Has hecho demasiadas preguntas seguidas. Espera un minuto y vuelve a intentarlo.';
      }
    }
    return apiErrorMessage(err, 'No se pudo contactar con el asistente.');
  }
}

/** The last settled question/answer pairs of a conversation, oldest first. */
function recentTurns(messages: ChatMessage[]): AssistantTurn[] {
  return messages
    .filter((m) => !m.pending && m.answer)
    .slice(-HISTORY_TURNS)
    .map((m) => ({ question: m.question, answer: m.answer!.answer }));
}

function storageKey(userId: string): string {
  return `${USER_CACHE_PREFIX}${userId}`;
}

function settledMessages(messages: unknown): ChatMessage[] {
  return Array.isArray(messages) ? messages.filter((m) => m && !m.pending && m.answer) : [];
}

function readConversations(userId: string): Conversations {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(userId)) ?? 'null');
    // Before scoped-assistant a single array was stored: it becomes the global conversation.
    if (Array.isArray(parsed)) {
      const messages = settledMessages(parsed);
      return messages.length ? { global: { messages, updatedAt: 0 } } : {};
    }
    if (parsed?.v !== 2 || typeof parsed.conversations !== 'object' || parsed.conversations === null) return {};

    const conversations: Conversations = {};
    for (const [key, value] of Object.entries(parsed.conversations as Record<string, Partial<Conversation>>)) {
      const messages = settledMessages(value?.messages);
      if (messages.length) conversations[key] = { messages, updatedAt: Number(value?.updatedAt) || 0 };
    }
    return conversations;
  } catch {
    return {};
  }
}

function writeConversations(userId: string, conversations: Conversations): void {
  try {
    // In-flight questions are never stored: after a reload they'd spin forever.
    const kept = Object.entries(conversations)
      .map(([key, c]) => [key, { messages: c.messages.filter((m) => !m.pending).slice(-MAX_STORED_MESSAGES), updatedAt: c.updatedAt }] as const)
      .filter(([, c]) => c.messages.length > 0);

    const global = kept.filter(([key]) => key === 'global');
    const scoped = kept
      .filter(([key]) => key !== 'global')
      .sort(([, a], [, b]) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_SCOPED_CONVERSATIONS);

    if (global.length + scoped.length === 0) {
      localStorage.removeItem(storageKey(userId));
    } else {
      localStorage.setItem(storageKey(userId), JSON.stringify({ v: 2, conversations: Object.fromEntries([...global, ...scoped]) }));
    }
  } catch {
    // Storage full or unavailable - the conversations just won't survive a reload.
  }
}
