import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResult, ApiTokenStatus, AuthResponse, LoginRequest, RegisterRequest } from '../../models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/auth`;

  register(request: RegisterRequest): Observable<void> {
    return this.http.post<ApiResult>(`${this.apiUrl}/register`, request).pipe(map(() => undefined));
  }

  login(request: LoginRequest): Observable<AuthResponse> {
    return this.http.post<ApiResult<AuthResponse>>(`${this.apiUrl}/login`, request).pipe(map((res) => res.value));
  }

  /** Always succeeds the same way, whether or not the email has an account. */
  forgotPassword(email: string): Observable<void> {
    return this.http.post<ApiResult>(`${this.apiUrl}/forgot-password`, { email }).pipe(map(() => undefined));
  }

  resetPassword(token: string, newPassword: string): Observable<void> {
    return this.http
      .post<ApiResult>(`${this.apiUrl}/reset-password`, { token, newPassword })
      .pipe(map(() => undefined));
  }

  generateApiToken(): Observable<string> {
    return this.http.post<ApiResult<string>>(`${this.apiUrl}/api-token`, {}).pipe(map((res) => res.value));
  }

  getApiTokenStatus(): Observable<ApiTokenStatus> {
    return this.http.get<ApiResult<ApiTokenStatus>>(`${this.apiUrl}/api-token`).pipe(map((res) => res.value));
  }
}
