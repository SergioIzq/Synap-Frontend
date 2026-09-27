import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, convertToParamMap } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ConfirmationService } from 'primeng/api';
import { of } from 'rxjs';
import { NoteService } from '../../../core/services/api/note.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Note, NoteSearchParams, PagedResult } from '../../../core/models';
import { NotesListPage, paramsFromQuery, queryFromParams } from './notes-list.page';

const note = (id: string): Note => ({
  id,
  title: `Nota ${id}`,
  content: id,
  type: 'text',
  createdAt: '',
  updatedAt: '',
  tags: [],
  metadataTitle: null,
  metadataDescription: null,
  metadataImageUrl: null,
});

describe('notes list URL state', () => {
  it('reads filters, page and size from the URL', () => {
    expect(queryFromParams(convertToParamMap({ q: ' cors ', tag: 'x', type: 'codeSnippet', page: '3', size: '50' }))).toEqual({
      term: 'cors',
      tag: 'x',
      type: 'codeSnippet',
      page: 3,
      pageSize: 50,
    });
  });

  it('clamps invalid values to their defaults', () => {
    expect(queryFromParams(convertToParamMap({ type: 'nope', page: '-2', size: '7' }))).toEqual({
      term: null,
      tag: null,
      type: null,
      page: 1,
      pageSize: 20,
    });
    expect(queryFromParams(convertToParamMap({ page: '2.5' })).page).toBe(1);
  });

  it('writes only non-default values', () => {
    expect(paramsFromQuery({ term: null, tag: null, type: null, page: 1, pageSize: 20 })).toEqual({
      q: null,
      tag: null,
      type: null,
      page: null,
      size: null,
    });
    expect(paramsFromQuery({ term: 'a', tag: 'b', type: 'bookmark', page: 2, pageSize: 10 })).toEqual({
      q: 'a',
      tag: 'b',
      type: 'bookmark',
      page: 2,
      size: 10,
    });
  });
});

describe('NotesListPage', () => {
  let search: ReturnType<typeof vi.fn>;
  let total: number;

  /** A vault of `total` notes, served page by page like the API. */
  function serve(params: NoteSearchParams): PagedResult<Note> {
    const size = params.pageSize ?? 20;
    const page = params.page ?? 1;
    const ids = Array.from({ length: total }, (_, i) => `${i + 1}`).slice((page - 1) * size, page * size);
    return { items: ids.map(note), page, pageSize: size, totalCount: total };
  }

  async function open(url: string) {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, NotesListPage);
    await settle(harness);
    return harness;
  }

  async function settle(harness: RouterTestingHarness) {
    for (let i = 0; i < 3; i++) {
      await new Promise((r) => setTimeout(r));
      harness.detectChanges();
    }
  }

  let scrollIntoView: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    total = 45;
    // jsdom has no layout: record the scroll instead.
    scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView as unknown as Element['scrollIntoView'];
    search = vi.fn((params: NoteSearchParams) => of(serve(params)));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'notes', component: NotesListPage },
          { path: 'app/assistant', component: NotesListPage },
        ]),
        provideNoopAnimations(),
        ConfirmationService,
        {
          provide: NoteService,
          useValue: { search, listTags: vi.fn(() => of([])), create: vi.fn(() => of('id')) },
        },
        { provide: NotificationService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
  });

  it('loads the page and filters in the URL', async () => {
    await open('/notes?page=3&tag=x');

    expect(search).toHaveBeenLastCalledWith({ term: null, tag: 'x', type: null, page: 3, pageSize: 20 });
  });

  it('treats an invalid size as 20', async () => {
    await open('/notes?size=7');

    expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, pageSize: 20 }));
  });

  it('changing the type goes back to page 1 and updates the URL', async () => {
    const harness = await open('/notes?page=2');
    const page = harness.routeDebugElement!.componentInstance as { changeType(t: string | null): void };

    page.changeType('codeSnippet');
    await settle(harness);

    expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'codeSnippet', page: 1 }));
    expect(TestBed.inject(Router).url).toBe('/notes?type=codeSnippet');
  });

  it('a page past the last one is replaced by the last page', async () => {
    const harness = await open('/notes?page=99');
    await settle(harness);

    expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3 }));
    expect(TestBed.inject(Router).url).toBe('/notes?page=3');
  });

  it('shows page controls with the range when there is more than one page', async () => {
    const harness = await open('/notes?page=2');
    const text = harness.routeNativeElement!.textContent ?? '';

    expect(harness.routeNativeElement!.querySelector('p-paginator')).not.toBeNull();
    expect(text).toContain('Mostrando 21–40 de 45');
  });

  it('hides page controls when everything fits on one page', async () => {
    total = 20;
    const harness = await open('/notes');

    expect(harness.routeNativeElement!.querySelector('p-paginator')).toBeNull();
    expect(harness.routeNativeElement!.querySelectorAll('app-note-card').length).toBe(20);
  });

  it('changing the page size goes back to page 1', async () => {
    const harness = await open('/notes?page=2');
    const page = harness.routeDebugElement!.componentInstance as { changePage(e: { page: number; rows: number }): void };

    page.changePage({ page: 1, rows: 50 });
    await settle(harness);

    expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, pageSize: 50 }));
    expect(TestBed.inject(Router).url).toBe('/notes?size=50');
  });

  it('moving to another page scrolls back to the start of the list', async () => {
    const harness = await open('/notes');
    const page = harness.routeDebugElement!.componentInstance as { changePage(e: { page: number; rows: number }): void };

    page.changePage({ page: 1, rows: 20 });
    await settle(harness);

    expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
    expect(TestBed.inject(Router).url).toBe('/notes?page=2');
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
  });

  it('offers no tag question without a tag filter', async () => {
    const harness = await open('/notes');
    expect(harness.routeNativeElement!.textContent).not.toContain('Preguntar sobre #');
  });

  it('offers asking about the active tag filter', async () => {
    const harness = await open('/notes?tag=docker');
    const link = [...harness.routeNativeElement!.querySelectorAll('p-button')].find((b) =>
      b.textContent?.includes('Preguntar sobre #docker'),
    );

    expect(link).toBeDefined();
    link!.querySelector('button')!.click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/app/assistant?tag=docker');
  });
});
