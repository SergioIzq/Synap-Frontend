import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  ApiResult,
  Reminder,
  ReminderInput,
  ReminderList,
  TelegramLinkInstructions,
  TelegramStatus,
} from '../../models';
import { browserTimezone } from '../../utils/dates';

/** The user's reminders - /api/reminders (specs/reminders). */
@Injectable({ providedIn: 'root' })
export class ReminderService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/reminders`;
  private readonly telegramUrl = `${environment.apiUrl}/settings/telegram`;

  list(): Observable<ReminderList> {
    return this.http.get<ApiResult<ReminderList>>(this.apiUrl).pipe(map((res) => res.value));
  }

  forNote(noteId: string): Observable<Reminder[]> {
    return this.http
      .get<ApiResult<Reminder[]>>(`${this.apiUrl}/note/${noteId}`)
      .pipe(map((res) => res.value));
  }

  create(input: ReminderInput): Observable<Reminder> {
    return this.http
      .post<ApiResult<Reminder>>(this.apiUrl, { ...input, timezone: browserTimezone() })
      .pipe(map((res) => res.value));
  }

  update(id: string, input: ReminderInput): Observable<void> {
    return this.http
      .put<ApiResult>(`${this.apiUrl}/${id}`, { ...input, timezone: browserTimezone() })
      .pipe(map(() => undefined));
  }

  cancel(id: string): Observable<void> {
    return this.http.delete<ApiResult>(`${this.apiUrl}/${id}`).pipe(map(() => undefined));
  }

  telegramStatus(): Observable<TelegramStatus> {
    return this.http.get<ApiResult<TelegramStatus>>(this.telegramUrl).pipe(map((res) => res.value));
  }

  /** Issues the single-use code the user forwards to the bot; it is never readable again. */
  startTelegramLink(): Observable<TelegramLinkInstructions> {
    return this.http
      .post<ApiResult<TelegramLinkInstructions>>(`${this.telegramUrl}/link`, {})
      .pipe(map((res) => res.value));
  }

  disconnectTelegram(): Observable<void> {
    return this.http.delete<ApiResult>(this.telegramUrl).pipe(map(() => undefined));
  }
}
