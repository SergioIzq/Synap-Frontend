import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResult, AssistantAnswer } from '../../models';

@Injectable({ providedIn: 'root' })
export class AssistantService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/assistant`;

  ask(question: string): Observable<AssistantAnswer> {
    return this.http.post<ApiResult<AssistantAnswer>>(`${this.apiUrl}/ask`, { question }).pipe(map((res) => res.value));
  }
}
