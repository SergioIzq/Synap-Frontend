import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Note, NoteStatus } from '../../../core/models';
import { NoteService } from '../../../core/services/api/note.service';
import { NotificationService } from '../../../core/services/notification.service';
import { NoteStatusControlComponent } from './note-status-control.component';

const note = (status: NoteStatus | null = null): Note => ({
  id: 'n1',
  title: 'Migrar auth a OAuth',
  content: 'cuerpo',
  type: 'text',
  status,
  createdAt: '',
  updatedAt: '',
  tags: [],
  metadataTitle: null,
  metadataDescription: null,
  metadataImageUrl: null,
});

type Control = NoteStatusControlComponent & {
  label(status: NoteStatus): string;
  items(): { label?: string; separator?: boolean; disabled?: boolean; command?: () => void }[];
};

let service: { setStatus: ReturnType<typeof vi.fn>; getById: ReturnType<typeof vi.fn> };
let notifications: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

function control(status: NoteStatus | null = null): Control {
  const instance = TestBed.runInInjectionContext(() => new NoteStatusControlComponent()) as Control;
  instance.note = note(status);
  return instance;
}

describe('NoteStatusControlComponent', () => {
  beforeEach(() => {
    service = { setStatus: vi.fn().mockReturnValue(of(undefined)), getById: vi.fn().mockReturnValue(of(note('pending'))) };
    notifications = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: NoteService, useValue: service },
        { provide: NotificationService, useValue: notifications },
      ],
    });
  });

  it('labels every status in Spanish', () => {
    const c = control();
    expect([c.label('pending'), c.label('inProgress'), c.label('paused'), c.label('completed')]).toEqual([
      'Pendiente',
      'En desarrollo',
      'Pausado',
      'Completado',
    ]);
  });

  it('offers the four statuses, and clearing only when the note carries one', () => {
    expect(control().items().map((i) => i.label)).toEqual(['Pendiente', 'En desarrollo', 'Pausado', 'Completado']);

    const marked = control('paused').items();
    expect(marked.at(-1)?.label).toBe('Sin estado');
    expect(marked.find((i) => i.label === 'Pausado')?.disabled).toBe(true);
  });

  it('saves the status chosen from the menu and reports it in Spanish', async () => {
    const c = control();
    c.items().find((i) => i.label === 'En desarrollo')?.command?.({});
    await vi.waitFor(() => expect(notifications.success).toHaveBeenCalledWith('Estado actualizado'));
    expect(service.setStatus).toHaveBeenCalledWith('n1', 'inProgress');
  });

  it('clears the status through the same menu', async () => {
    const c = control('paused');
    c.items().find((i) => i.label === 'Sin estado')?.command?.({});
    await vi.waitFor(() => expect(notifications.success).toHaveBeenCalledWith('Estado quitado'));
    expect(service.setStatus).toHaveBeenCalledWith('n1', null);
  });
});
