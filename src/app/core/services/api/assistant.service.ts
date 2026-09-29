import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResult, AssistantAnswer, AssistantScope, AssistantTurn } from '../../models';

@Injectable({ providedIn: 'root' })
export class AssistantService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/assistant`;

  /**
   * A note or tag scope adds `scope` (scoped-assistant); the conversation's recent `history` goes
   * with any question that has one, global ones included (assistant-agent-foundations).
   */
  ask(question: string, scope?: AssistantScope, history: AssistantTurn[] = []): Observable<AssistantAnswer> {
    const body: Record<string, unknown> = { question };
    if (scope?.kind === 'note') body['scope'] = { noteId: scope.noteId };
    if (scope?.kind === 'tag') body['scope'] = { tag: scope.tag };
    if (history.length > 0) body['history'] = history;

    return this.http.post<ApiResult<AssistantAnswer>>(`${this.apiUrl}/ask`, body).pipe(map((res) => res.value));
  }
}
