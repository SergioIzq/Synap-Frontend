import { Injectable, inject } from '@angular/core';
import { MessageService } from 'primeng/api';

export const SUCCESS_LIFE_MS = 3000;
export const ERROR_LIFE_MS = 5000;

/**
 * Thin layer over PrimeNG's MessageService so every toast in the app has the same severity
 * wording and duration (mobile-and-ux-polish design.md Decision 3). Rendered by <p-toast> in
 * app-shell, which has preventDuplicates on - a burst of identical failures (e.g. the API going
 * down mid-page) shows one toast, not five.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly messageService = inject(MessageService);

  success(summary: string, detail?: string): void {
    this.messageService.add({ severity: 'success', summary, detail, life: SUCCESS_LIFE_MS });
  }

  error(summary: string, detail?: string): void {
    this.messageService.add({ severity: 'error', summary, detail, life: ERROR_LIFE_MS });
  }

  warn(summary: string, detail?: string): void {
    this.messageService.add({ severity: 'warn', summary, detail, life: ERROR_LIFE_MS });
  }
}
