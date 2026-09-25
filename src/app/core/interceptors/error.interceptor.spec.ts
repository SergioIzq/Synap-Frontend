import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../stores/auth.store';
import { NotificationService } from '../services/notification.service';
import { errorInterceptor } from './error.interceptor';

describe('errorInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let notifications: { error: ReturnType<typeof vi.fn> };
  let logout: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    notifications = { error: vi.fn() };
    logout = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: NotificationService, useValue: notifications },
        { provide: AuthStore, useValue: { logout } },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  async function failWith(status: number, url = '/api/notes') {
    const promise = firstValueFrom(http.get(url)).catch(() => undefined);
    controller.expectOne(url).flush(null, { status, statusText: 'x' });
    await promise;
  }

  it('shows a global toast for 5xx', async () => {
    await failWith(500);
    expect(notifications.error).toHaveBeenCalledWith('Algo ha fallado en el servidor', expect.any(String));
  });

  it('shows a global toast when the server is unreachable', async () => {
    const promise = firstValueFrom(http.get('/api/notes')).catch(() => undefined);
    controller.expectOne('/api/notes').error(new ProgressEvent('error'), { status: 0 });
    await promise;
    expect(notifications.error).toHaveBeenCalledWith('Sin conexión con el servidor', expect.any(String));
  });

  it('leaves 4xx to the stores', async () => {
    await failWith(400);
    await failWith(404);
    expect(notifications.error).not.toHaveBeenCalled();
  });

  it('logs out on 401 outside the auth endpoints', async () => {
    await failWith(401);
    expect(logout).toHaveBeenCalled();
    expect(notifications.error).not.toHaveBeenCalled();
  });
});
