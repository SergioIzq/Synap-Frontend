import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AiSettings, ApiResult, UserSettings } from '../../models';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/settings`;

  get(): Observable<UserSettings> {
    return this.http
      .get<ApiResult<UserSettings>>(this.apiUrl)
      .pipe(map((res) => ({ ...res.value, ai: normalizeAi(res.value.ai) })));
  }

  saveGroqKey(apiKey: string): Observable<AiSettings> {
    return this.http.put<ApiResult<AiSettings>>(`${this.apiUrl}/ai/groq-key`, { apiKey }).pipe(map((res) => normalizeAi(res.value)));
  }

  deleteGroqKey(): Observable<AiSettings> {
    return this.http.delete<ApiResult<AiSettings>>(`${this.apiUrl}/ai/groq-key`).pipe(map((res) => normalizeAi(res.value)));
  }

  listModels(): Observable<string[]> {
    return this.http.get<ApiResult<string[]>>(`${this.apiUrl}/ai/models`).pipe(map((res) => res.value));
  }

  /** Null resets to the server's default model. */
  setModel(model: string | null): Observable<AiSettings> {
    return this.http.put<ApiResult<AiSettings>>(`${this.apiUrl}/ai/model`, { model }).pipe(map((res) => normalizeAi(res.value)));
  }
}

/** The API omits null properties entirely - restore them so `null` consistently means "not set". */
function normalizeAi(ai: AiSettings): AiSettings {
  return {
    ...ai,
    groqKeyMasked: ai.groqKeyMasked ?? null,
    groqKeyUpdatedAt: ai.groqKeyUpdatedAt ?? null,
    groqModel: ai.groqModel ?? null,
  };
}
