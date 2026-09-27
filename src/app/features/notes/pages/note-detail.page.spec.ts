import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Component } from '@angular/core';
import { ConfirmationService } from 'primeng/api';
import { of } from 'rxjs';
import { NoteService } from '../../../core/services/api/note.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Note, NoteType } from '../../../core/models';
import { NoteDetailPage } from './note-detail.page';

@Component({ template: '' })
class AssistantStub {}

const note = (id: string, type: NoteType): Note => ({
  id,
  title: 'Nota',
  content: type === 'bookmark' ? 'https://example.com' : 'contenido',
  type,
  createdAt: '2026-09-01T10:00:00',
  updatedAt: '2026-09-01T10:00:00',
  tags: ['docker', 'python'],
  metadataTitle: null,
  metadataDescription: null,
  metadataImageUrl: null,
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
        {
          provide: NoteService,
          useValue: { getById: vi.fn((id: string) => of(note(id, type))), getRelated: vi.fn(() => of([])), listTags: vi.fn(() => of([])) },
        },
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
