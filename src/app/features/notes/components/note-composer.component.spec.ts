import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ConfirmationService } from 'primeng/api';
import { of } from 'rxjs';
import { CreateNoteRequest, PagedResult, Note } from '../../../core/models';
import { NoteService } from '../../../core/services/api/note.service';
import { NotificationService } from '../../../core/services/notification.service';
import { NoteComposerComponent } from './note-composer.component';

/** `form` is protected on the component; the test reads it the way the template does. */
type Composer = NoteComposerComponent & {
  form: {
    controls: { content: { setValue(v: string): void }; status: { setValue(v: string | null): void } };
    getRawValue(): { status: string | null };
  };
};

const emptyPage: PagedResult<Note> = { items: [], page: 1, pageSize: 20, totalCount: 0 };

describe('NoteComposerComponent status', () => {
  let service: { create: ReturnType<typeof vi.fn>; search: ReturnType<typeof vi.fn>; listTags: ReturnType<typeof vi.fn> };

  function composer(): Composer {
    return TestBed.createComponent(NoteComposerComponent).componentInstance as Composer;
  }

  function created(): CreateNoteRequest {
    return service.create.mock.calls[0][0] as CreateNoteRequest;
  }

  beforeEach(() => {
    service = {
      create: vi.fn().mockReturnValue(of('n1')),
      search: vi.fn().mockReturnValue(of(emptyPage)),
      listTags: vi.fn().mockReturnValue(of([])),
    };
    TestBed.configureTestingModule({
      providers: [
        provideNoopAnimations(),
        ConfirmationService,
        { provide: NoteService, useValue: service },
        { provide: NotificationService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
  });

  it('leaves the status unset, so an untouched composer creates a note with no status', async () => {
    const c = composer();
    expect(c.form.getRawValue().status).toBeNull();

    c.form.controls.content.setValue('un fragmento que no es trabajo');
    await c.save();

    expect(created().status).toBeNull();
  });

  it('sends the status the user chose', async () => {
    const c = composer();
    c.form.controls.content.setValue('Migrar auth a OAuth');
    c.form.controls.status.setValue('inProgress');
    await c.save();

    expect(created().status).toBe('inProgress');
  });
});
