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

  it('getById() and listTags() unwrap the value', async () => {
    const note = firstValueFrom(service.getById('n1'));
    http.expectOne(`${environment.apiUrl}/notes/n1`).flush({ value: { id: 'n1' } });
    expect((await note).id).toBe('n1');

    const tags = firstValueFrom(service.listTags());
    http.expectOne(`${environment.apiUrl}/tags`).flush({ value: ['a', 'b'] });
    expect(await tags).toEqual(['a', 'b']);
  });
});
