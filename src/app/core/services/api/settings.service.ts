import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  AiSettings,
  ApiResult,
  BriefingSettings,
  CalendarConnection,
  GoogleCalendarAuthorization,
  LlmModel,
  UserSettings,
} from '../../models';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/settings`;
  private readonly calendarUrl = `${environment.apiUrl}/settings/calendar`;

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

  // ---- The calendar (specs/calendar-integration) ----

  calendar(): Observable<CalendarConnection> {
    return this.http.get<ApiResult<CalendarConnection>>(this.calendarUrl).pipe(map((res) => normalizeCalendar(res.value)));
  }

  /**
   * Connects a CalDAV calendar. The server reads it before storing anything, so a rejection here
   * means nothing was saved and any previous connection is untouched.
   */
  connectCalDavCalendar(serverUrl: string, username: string, password: string): Observable<CalendarConnection> {
    return this.http
      .post<ApiResult<CalendarConnection>>(`${this.calendarUrl}/caldav`, { serverUrl, username, password })
      .pipe(map((res) => normalizeCalendar(res.value)));
  }

  /** Step one of the Google way: where to send the user, and the state they must come back with. */
  beginGoogleCalendarAuthorization(): Observable<GoogleCalendarAuthorization> {
    return this.http
      .post<ApiResult<GoogleCalendarAuthorization>>(`${this.calendarUrl}/google/authorize`, {})
      .pipe(map((res) => res.value));
  }

  /** Step two: the code Google sent the user back with, and the state they left with. */
  connectGoogleCalendar(code: string, state: string): Observable<CalendarConnection> {
    return this.http
      .post<ApiResult<CalendarConnection>>(`${this.calendarUrl}/google`, { code, state })
      .pipe(map((res) => normalizeCalendar(res.value)));
  }

  disconnectCalendar(): Observable<CalendarConnection> {
    return this.http.delete<ApiResult<CalendarConnection>>(this.calendarUrl).pipe(map((res) => normalizeCalendar(res.value)));
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
function normalizeCalendar(calendar: CalendarConnection): CalendarConnection {
  return {
    connected: calendar.connected ?? false,
    kind: calendar.kind ?? null,
    connectedAt: calendar.connectedAt ?? null,
    googleAvailable: calendar.googleAvailable ?? false,
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
