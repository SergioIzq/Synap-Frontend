import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { AuthStore } from '../stores/auth.store';
import { routeAnimations } from '../animations/route.animations';

@Component({
  selector: 'app-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ButtonModule, ToastModule, ConfirmDialogModule],
  animations: [routeAnimations],
  styles: [`
    :host {
      display: flex;
      height: 100vh;
      overflow: hidden;
    }

    .sidebar {
      width: 220px;
      min-width: 220px;
      background: linear-gradient(160deg, #1e1b4b 0%, #312e81 100%);
      box-shadow: 4px 0 24px rgba(0, 0, 0, 0.25);
      display: flex;
      flex-direction: column;
      padding: 1.5rem 1rem;
      gap: 0.5rem;
    }

    .sidebar-brand {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      margin-bottom: 1.5rem;
      padding: 0 0.25rem;
    }

    .sidebar-brand-name {
      font-size: 1.25rem;
      font-weight: 700;
      letter-spacing: -0.025em;
      color: #e0e7ff;
      line-height: 1;
    }

    .nav-link {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.6rem 0.75rem;
      border-radius: var(--p-border-radius, 6px);
      color: rgba(255, 255, 255, 0.7);
      text-decoration: none;
      font-size: 0.95rem;
      transition: background 0.15s, color 0.15s;

      &:hover {
        background: rgba(255, 255, 255, 0.08);
        color: #ffffff;
      }

      &.active {
        background: rgba(255, 255, 255, 0.12);
        color: #ffffff;
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
      scroll-behavior: smooth;
      position: relative;
    }

    .route-wrapper {
      position: relative;
    }
  `],
  template: `
    <aside class="sidebar">
      <div class="sidebar-brand">
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <line x1="16" y1="16" x2="16"    y2="6"  stroke="rgba(255,255,255,0.38)" stroke-width="1.75" stroke-linecap="round"/>
          <line x1="16" y1="16" x2="24.66" y2="21" stroke="rgba(255,255,255,0.38)" stroke-width="1.75" stroke-linecap="round"/>
          <line x1="16" y1="16" x2="7.34"  y2="21" stroke="rgba(255,255,255,0.38)" stroke-width="1.75" stroke-linecap="round"/>
          <circle cx="16"    cy="6"  r="2.5" fill="rgba(255,255,255,0.65)"/>
          <circle cx="24.66" cy="21" r="2.5" fill="rgba(255,255,255,0.65)"/>
          <circle cx="7.34"  cy="21" r="2.5" fill="rgba(255,255,255,0.65)"/>
          <circle cx="16"    cy="16" r="5"   fill="white"/>
        </svg>
        <span class="sidebar-brand-name">Synap</span>
      </div>

      <a class="nav-link" routerLink="/app/notes" routerLinkActive="active">
        <i class="pi pi-book"></i>
        Notas
      </a>
      <a class="nav-link" routerLink="/app/assistant" routerLinkActive="active">
        <i class="pi pi-comments"></i>
        Asistente
      </a>

      <div class="sidebar-spacer"></div>

      <a class="nav-link" routerLink="/app/settings" routerLinkActive="active">
        <i class="pi pi-cog"></i>
        Configuración
      </a>

      <p-button
        label="Cerrar sesión"
        icon="pi pi-sign-out"
        severity="secondary"
        [text]="true"
        size="small"
        (onClick)="logout()"
        styleClass="logout-btn"
      />
    </aside>

    <p-toast position="top-right" />
    <p-confirmdialog />

    <main class="content">
      <div class="route-wrapper" [@routeAnimation]="routeState">
        <router-outlet (activate)="onActivate()" />
      </div>
    </main>
  `,
})
export class AppShellComponent {
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  protected routeState = 0;

  protected onActivate(): void {
    this.routeState++;
  }

  logout(): void {
    this.authStore.logout();
    void this.router.navigate(['/auth/login']);
  }
}
