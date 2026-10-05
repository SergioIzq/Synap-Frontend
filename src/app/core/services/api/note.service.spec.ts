import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { NOTES_PAGE_SIZE, NoteService } from './note.service';

describe('NoteService', () => {
  let service: NoteService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(NoteService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('search() sends only the filters that are set, plus paging', async () => {
    const promise = firstValueFrom(service.search({ term: 'cors', type: 'codeSnippet', page: 2 }));
    const req = http.expectOne((r) => r.url === `${environment.apiUrl}/notes/search`);

    expect(req.request.params.get('q')).toBe('cors');
    expect(req.request.params.get('type')).toBe('codeSnippet');
    expect(req.request.params.has('tag')).toBe(false);
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('pageSize')).toBe(String(NOTES_PAGE_SIZE));

    const page = { items: [], page: 2, pageSize: 20, totalCount: 21 };
    req.flush({ value: page });
    expect(await promise).toEqual(page);
  });

  it('search() serializes a multi-valued status filter, "none" included', async () => {
    const promise = firstValueFrom(service.search({ status: ['pending', 'inProgress', 'none'] }));
    const req = http.expectOne((r) => r.url === `${environment.apiUrl}/notes/search`);

    expect(req.request.params.get('status')).toBe('pending,inProgress,none');

    req.flush({ value: { items: [], page: 1, pageSize: 20, totalCount: 0 } });
    await promise;
  });

  it('search() leaves the status out when nothing is selected, so the API applies its default', async () => {
    const promise = firstValueFrom(service.search({ status: [] }));
    const req = http.expectOne((r) => r.url === `${environment.apiUrl}/notes/search`);

    expect(req.request.params.has('status')).toBe(false);

    req.flush({ value: { items: [], page: 1, pageSize: 20, totalCount: 0 } });
    await promise;
  });

  it('setStatus() patches the note\'s own status endpoint, and null clears it', async () => {
    const marked = firstValueFrom(service.setStatus('n1', 'inProgress'));
    const first = http.expectOne(`${environment.apiUrl}/notes/n1/status`);
    expect(first.request.method).toBe('PATCH');
    expect(first.request.body).toEqual({ status: 'inProgress' });
    first.flush({ value: null });
    await marked;

    const cleared = firstValueFrom(service.setStatus('n1', null));
    const second = http.expectOne(`${environment.apiUrl}/notes/n1/status`);
    expect(second.request.body).toEqual({ status: null });
    second.flush({ value: null });
    await cleared;
  });

  it('getById() and listTags() unwrap the value', async () => {
    const note = firstValueFrom(service.getById('n1'));
    http.expectOne(`${environment.apiUrl}/notes/n1`).flush({ value: { id: 'n1' } });
    expect((await note).id).toBe('n1');

    const tags = firstValueFrom(service.listTags());
    http.expectOne(`${environment.apiUrl}/tags`).flush({ value: ['a', 'b'] });
    expect(await tags).toEqual(['a', 'b']);
  });

  it('create() sends type, title, content and tags in one request', async () => {
    const promise = firstValueFrom(
      service.create({ type: null, title: 'Título', content: 'https://example.com', tags: ['a', 'b'] }),
    );
    const req = http.expectOne({ method: 'POST', url: `${environment.apiUrl}/notes` });
    expect(req.request.body).toEqual({ type: null, title: 'Título', content: 'https://example.com', tags: ['a', 'b'] });
    req.flush({ value: 'nueva-id' });
    expect(await promise).toBe('nueva-id');
  });
});
