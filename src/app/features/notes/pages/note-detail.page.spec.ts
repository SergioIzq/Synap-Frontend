import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Component } from '@angular/core';
import { ConfirmationService } from 'primeng/api';
import { Observable, of } from 'rxjs';
import { NoteService } from '../../../core/services/api/note.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Note, NoteConnections, NoteType } from '../../../core/models';
import { NoteDetailPage } from './note-detail.page';

@Component({ template: '' })
class AssistantStub {}

const note = (id: string, type: NoteType): Note => ({
  id,
  title: 'Nota',
  content: type === 'bookmark' ? 'https://example.com' : 'contenido',
  type,
  status: null,
  createdAt: '2026-09-01T10:00:00',
  updatedAt: '2026-09-01T10:00:00',
  tags: ['docker', 'python'],
  metadataTitle: null,
  metadataDescription: null,
  metadataImageUrl: null,
});

const noteServiceStub = (type: NoteType) => ({
  getById: vi.fn((id: string) => of(note(id, type))),
  getConnections: vi.fn(() => of({ status: 'ready', notes: [], topic: null } as NoteConnections)),
  markViewed: vi.fn(() => of(undefined)),
  listTags: vi.fn(() => of([])),
});

/** scoped-assistant task 5.1 - "Preguntar a la IA" on a note and on each of its tags. */
describe('NoteDetailPage ask-AI entry points', () => {
  async function open(type: NoteType) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'app/notes/:id', component: NoteDetailPage },
          { path: 'app/assistant', component: AssistantStub },
        ]),
        provideNoopAnimations(),
        ConfirmationService,
        { provide: NoteService, useValue: noteServiceStub(type) },
        { provide: NotificationService, useValue: { success: vi.fn(), error: vi.fn(), warn: vi.fn() } },
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/app/notes/n1', NoteDetailPage);
    for (let i = 0; i < 3; i++) {
      await new Promise((r) => setTimeout(r));
      harness.detectChanges();
    }
    return harness;
  }

  const askButton = (harness: RouterTestingHarness) =>
    [...harness.routeNativeElement!.querySelectorAll('button')].find((b) => b.getAttribute('aria-label')?.startsWith('Preguntar a la IA'))!;

  it.each<NoteType>(['text', 'codeSnippet'])('a %s note opens the assistant scoped to it', async (type) => {
    const harness = await open(type);
    const button = askButton(harness);

    expect(button.disabled).toBe(false);
    button.click();
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/app/assistant?note=n1');
  });

  it('a bookmark shows the option disabled with an explanation', async () => {
    const harness = await open('bookmark');
    const button = askButton(harness);

    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-label')).toContain('no disponible para enlaces');
    expect(harness.routeNativeElement!.textContent).toContain('Podrás preguntar a la IA sobre enlaces');
  });

  it('each tag offers asking about it', async () => {
    const harness = await open('text');
    const tagButton = [...harness.routeNativeElement!.querySelectorAll('button')].find(
      (b) => b.getAttribute('aria-label') === 'Preguntar sobre #python',
    )!;

    tagButton.click();
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/app/assistant?tag=python');
  });
});

const relatedNote = (id: string) => ({ id, title: `Nota ${id}`, content: `contenido ${id}`, type: 'text' as const, similarity: 0.9 });

async function openDetail(svcOverrides: Partial<ReturnType<typeof noteServiceStub>>) {
  const svc = { ...noteServiceStub('text'), ...svcOverrides };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'app/notes/:id', component: NoteDetailPage },
        { path: 'app/notes/:id/alt', component: AssistantStub },
      ]),
      provideNoopAnimations(),
      ConfirmationService,
      { provide: NoteService, useValue: svc },
      { provide: NotificationService, useValue: { success: vi.fn(), error: vi.fn(), warn: vi.fn() } },
    ],
  });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl('/app/notes/n1', NoteDetailPage);
  // Microtask-based settling: compatible con timers falsos (no usa setTimeout)
  for (let i = 0; i < 5; i++) { await Promise.resolve(); harness.detectChanges(); }
  return { harness, svc };
}

describe('NoteDetailPage — conexiones (smart-resurfacing)', () => {
  it('«Detalle con conexiones»: muestra la sección Conexiones cuando hay notas ready', async () => {
    const { harness } = await openDetail({
      getConnections: vi.fn(() => of({ status: 'ready', notes: [relatedNote('c1'), relatedNote('c2')], topic: null } as NoteConnections)),
    });
    await Promise.resolve(); harness.detectChanges();

    const section = harness.routeNativeElement!.querySelector('.related');
    expect(section?.textContent).toContain('Conexiones');
    expect(section?.textContent).toContain('Nota c1');
    expect(section?.textContent).toContain('Nota c2');
  });

  it('«Detalle de una nota recién creada»: tras varios intentos pending llega ready y se muestra', async () => {
    vi.useFakeTimers();
    try {
      let calls = 0;
      const { harness } = await openDetail({
        getConnections: vi.fn((): Observable<NoteConnections> => {
          calls++;
          return of(calls < 3
            ? { status: 'pending', notes: [], topic: null }
            : { status: 'ready', notes: [relatedNote('c1')], topic: null });
        }),
      });

      await vi.advanceTimersByTimeAsync(2000); // segundo intento
      await vi.advanceTimersByTimeAsync(2000); // tercer intento (ready)
      harness.detectChanges();

      expect(harness.routeNativeElement!.querySelector('.related')?.textContent).toContain('Conexiones');
    } finally {
      vi.useRealTimers();
    }
  });

  it('«Detalle sin conexiones»: oculta la sección si notes está vacío', async () => {
    const { harness } = await openDetail({
      getConnections: vi.fn(() => of({ status: 'ready', notes: [], topic: null } as NoteConnections)),
    });
    await Promise.resolve(); harness.detectChanges();

    expect(harness.routeNativeElement!.querySelector('.related')).toBeNull();
  });

  it('«Ir a una conexión»: clicar un enlace navega a esa nota', async () => {
    const { harness } = await openDetail({
      getConnections: vi.fn(() => of({ status: 'ready', notes: [relatedNote('c1')], topic: null } as NoteConnections)),
    });
    await Promise.resolve(); harness.detectChanges();

    const link = harness.routeNativeElement!.querySelector('.related a') as HTMLAnchorElement;
    expect(link?.getAttribute('href')).toContain('/app/notes/c1');
  });

  it('markViewed se llama una vez al abrir la nota', async () => {
    const getConnections = vi.fn(() => of({ status: 'ready', notes: [], topic: null } as NoteConnections));
    const markViewed = vi.fn(() => of(undefined));
    await openDetail({ getConnections, markViewed });
    await Promise.resolve();

    expect(markViewed).toHaveBeenCalledTimes(1);
    expect(markViewed).toHaveBeenCalledWith('n1');
  });
});
