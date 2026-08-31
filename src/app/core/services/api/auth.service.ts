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

  generateApiToken(): Observable<string> {
    return this.http.post<ApiResult<string>>(`${this.apiUrl}/api-token`, {}).pipe(map((res) => res.value));
  }

  getApiTokenStatus(): Observable<ApiTokenStatus> {
    return this.http.get<ApiResult<ApiTokenStatus>>(`${this.apiUrl}/api-token`).pipe(map((res) => res.value));
  }
}
