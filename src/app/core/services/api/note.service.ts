import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResult, CreateNoteRequest, Note, QuickCaptureRequest, UpdateNoteRequest } from '../../models';

@Injectable({ providedIn: 'root' })
export class NoteService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/notes`;

  search(searchTerm: string | null, tag: string | null): Observable<Note[]> {
    const params: Record<string, string> = {};
    if (searchTerm) params['q'] = searchTerm;
    if (tag) params['tag'] = tag;

    return this.http.get<ApiResult<Note[]>>(`${this.apiUrl}/search`, { params }).pipe(map((res) => res.value));
  }

  create(request: CreateNoteRequest): Observable<string> {
    return this.http.post<ApiResult<string>>(this.apiUrl, request).pipe(map((res) => res.value));
  }

  quickCapture(request: QuickCaptureRequest): Observable<string> {
    return this.http.post<ApiResult<string>>(`${this.apiUrl}/quick-capture`, request).pipe(map((res) => res.value));
  }

  update(id: string, request: UpdateNoteRequest): Observable<void> {
    return this.http.put<ApiResult>(`${this.apiUrl}/${id}`, request).pipe(map(() => undefined));
  }

  delete(id: string): Observable<void> {
    return this.http.delete<ApiResult>(`${this.apiUrl}/${id}`).pipe(map(() => undefined));
  }

  addTag(id: string, tagName: string): Observable<void> {
    return this.http.post<ApiResult>(`${this.apiUrl}/${id}/tags`, { tagName }).pipe(map(() => undefined));
  }
}
