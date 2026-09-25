import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResult, AuthResponse } from '../../models';

/** The signed-in user's own account - /api/users/me (backend-hardening). */
@Injectable({ providedIn: 'root' })
export class AccountService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/users/me`;

  /** Returns a fresh session token: the change ends every existing session, this one included. */
  changePassword(currentPassword: string, newPassword: string): Observable<AuthResponse> {
    return this.http
      .put<ApiResult<AuthResponse>>(`${this.apiUrl}/password`, { currentPassword, newPassword })
      .pipe(map((res) => res.value));
  }

  /** Irreversible: removes the account and all its data. */
  deleteAccount(password: string): Observable<void> {
    return this.http.delete<ApiResult>(this.apiUrl, { body: { password } }).pipe(map(() => undefined));
  }
}
