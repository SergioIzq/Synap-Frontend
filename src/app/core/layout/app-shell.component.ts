import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { AuthStore } from '../stores/auth.store';

@Component({
  selector: 'app-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ButtonModule],
  styles: [`
    :host {
      display: flex;
      height: 100vh;
      overflow: hidden;
    }

    .sidebar {
      width: 220px;
      min-width: 220px;
      background: var(--p-surface-card);
      border-right: 1px solid var(--p-surface-border);
      display: flex;
      flex-direction: column;
      padding: 1.5rem 1rem;
      gap: 0.5rem;
    }

    .sidebar-brand {
      font-size: 1.4rem;
      font-weight: 700;
      color: var(--p-primary-color);
      margin-bottom: 1.5rem;
      padding: 0 0.5rem;
    }

    .nav-link {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.6rem 0.75rem;
      border-radius: var(--p-border-radius, 6px);
      color: var(--p-text-color);
      text-decoration: none;
      font-size: 0.95rem;
      transition: background 0.15s;

      &:hover {
        background: var(--p-surface-hover);
      }

      &.active {
        background: var(--p-primary-50, #eef2ff);
        color: var(--p-primary-color);
        font-weight: 600;
      }
    }

    .sidebar-spacer {
      flex: 1;
    }

    .content {
      flex: 1;
      overflow-y: auto;
      padding: 2rem;
    }
  `],
  template: `
    <aside class="sidebar">
      <div class="sidebar-brand">Synap</div>

      <a class="nav-link" routerLink="/app/notes" routerLinkActive="active">
        <i class="pi pi-book"></i>
        Notes
      </a>
      <a class="nav-link" routerLink="/app/assistant" routerLinkActive="active">
        <i class="pi pi-comments"></i>
        Assistant
      </a>

      <div class="sidebar-spacer"></div>

      <p-button
        label="Log out"
        icon="pi pi-sign-out"
        severity="secondary"
        [text]="true"
        size="small"
        (onClick)="logout()"
      />
    </aside>

    <main class="content">
      <router-outlet />
    </main>
  `,
})
export class AppShellComponent {
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  logout(): void {
    this.authStore.logout();
    void this.router.navigate(['/auth/login']);
  }
}
