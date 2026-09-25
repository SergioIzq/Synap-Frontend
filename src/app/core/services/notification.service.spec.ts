import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { ERROR_LIFE_MS, NotificationService, SUCCESS_LIFE_MS } from './notification.service';

describe('NotificationService', () => {
  let add: ReturnType<typeof vi.fn>;
  let service: NotificationService;

  beforeEach(() => {
    add = vi.fn();
    TestBed.configureTestingModule({ providers: [{ provide: MessageService, useValue: { add } }] });
    service = TestBed.inject(NotificationService);
  });

  it('success() uses the success severity and short duration', () => {
    service.success('Nota guardada', 'detalle');
    expect(add).toHaveBeenCalledWith({ severity: 'success', summary: 'Nota guardada', detail: 'detalle', life: SUCCESS_LIFE_MS });
  });

  it('error() uses the error severity and longer duration', () => {
    service.error('Error', 'Algo falló');
    expect(add).toHaveBeenCalledWith({ severity: 'error', summary: 'Error', detail: 'Algo falló', life: ERROR_LIFE_MS });
  });

  it('warn() uses the warn severity', () => {
    service.warn('Ojo');
    expect(add).toHaveBeenCalledWith(expect.objectContaining({ severity: 'warn', summary: 'Ojo' }));
  });
});
