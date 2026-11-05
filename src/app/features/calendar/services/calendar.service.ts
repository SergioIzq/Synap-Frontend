import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResult } from '../../../core/models/auth.model';
import {
  CalendarDto,
  CalendarEventDto,
  CalendarEventsResponse,
  CalendarListResponse,
  CalendarScope,
  PatchCalendarRequest,
} from './calendar.models';

@Injectable({ providedIn: 'root' })
export class CalendarService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/calendar`;

  listCalendars(): Observable<ApiResult<CalendarListResponse>> {
    return this.http.get<ApiResult<CalendarListResponse>>(`${this.base}/calendars`);
  }

  patchCalendar(id: string, body: PatchCalendarRequest): Observable<void> {
    return this.http.patch<void>(`${this.base}/calendars/${id}`, body);
  }

  listEvents(from: Date, to: Date, scope?: CalendarScope): Observable<ApiResult<CalendarEventsResponse>> {
    const params: Record<string, string> = {
      from: from.toISOString(),
      to: to.toISOString(),
    };
    if (scope && scope !== 'all') params['scope'] = scope;
    return this.http.get<ApiResult<CalendarEventsResponse>>(`${this.base}/events`, { params });
  }

  requestSync(): Observable<void> {
    return this.http.post<void>(`${this.base}/sync`, null);
  }
}
