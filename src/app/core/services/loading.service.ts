import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly loadingCount = signal(0);
  public readonly loading = signal(false);

  show(): void {
    this.loadingCount.update((count) => count + 1);
    this.loading.set(true);
  }

  hide(): void {
    this.loadingCount.update((count) => Math.max(0, count - 1));
    if (this.loadingCount() === 0) {
      this.loading.set(false);
    }
  }
}
