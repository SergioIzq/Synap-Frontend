import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  ApiResult,
  CreateNoteRequest,
  Note,
  NoteSearchParams,
  PagedResult,
  QuickCaptureRequest,
  RelatedNote,
  UpdateNoteRequest,
} from '../../models';

export const NOTES_PAGE_SIZE = 20;

@Injectable({ providedIn: 'root' })
export class NoteService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/notes`;

  search({ term, tag, type, page = 1, pageSize = NOTES_PAGE_SIZE }: NoteSearchParams): Observable<PagedResult<Note>> {
    const params: Record<string, string | number> = { page, pageSize };
    if (term) params['q'] = term;
    if (tag) params['tag'] = tag;
    if (type) params['type'] = type;

    return this.http
      .get<ApiResult<PagedResult<Note>>>(`${this.apiUrl}/search`, { params })
      .pipe(map((res) => res.value));
  }

  getById(id: string): Observable<Note> {
    return this.http.get<ApiResult<Note>>(`${this.apiUrl}/${id}`).pipe(map((res) => res.value));
  }

  /** Every tag the user has on at least one note - for the filter, independent of paging. */
  listTags(): Observable<string[]> {
    return this.http.get<ApiResult<string[]>>(`${environment.apiUrl}/tags`).pipe(map((res) => res.value));
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

  getRelated(id: string): Observable<RelatedNote[]> {
    return this.http.get<ApiResult<RelatedNote[]>>(`${this.apiUrl}/${id}/related`).pipe(map((res) => res.value));
  }
}
