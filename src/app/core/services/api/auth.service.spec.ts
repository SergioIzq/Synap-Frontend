import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService } from './auth.service';

describe('AuthService (password recovery)', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('forgotPassword() posts the email', async () => {
    const promise = firstValueFrom(service.forgotPassword('a@b.c'));
    const req = http.expectOne({ method: 'POST', url: `${environment.apiUrl}/auth/forgot-password` });
    expect(req.request.body).toEqual({ email: 'a@b.c' });
    req.flush(null, { status: 204, statusText: 'No Content' });
    await promise;
  });

  it('resetPassword() posts token and new password', async () => {
    const promise = firstValueFrom(service.resetPassword('tok', 'NuevaClave1'));
    const req = http.expectOne({ method: 'POST', url: `${environment.apiUrl}/auth/reset-password` });
    expect(req.request.body).toEqual({ token: 'tok', newPassword: 'NuevaClave1' });
    req.flush(null, { status: 204, statusText: 'No Content' });
    await promise;
  });
});
