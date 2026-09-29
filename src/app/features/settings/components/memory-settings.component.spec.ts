import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { Confirmation, ConfirmationService } from 'primeng/api';
import { MemoryService } from '../../../core/services/api/memory.service';
import { NotificationService } from '../../../core/services/notification.service';
import { MemoryEntry } from '../../../core/models';
import { MemorySettingsComponent } from './memory-settings.component';

const entry = (id: string, text: string, updatedAt = '2026-09-28T10:00:00'): MemoryEntry => ({ id, text, updatedAt });

describe('MemorySettingsComponent', () => {
  let service: Record<keyof MemoryService, ReturnType<typeof vi.fn>>;
  let confirm: ReturnType<typeof vi.fn>;
  let notifications: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> };

  function list(entries: MemoryEntry[]) {
    return of({ entries, maxEntries: 25, maxTextLength: 200 });
  }

  async function render() {
    const fixture = TestBed.createComponent(MemorySettingsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  async function settle(fixture: Awaited<ReturnType<typeof render>>) {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const el = (fixture: Awaited<ReturnType<typeof render>>) => fixture.nativeElement as HTMLElement;
  const texts = (fixture: Awaited<ReturnType<typeof render>>) =>
    [...el(fixture).querySelectorAll('.entry-text')].map((p) => p.textContent?.trim());
  const button = (fixture: Awaited<ReturnType<typeof render>>, label: string, index = 0) =>
    [...el(fixture).querySelectorAll<HTMLButtonElement>('button')].filter(
      (b) => b.textContent?.trim() === label || b.getAttribute('aria-label') === label,
    )[index];
  function type(input: HTMLInputElement, value: string) {
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  beforeEach(() => {
    service = {
      list: vi.fn(() => list([entry('m2', 'prefiero respuestas cortas', '2026-09-28T11:00:00'), entry('m1', 'Trabajo con .NET')])),
      add: vi.fn((text: string) => of(entry('m3', text, '2026-09-28T12:00:00'))),
      update: vi.fn((id: string, text: string) => of(entry(id, text, '2026-09-28T13:00:00'))),
      delete: vi.fn(() => of(undefined)),
      deleteAll: vi.fn(() => of(undefined)),
    };
    confirm = vi.fn();
    notifications = { success: vi.fn(), error: vi.fn(), warn: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideNoopAnimations(),
        { provide: MemoryService, useValue: service },
        { provide: ConfirmationService, useValue: { confirm } },
        { provide: NotificationService, useValue: notifications },
      ],
    });
  });

  it('lists the entries in the server order with their date and the usage counter', async () => {
    const fixture = await render();

    expect(texts(fixture)).toEqual(['prefiero respuestas cortas', 'Trabajo con .NET']);
    expect(el(fixture).querySelector('.entry-date')?.textContent).toContain('Actualizado el');
    expect(el(fixture).textContent).toContain('2/25 recuerdos');
  });

  it('adds an entry at the top and shows the character count and limit', async () => {
    const fixture = await render();
    const input = el(fixture).querySelector<HTMLInputElement>('input[aria-label="Nuevo recuerdo"]')!;

    type(input, '  Vivo en Madrid ');
    fixture.detectChanges();
    expect(input.getAttribute('maxlength')).toBe('200');
    expect(el(fixture).querySelector('.char-count')?.textContent).toBe('17/200');

    button(fixture, 'Añadir').click();
    await settle(fixture);

    expect(service.add).toHaveBeenCalledWith('Vivo en Madrid');
    expect(texts(fixture)[0]).toBe('Vivo en Madrid');
    expect(el(fixture).textContent).toContain('3/25 recuerdos');
    expect(input.value).toBe('');
  });

  it('edits an entry inline and moves it to the top', async () => {
    const fixture = await render();

    button(fixture, 'Editar recuerdo', 1).click();
    fixture.detectChanges();
    const input = el(fixture).querySelector<HTMLInputElement>('input[aria-label="Editar recuerdo"]')!;
    expect(input.value).toBe('Trabajo con .NET');

    type(input, 'Trabajo con .NET y Angular');
    fixture.detectChanges();
    button(fixture, 'Guardar').click();
    await settle(fixture);

    expect(service.update).toHaveBeenCalledWith('m1', 'Trabajo con .NET y Angular');
    expect(texts(fixture)).toEqual(['Trabajo con .NET y Angular', 'prefiero respuestas cortas']);
  });

  it('deletes one entry', async () => {
    const fixture = await render();

    button(fixture, 'Borrar recuerdo', 0).click();
    await settle(fixture);

    expect(service.delete).toHaveBeenCalledWith('m2');
    expect(texts(fixture)).toEqual(['Trabajo con .NET']);
  });

  it('deletes everything only after confirming', async () => {
    const fixture = await render();

    button(fixture, 'Borrar toda la memoria').click();
    expect(service.deleteAll).not.toHaveBeenCalled();
    const confirmation = confirm.mock.calls[0][0] as Confirmation;
    expect(confirmation.header).toBe('Borrar toda la memoria');

    confirmation.accept!();
    await settle(fixture);

    expect(service.deleteAll).toHaveBeenCalled();
    expect(texts(fixture)).toEqual([]);
    expect(el(fixture).textContent).toContain('0/25 recuerdos');
  });

  it('disables adding when the memory is full', async () => {
    service.list.mockReturnValue(list(Array.from({ length: 25 }, (_, i) => entry(`m${i}`, `recuerdo ${i}`))));
    const fixture = await render();

    const input = el(fixture).querySelector<HTMLInputElement>('input[aria-label="Nuevo recuerdo"]')!;
    expect(input.disabled).toBe(true);
    expect(input.placeholder).toContain('Memoria llena');
  });

  it('shows the backend\'s Spanish message when a change is rejected', async () => {
    service.add.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 400, error: { error: { message: 'El recuerdo no puede superar los 200 caracteres.' } } }),
      ),
    );
    const fixture = await render();

    type(el(fixture).querySelector<HTMLInputElement>('input[aria-label="Nuevo recuerdo"]')!, 'x');
    fixture.detectChanges();
    button(fixture, 'Añadir').click();
    await settle(fixture);

    expect(notifications.error).toHaveBeenCalledWith('Error', 'El recuerdo no puede superar los 200 caracteres.');
    expect(texts(fixture)).toHaveLength(2);
  });

  it('leaves network failures to the global error toast', async () => {
    service.list.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    await render();

    expect(notifications.error).not.toHaveBeenCalled();
  });
});
