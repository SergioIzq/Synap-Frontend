import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResult, AssistantAnswer, AssistantScope, AssistantTurn } from '../../models';
import { browserTimezone } from '../../utils/dates';

@Injectable({ providedIn: 'root' })
export class AssistantService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/assistant`;

  /**
   * A note or tag scope adds `scope` (scoped-assistant); the conversation's recent `history` goes
   * with any question that has one, global ones included (assistant-agent-foundations).
   *
   * `timezone` travels with every question so the assistant can turn "el viernes" into a real
   * moment, and so a snooze pressed later in Telegram knows what "09:00 mañana" means
   * (assistant-reminders design.md Context).
   */
  ask(question: string, scope?: AssistantScope, history: AssistantTurn[] = []): Observable<AssistantAnswer> {
    const body: Record<string, unknown> = { question };
    if (scope?.kind === 'note') body['scope'] = { noteId: scope.noteId };
    if (scope?.kind === 'tag') body['scope'] = { tag: scope.tag };
    if (history.length > 0) body['history'] = history;

    const timezone = browserTimezone();
    if (timezone) body['timezone'] = timezone;

    return this.http.post<ApiResult<AssistantAnswer>>(`${this.apiUrl}/ask`, body).pipe(map((res) => res.value));
  }
}
