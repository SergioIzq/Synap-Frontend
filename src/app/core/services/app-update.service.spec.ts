import { DOCUMENT } from '@angular/common';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { AppUpdateService, FRESH_START_MS } from './app-update.service';

@Component({ template: '' })
class Blank {}

describe('AppUpdateService', () => {
  let versionUpdates: Subject<VersionEvent>;
  let unrecoverable: Subject<unknown>;
  let checkForUpdate: ReturnType<typeof vi.fn>;
  let reload: ReturnType<typeof vi.fn>;
  let assign: ReturnType<typeof vi.fn>;
  let visibility: DocumentVisibilityState;
  let router: Router;

  const ready = (): VersionEvent =>
    ({ type: 'VERSION_READY', currentVersion: { hash: 'a' }, latestVersion: { hash: 'b' } }) as VersionEvent;

  function setup(isEnabled = true): AppUpdateService {
    versionUpdates = new Subject();
    unrecoverable = new Subject();
    checkForUpdate = vi.fn(() => Promise.resolve(false));
    reload = vi.fn();
    assign = vi.fn();
    visibility = 'visible';

    const fakeDocument = {
      location: { reload, assign },
      get visibilityState() {
        return visibility;
      },
      addEventListener: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'app', component: Blank },
          { path: 'otra', component: Blank },
          { path: '**', component: Blank },
        ]),
        { provide: SwUpdate, useValue: { isEnabled, versionUpdates, unrecoverable, checkForUpdate } },
        { provide: DOCUMENT, useValue: fakeDocument },
      ],
    });
    router = TestBed.inject(Router);
    const service = TestBed.inject(AppUpdateService);
    service.start();
    return service;
  }

  afterEach(() => vi.useRealTimers());

  it('does nothing when the service worker is disabled (dev)', () => {
    setup(false);
    expect(checkForUpdate).not.toHaveBeenCalled();
  });

  it('checks for an update on start', () => {
    setup();
    expect(checkForUpdate).toHaveBeenCalled();
  });

  it('reloads immediately when the update arrives right after start-up', () => {
    setup();
    versionUpdates.next(ready());
    expect(reload).toHaveBeenCalled();
  });

  it('reloads immediately when the tab is hidden', () => {
    vi.useFakeTimers({ now: 0 });
    setup();
    vi.setSystemTime(FRESH_START_MS + 1);
    visibility = 'hidden';
    versionUpdates.next(ready());
    expect(reload).toHaveBeenCalled();
  });

  it('reloads immediately on the not-found page (an old app not knowing a new route)', async () => {
    vi.useFakeTimers({ now: 0 });
    setup();
    await router.navigateByUrl('/auth/reset-password?token=x');
    vi.setSystemTime(FRESH_START_MS + 1);
    versionUpdates.next(ready());
    expect(reload).toHaveBeenCalled();
  });

  it('otherwise waits and turns the next navigation into a full load', async () => {
    vi.useFakeTimers({ now: 0 });
    setup();
    await router.navigateByUrl('/app');
    vi.setSystemTime(FRESH_START_MS + 1);

    versionUpdates.next(ready());
    expect(reload).not.toHaveBeenCalled();

    void router.navigateByUrl('/otra');
    expect(assign).toHaveBeenCalledWith('/otra');
  });

  it('reloads when the cached app is unrecoverable', () => {
    setup();
    unrecoverable.next({});
    expect(reload).toHaveBeenCalled();
  });
});
