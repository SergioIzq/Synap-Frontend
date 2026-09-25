import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AccountService } from './account.service';

describe('AccountService', () => {
  let service: AccountService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AccountService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('changePassword() PUTs both passwords', async () => {
    const promise = firstValueFrom(service.changePassword('vieja', 'nuevaClave'));
    const req = http.expectOne({ method: 'PUT', url: `${environment.apiUrl}/users/me/password` });
    expect(req.request.body).toEqual({ currentPassword: 'vieja', newPassword: 'nuevaClave' });
    req.flush({ isSuccess: true });
    await promise;
  });

  it('deleteAccount() sends the password in the DELETE body', async () => {
    const promise = firstValueFrom(service.deleteAccount('clave'));
    const req = http.expectOne({ method: 'DELETE', url: `${environment.apiUrl}/users/me` });
    expect(req.request.body).toEqual({ password: 'clave' });
    req.flush({ isSuccess: true });
    await promise;
  });
});
