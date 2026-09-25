import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { filter } from 'rxjs';

/** An update arriving this soon after start-up can't interrupt anything the user did yet. */
export const FRESH_START_MS = 10_000;

/**
 * Makes the PWA pick up new deployments by itself. The Angular service worker keeps serving
 * the cached (old) app and only swaps versions on a later load - so a link to a page the old
 * version doesn't know (e.g. /auth/reset-password right after a deploy) showed the app's 404.
 *
 * When a new version is ready it reloads right away only when that can't lose anything: the
 * tab is hidden, the app has just started, or it's showing the not-found page. Otherwise the
 * next in-app navigation becomes a full page load, so half-typed input is never discarded.
 */
@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  private readonly swUpdate = inject(SwUpdate);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);

  private readonly startedAt = Date.now();
  private updateReady = false;
  private onNotFoundPage = false;

  start(): void {
    if (!this.swUpdate.isEnabled) return;

    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => {
        this.onNotFoundPage = this.isNotFoundRoute();
        if (this.updateReady && this.onNotFoundPage) this.reload();
      });

    // Pending update: turn the next navigation into a full load of its target URL.
    this.router.events
      .pipe(filter((event): event is NavigationStart => event instanceof NavigationStart))
      .subscribe((event) => {
        if (this.updateReady) this.reload(event.url);
      });

    this.swUpdate.versionUpdates
      .pipe(filter((event) => event.type === 'VERSION_READY'))
      .subscribe(() => {
        this.updateReady = true;
        if (this.canReloadNow()) this.reload();
      });

    // The cached app is broken beyond repair (e.g. files evicted) - only a reload fixes it.
    this.swUpdate.unrecoverable.subscribe(() => this.reload());

    void this.check();
    this.document.addEventListener('visibilitychange', () => {
      if (this.document.visibilityState === 'visible') void this.check();
    });
  }

  private canReloadNow(): boolean {
    return (
      this.document.visibilityState === 'hidden' ||
      Date.now() - this.startedAt < FRESH_START_MS ||
      this.onNotFoundPage
    );
  }

  private async check(): Promise<void> {
    try {
      await this.swUpdate.checkForUpdate();
    } catch {
      // Offline or the server is unreachable - the service worker retries by itself later.
    }
  }

  private isNotFoundRoute(): boolean {
    let route = this.router.routerState.snapshot.root;
    while (route.firstChild) route = route.firstChild;
    return route.routeConfig?.path === '**';
  }

  private reload(url?: string): void {
    this.updateReady = false;
    const location = this.document.location;
    if (url) {
      location.assign(url);
    } else {
      location.reload();
    }
  }
}
