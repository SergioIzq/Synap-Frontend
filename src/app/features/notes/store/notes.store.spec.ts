import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of, throwError } from 'rxjs';
import { NoteService } from '../../../core/services/api/note.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Note, NoteSearchParams, PagedResult } from '../../../core/models';
import { NotesStore } from './notes.store';

const note = (id: string, tags: string[] = []): Note => ({
  id,
  title: null,
  content: id,
  type: 'text',
  status: null,
  createdAt: '',
  updatedAt: '',
  tags,
  metadataTitle: null,
  metadataDescription: null,
  metadataImageUrl: null,
});

const page = (ids: string[], pageNumber: number, total: number): PagedResult<Note> => ({
  items: ids.map((id) => note(id)),
  page: pageNumber,
  pageSize: 2,
  totalCount: total,
});

describe('NotesStore', () => {
  type Mock = ReturnType<typeof vi.fn>;
  let service: {
    search: Mock;
    getById: Mock;
    listTags: Mock;
    update: Mock;
    addTag: Mock;
    delete: Mock;
    create: Mock;
    setStatus: Mock;
  };
  let store: NotesStore;

  beforeEach(() => {
    service = {
      search: vi.fn((params: NoteSearchParams) =>
        of(params.page === 1 ? page(['a', 'b'], 1, 3) : page(['c'], 2, 3))),
      getById: vi.fn((id: string) => of(note(id, ['nueva']))),
      listTags: vi.fn(() => of(['alfa', 'beta'])),
      update: vi.fn(() => of(undefined)),
      addTag: vi.fn(() => of(undefined)),
      delete: vi.fn(() => of(undefined)),
      create: vi.fn(() => of('id')),
      setStatus: vi.fn(() => of(undefined)),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: NoteService, useValue: service },
        { provide: NotificationService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
    store = TestBed.inject(NotesStore);
  });

  it('search() loads one page with its filters and page size', async () => {
    await store.search({ term: 'x', type: 'codeSnippet', pageSize: 2 });

    expect(service.search).toHaveBeenCalledWith({ term: 'x', tag: null, type: 'codeSnippet', status: [], page: 1, pageSize: 2 });
    expect(store.notes().map((n) => n.id)).toEqual(['a', 'b']);
    expect(store.totalCount()).toBe(3);
    expect(store.pageCount()).toBe(2);
  });

  it('search() for another page replaces the notes instead of appending', async () => {
    await store.search({ tag: 't', pageSize: 2 });
    await store.search({ tag: 't', page: 2, pageSize: 2 });

    expect(service.search).toHaveBeenLastCalledWith({ term: null, tag: 't', type: null, status: [], page: 2, pageSize: 2 });
    expect(store.notes().map((n) => n.id)).toEqual(['c']);
    expect(store.page()).toBe(2);
  });

  it('search() carries a status filter and reloading the same query gives the same state back', async () => {
    const query = { term: 'cors', tag: 't', type: 'text' as const, status: ['pending' as const, 'none' as const], page: 1, pageSize: 2 };
    await store.search(query);

    expect(service.search).toHaveBeenLastCalledWith(expect.objectContaining({ status: ['pending', 'none'] }));
    expect(store.status()).toEqual(['pending', 'none']);
    expect(store.effectiveStatus()).toEqual(['pending', 'none']);

    const reloaded = { ...store.query() };
    await store.search(reloaded);
    expect(store.query()).toEqual(reloaded);
  });

  it('an empty status filter resolves to the default: everything live, completed left out', async () => {
    await store.search({ pageSize: 2 });

    expect(store.status()).toEqual([]);
    expect(store.effectiveStatus()).toEqual(['pending', 'inProgress', 'paused', 'none']);
  });

  it('setStatus() saves the status, reports it in Spanish and reloads the note', async () => {
    await store.search({ pageSize: 2 });

    await store.setStatus('a', 'inProgress');
    expect(service.setStatus).toHaveBeenCalledWith('a', 'inProgress');
    expect(service.getById).toHaveBeenLastCalledWith('a');

    await store.setStatus('a', null);
    expect(service.setStatus).toHaveBeenLastCalledWith('a', null);
  });

  it('a page past the last one falls back to the last page', async () => {
    service.search.mockImplementation((params: NoteSearchParams) =>
      of(params.page === 2 ? page(['c'], 2, 3) : { ...page([], params.page!, 3) }));

    await store.search({ page: 9, pageSize: 2 });

    expect(service.search).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
    expect(store.page()).toBe(2);
    expect(store.notes().map((n) => n.id)).toEqual(['c']);
  });

  it('an empty vault stays on page 1', async () => {
    service.search.mockReturnValue(of(page([], 1, 0)));
    await store.search();

    expect(service.search).toHaveBeenCalledTimes(1);
    expect(store.notes()).toEqual([]);
    expect(store.pageCount()).toBe(1);
  });

  it('ignores a stale response that arrives after a newer search', async () => {
    const slow = new Subject<PagedResult<Note>>();
    service.search.mockReturnValueOnce(slow).mockReturnValueOnce(of(page(['nuevo'], 1, 1)));

    const first = store.search({ term: 'vie' });
    await store.search({ term: 'viejo' });
    slow.next(page(['obsoleto'], 1, 1));
    slow.complete();
    await first;

    expect(store.notes().map((n) => n.id)).toEqual(['nuevo']);
    expect(store.loading()).toBe(false);
  });

  it('ensureNote() fetches a note outside the loaded pages', async () => {
    await store.search();
    expect(await store.ensureNote('lejana')).toBe('found');

    expect(service.getById).toHaveBeenCalledWith('lejana');
    expect(store.noteById('lejana')?.id).toBe('lejana');

    await store.ensureNote('a');
    expect(service.getById).toHaveBeenCalledTimes(1);
  });

  it('ensureNote() tolerates a 404', async () => {
    service.getById.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    expect(await store.ensureNote('ajena')).toBe('missing');
    expect(store.noteById('ajena')).toBeUndefined();
  });

  it('ensureNote() tells a network failure apart from a missing note', async () => {
    service.getById.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    expect(await store.ensureNote('x')).toBe('error');
  });

  it('addTag() refreshes just that note and the tag list', async () => {
    await store.search();
    await store.addTag('a', 'nueva');

    expect(store.noteById('a')?.tags).toEqual(['nueva']);
    expect(store.allTags()).toEqual(['alfa', 'beta']);
    expect(service.search).toHaveBeenCalledTimes(1);
  });

  it('delete() reloads the current page so it refills from the next one', async () => {
    await store.search({ tag: 't', page: 1, pageSize: 2 });
    service.search.mockReturnValue(of(page(['b', 'c'], 1, 2)));
    await store.delete('a');

    expect(service.delete).toHaveBeenCalledWith('a');
    expect(service.search).toHaveBeenLastCalledWith({ term: null, tag: 't', type: null, status: [], page: 1, pageSize: 2 });
    expect(store.notes().map((n) => n.id)).toEqual(['b', 'c']);
    expect(store.totalCount()).toBe(2);
  });

  it('delete() of the only note on the last page moves to the previous page', async () => {
    await store.search({ page: 2, pageSize: 2 });
    service.search.mockImplementation((params: NoteSearchParams) =>
      of(params.page === 1 ? page(['a', 'b'], 1, 2) : page([], 2, 2)));
    await store.delete('c');

    expect(store.page()).toBe(1);
    expect(store.notes().map((n) => n.id)).toEqual(['a', 'b']);
  });

  it('create() shows page 1 keeping the filters', async () => {
    await store.search({ tag: 't', page: 2, pageSize: 2 });
    await store.create({ type: 'text', title: null, content: 'nueva', tags: [] });

    expect(service.search).toHaveBeenLastCalledWith({ term: null, tag: 't', type: null, status: [], page: 1, pageSize: 2 });
    expect(store.page()).toBe(1);
  });

  it('updateWithTags() saves content and each new tag, then refreshes once', async () => {
    await store.search();
    await store.updateWithTags('a', { title: 'T', content: 'c' }, ['uno', 'dos']);

    expect(service.update).toHaveBeenCalledWith('a', { title: 'T', content: 'c' });
    expect(service.addTag).toHaveBeenCalledTimes(2);
    expect(service.getById).toHaveBeenCalledWith('a');
    expect(service.listTags).toHaveBeenCalled();
  });
});
