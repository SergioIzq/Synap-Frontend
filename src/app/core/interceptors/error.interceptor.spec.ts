import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpErrorResponse, HttpInterceptorFn, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { firstValueFrom, throwError } from 'rxjs';
import { AuthStore } from '../stores/auth.store';
import { NotificationService } from '../services/notification.service';
import { errorInterceptor } from './error.interceptor';
import { isHandledGlobally } from '../utils/http-errors';

/** What HttpClient raises when a 200 response isn't JSON - e.g. index.html served for /api. */
const nonApiResponse = new HttpErrorResponse({
  status: 200,
  statusText: 'OK',
  url: '/api/notes',
  error: { error: new SyntaxError(`Unexpected token '<', "<!doctype "... is not valid JSON`), text: '<!doctype html>' },
});

/** Stands in for the backend, after errorInterceptor, failing with `nonApiResponse`. */
const htmlBackend: HttpInterceptorFn = () => throwError(() => nonApiResponse);

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

  it('shows one Spanish toast for a response that is not the API\'s JSON', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor, htmlBackend])),
        { provide: NotificationService, useValue: notifications },
        { provide: AuthStore, useValue: { logout } },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    });

    const error = await firstValueFrom(TestBed.inject(HttpClient).get('/api/notes')).catch((e: unknown) => e);

    expect(notifications.error).toHaveBeenCalledTimes(1);
    expect(notifications.error).toHaveBeenCalledWith('No se pudo contactar con el servidor', expect.any(String));
    expect(JSON.stringify(notifications.error.mock.calls)).not.toContain('Unexpected token');
    // Stores must not add a second toast for it.
    expect(isHandledGlobally(error)).toBe(true);
  });
});
