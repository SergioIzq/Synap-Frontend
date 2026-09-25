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

describe('NotesStore (paging)', () => {
  type Mock = ReturnType<typeof vi.fn>;
  let service: { search: Mock; getById: Mock; listTags: Mock; update: Mock; addTag: Mock; delete: Mock; create: Mock };
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
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: NoteService, useValue: service },
        { provide: NotificationService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
    store = TestBed.inject(NotesStore);
  });

  it('search() loads page 1 and knows there is more', async () => {
    await store.search({ term: 'x', type: 'codeSnippet' });

    expect(service.search).toHaveBeenCalledWith({ term: 'x', tag: null, type: 'codeSnippet', page: 1 });
    expect(store.notes().map((n) => n.id)).toEqual(['a', 'b']);
    expect(store.hasMore()).toBe(true);
  });

  it('loadMore() appends the next page with the same filters, then stops', async () => {
    await store.search({ tag: 't' });
    await store.loadMore();

    expect(service.search).toHaveBeenLastCalledWith({ term: null, tag: 't', type: null, page: 2 });
    expect(store.notes().map((n) => n.id)).toEqual(['a', 'b', 'c']);
    expect(store.hasMore()).toBe(false);

    await store.loadMore();
    expect(service.search).toHaveBeenCalledTimes(2);
  });

  it('loadMore() never duplicates a note that shifted pages', async () => {
    service.search.mockImplementation((params: NoteSearchParams) =>
      of(params.page === 1 ? page(['a', 'b'], 1, 4) : page(['b', 'c'], 2, 4)));

    await store.search();
    await store.loadMore();

    expect(store.notes().map((n) => n.id)).toEqual(['a', 'b', 'c']);
  });

  it('a new search resets to page 1', async () => {
    await store.search();
    await store.loadMore();
    await store.search({ term: 'otra' });

    expect(store.notes().map((n) => n.id)).toEqual(['a', 'b']);
    expect(store.searchTerm()).toBe('otra');
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
    await store.ensureNote('lejana');

    expect(service.getById).toHaveBeenCalledWith('lejana');
    expect(store.noteById('lejana')?.id).toBe('lejana');

    await store.ensureNote('a');
    expect(service.getById).toHaveBeenCalledTimes(1);
  });

  it('ensureNote() tolerates a 404', async () => {
    service.getById.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    await store.ensureNote('ajena');
    expect(store.noteById('ajena')).toBeUndefined();
  });

  it('addTag() refreshes just that note and the tag list', async () => {
    await store.search();
    await store.addTag('a', 'nueva');

    expect(store.noteById('a')?.tags).toEqual(['nueva']);
    expect(store.allTags()).toEqual(['alfa', 'beta']);
    expect(service.search).toHaveBeenCalledTimes(1);
  });

  it('delete() removes the note and lowers the total', async () => {
    await store.search();
    await store.delete('a');

    expect(store.notes().map((n) => n.id)).toEqual(['b']);
    expect(store.totalCount()).toBe(2);
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
