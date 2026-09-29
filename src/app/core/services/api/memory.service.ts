import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResult, MemoryEntry, MemoryList } from '../../models';

/** The user's assistant memory - /api/memory (assistant-agent-foundations design.md Decision 8). */
@Injectable({ providedIn: 'root' })
export class MemoryService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/memory`;

  list(): Observable<MemoryList> {
    return this.http.get<ApiResult<MemoryList>>(this.apiUrl).pipe(map((res) => res.value));
  }

  add(text: string): Observable<MemoryEntry> {
    return this.http.post<ApiResult<MemoryEntry>>(this.apiUrl, { text }).pipe(map((res) => res.value));
  }

  update(id: string, text: string): Observable<MemoryEntry> {
    return this.http.put<ApiResult<MemoryEntry>>(`${this.apiUrl}/${id}`, { text }).pipe(map((res) => res.value));
  }

  delete(id: string): Observable<void> {
    return this.http.delete<ApiResult>(`${this.apiUrl}/${id}`).pipe(map(() => undefined));
  }

  deleteAll(): Observable<void> {
    return this.http.delete<ApiResult>(this.apiUrl).pipe(map(() => undefined));
  }
}
