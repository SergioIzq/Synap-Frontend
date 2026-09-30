import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AiSettings, ApiResult, BriefingSettings, LlmModel, UserSettings } from '../../models';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/settings`;

  get(): Observable<UserSettings> {
    return this.http
      .get<ApiResult<UserSettings>>(this.apiUrl)
      .pipe(map((res) => ({ ...res.value, ai: normalizeAi(res.value.ai), briefing: normalizeBriefing(res.value.briefing) })));
  }

  saveGroqKey(apiKey: string): Observable<AiSettings> {
    return this.http.put<ApiResult<AiSettings>>(`${this.apiUrl}/ai/groq-key`, { apiKey }).pipe(map((res) => normalizeAi(res.value)));
  }

  deleteGroqKey(): Observable<AiSettings> {
    return this.http.delete<ApiResult<AiSettings>>(`${this.apiUrl}/ai/groq-key`).pipe(map((res) => normalizeAi(res.value)));
  }

  listModels(): Observable<LlmModel[]> {
    return this.http.get<ApiResult<LlmModel[]>>(`${this.apiUrl}/ai/models`).pipe(map((res) => res.value));
  }

  /** Null resets to the server's default model. */
  setModel(model: string | null): Observable<AiSettings> {
    return this.http.put<ApiResult<AiSettings>>(`${this.apiUrl}/ai/model`, { model }).pipe(map((res) => normalizeAi(res.value)));
  }

  setBriefing(enabled: boolean, hour: number | null): Observable<BriefingSettings> {
    return this.http
      .put<ApiResult<BriefingSettings>>(`${this.apiUrl}/briefing`, { enabled, hour })
      .pipe(map((res) => normalizeBriefing(res.value)));
  }

  /** Sends the briefing now; it does not consume the day's automatic one (specs/briefing). */
  sendBriefingNow(): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/briefing/send`, {}).pipe(map(() => undefined));
  }
}

/** A client ahead of its API gets no briefing block at all; that reads as "off", not a crash. */
function normalizeBriefing(briefing: BriefingSettings | undefined): BriefingSettings {
  return {
    enabled: briefing?.enabled ?? false,
    hour: briefing?.hour ?? null,
    canBeDelivered: briefing?.canBeDelivered ?? false,
  };
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
