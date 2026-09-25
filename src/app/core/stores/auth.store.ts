import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../services/api/auth.service';
import { ApiResult, LoginRequest, RegisterRequest } from '../models';

const TOKEN_STORAGE_KEY = 'synap_token';

/** Per-user data cached on the device (e.g. the assistant conversation) - wiped on logout. */
export const USER_CACHE_PREFIX = 'synap.chat.';

/**
 * Plain-signals store, not @ngrx/signals' signalStore: that package has no release supporting
 * Angular 21 yet (its latest jumps straight from a ^20.0.0 to a ^22.0.0 peer dependency).
 * Same shape Kash's colocated per-feature stores use (state signals + computed + methods) -
 * swap to signalStore once a compatible release exists, see design.md.
 */
@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly authService = inject(AuthService);

  private readonly _token = signal<string | null>(localStorage.getItem(TOKEN_STORAGE_KEY));
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly token = this._token.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly isAuthenticated = computed(() => this._token() !== null);
  /** The JWT's `sub` - only used to key per-user device caches, never trusted for authorization. */
  readonly userId = computed(() => subjectOf(this._token()));

  async register(request: RegisterRequest): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    try {
      await firstValueFrom(this.authService.register(request));
    } catch (err) {
      this._error.set(this.extractErrorMessage(err, 'No se pudo crear la cuenta.'));
      throw err;
    } finally {
      this._loading.set(false);
    }
  }

  async login(request: LoginRequest): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    try {
      const response = await firstValueFrom(this.authService.login(request));
      this.setToken(response.token);
    } catch (err) {
      this._error.set(this.extractErrorMessage(err, 'Correo o contraseña incorrectos.'));
      throw err;
    } finally {
      this._loading.set(false);
    }
  }

  /**
   * Replaces the session token without a login - after a password change the old token is
   * dead (security stamp rotated) and the API returns a fresh one for this session.
   */
  adoptSession(token: string): void {
    this.setToken(token);
  }

  logout(): void {
    this.setToken(null);
    clearUserCaches();
  }

  private setToken(token: string | null): void {
    this._token.set(token);
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  }

  private extractErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof HttpErrorResponse) {
      const apiResult = err.error as ApiResult | undefined;
      return apiResult?.error?.message ?? fallback;
    }
    return fallback;
  }
}

function subjectOf(token: string | null): string | null {
  if (!token) return null;
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const sub = JSON.parse(atob(payload)).sub;
    return typeof sub === 'string' ? sub : null;
  } catch {
    return null;
  }
}

/** specs/ai-assistant "Conversation cleared on sign out" - the next user on this device sees nothing. */
function clearUserCaches(): void {
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith(USER_CACHE_PREFIX))
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    // Storage unavailable - nothing was cached either.
  }
}
