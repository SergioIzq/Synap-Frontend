import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AuthService } from '../services/api/auth.service';
import { AuthStore } from './auth.store';

// header.payload.signature - only the payload matters here ({"sub":"user-123"}).
const TOKEN = `x.${btoa(JSON.stringify({ sub: 'user-123' })).replace(/=+$/, '')}.y`;

describe('AuthStore', () => {
  let store: AuthStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: { login: () => of({ token: TOKEN, expiresAt: '' }) } }],
    });
    store = TestBed.inject(AuthStore);
  });

  it('exposes the user id from the token', async () => {
    await store.login({ email: 'a@b.c', password: 'x' });
    expect(store.userId()).toBe('user-123');
  });

  it('logout() clears the session and every per-user cache, leaving other keys alone', async () => {
    await store.login({ email: 'a@b.c', password: 'x' });
    localStorage.setItem('synap.chat.user-123', '[]');
    localStorage.setItem('synap.chat.someone-else', '[]');
    localStorage.setItem('synap.theme', 'dark');

    store.logout();

    expect(store.userId()).toBeNull();
    expect(localStorage.getItem('synap.chat.user-123')).toBeNull();
    expect(localStorage.getItem('synap.chat.someone-else')).toBeNull();
    expect(localStorage.getItem('synap.theme')).toBe('dark');
  });

  it('adoptSession() switches to the new token without logging out', () => {
    const next = `x.${btoa(JSON.stringify({ sub: 'user-123' })).replace(/=+$/, '')}.z`;
    store.adoptSession(next);
    expect(store.token()).toBe(next);
    expect(localStorage.getItem('synap_token')).toBe(next);
  });
});
