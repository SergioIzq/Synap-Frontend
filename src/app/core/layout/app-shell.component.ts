import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { AuthStore } from '../stores/auth.store';
import { routeAnimations } from '../animations/route.animations';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

/**
 * Both navigations are always rendered and CSS picks one at the 768px breakpoint
 * (mobile-and-ux-polish design.md Decision 1) - no BreakpointObserver, so there's no
 * layout flash while Angular boots.
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [NgTemplateOutlet, RouterOutlet, RouterLink, RouterLinkActive, ButtonModule],
  animations: [routeAnimations],
  styles: [`
    :host {
      display: flex;
      height: 100vh;
      height: 100dvh;
      overflow: hidden;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 0.625rem;

      span {
        font-size: 1.25rem;
        font-weight: 700;
        letter-spacing: -0.025em;
        color: var(--synap-sidebar-brand);
        line-height: 1;
      }
    }

    /* ─── Desktop sidebar ─── */
    .sidebar {
      width: 220px;
      min-width: 220px;
      background: var(--synap-sidebar-bg);
      box-shadow: var(--synap-sidebar-shadow);
      display: flex;
      flex-direction: column;
      padding: 1.5rem 1rem;
      gap: 0.5rem;

      .brand { margin: 0 0.25rem 1.5rem; }
    }

    .nav-link {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.6rem 0.75rem;
      border-radius: var(--p-border-radius, 6px);
      color: var(--synap-nav-text);
      text-decoration: none;
      font-size: 0.95rem;
      transition: background 0.15s, color 0.15s;

      &:hover { background: var(--synap-nav-hover-bg); color: var(--synap-nav-text-active); }
      &.active { background: var(--synap-nav-active-bg); color: var(--synap-nav-text-active); font-weight: 600; }
    }

    .sidebar-spacer { flex: 1; }

    /* ─── Mobile header + bottom nav ─── */
    .mobile-header, .bottom-nav { display: none; }

    .content {
      flex: 1;
      overflow-y: auto;
      padding: 2rem;
      scroll-behavior: smooth;
      position: relative;
    }

    .route-wrapper { position: relative; }

    @media (max-width: 767px) {
      :host { flex-direction: column; }

      .sidebar { display: none; }

      .mobile-header {
        display: flex;
        align-items: center;
        flex-shrink: 0;
        height: calc(var(--synap-mobile-header-h) + env(safe-area-inset-top));
        padding: env(safe-area-inset-top) 1rem 0;
        background: var(--synap-sidebar-bg);
        .brand span { font-size: 1.1rem; }
      }

      .content {
        padding: 1.25rem 1rem calc(var(--synap-bottom-nav-h) + env(safe-area-inset-bottom) + 1.25rem);
      }

      .bottom-nav {
        display: flex;
        position: fixed;
        inset: auto 0 0 0;
        z-index: 100;
        height: calc(var(--synap-bottom-nav-h) + env(safe-area-inset-bottom));
        padding-bottom: env(safe-area-inset-bottom);
        background: var(--synap-mobile-bar-bg);
        backdrop-filter: blur(12px);
        border-top: 1px solid var(--synap-mobile-bar-border);
      }

      .bottom-link {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.25rem;
        color: var(--synap-mobile-nav-text);
        text-decoration: none;
        font-size: 0.7rem;
        font-weight: 500;
        -webkit-tap-highlight-color: transparent;

        i { font-size: 1.2rem; }
        &.active { color: var(--synap-mobile-nav-active); font-weight: 700; }
      }
    }
  `],
  template: `
    <ng-template #logo>
      <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <line x1="16" y1="16" x2="16"    y2="6"  stroke="rgba(255,255,255,0.38)" stroke-width="1.75" stroke-linecap="round"/>
        <line x1="16" y1="16" x2="24.66" y2="21" stroke="rgba(255,255,255,0.38)" stroke-width="1.75" stroke-linecap="round"/>
        <line x1="16" y1="16" x2="7.34"  y2="21" stroke="rgba(255,255,255,0.38)" stroke-width="1.75" stroke-linecap="round"/>
        <circle cx="16"    cy="6"  r="2.5" fill="rgba(255,255,255,0.65)"/>
        <circle cx="24.66" cy="21" r="2.5" fill="rgba(255,255,255,0.65)"/>
        <circle cx="7.34"  cy="21" r="2.5" fill="rgba(255,255,255,0.65)"/>
        <circle cx="16"    cy="16" r="5"   fill="white"/>
      </svg>
    </ng-template>

    <aside class="sidebar">
      <div class="brand">
        <ng-container [ngTemplateOutlet]="logo" />
        <span>Synap</span>
      </div>

      @for (item of mainNav; track item.path) {
        <a class="nav-link" [routerLink]="item.path" routerLinkActive="active">
          <i [class]="item.icon"></i>
          {{ item.label }}
        </a>
      }

      <div class="sidebar-spacer"></div>

      <a class="nav-link" [routerLink]="settingsNav.path" routerLinkActive="active">
        <i [class]="settingsNav.icon"></i>
        {{ settingsNav.label }}
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

    <header class="mobile-header">
      <div class="brand">
        <ng-container [ngTemplateOutlet]="logo" />
        <span>Synap</span>
      </div>
    </header>

    <main class="content">
      <div class="route-wrapper" [@routeAnimation]="routeState">
        <router-outlet (activate)="onActivate()" />
      </div>
    </main>

    <nav class="bottom-nav" aria-label="Navegación principal">
      @for (item of allNav; track item.path) {
        <a class="bottom-link" [routerLink]="item.path" routerLinkActive="active">
          <i [class]="item.icon"></i>
          {{ item.label }}
        </a>
      }
    </nav>
  `,
})
export class AppShellComponent {
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  protected readonly mainNav: NavItem[] = [
    { path: '/app/notes', label: 'Notas', icon: 'pi pi-book' },
    { path: '/app/assistant', label: 'Asistente', icon: 'pi pi-comments' },
  ];
  protected readonly settingsNav: NavItem = { path: '/app/settings', label: 'Configuración', icon: 'pi pi-cog' };
  protected readonly allNav: NavItem[] = [...this.mainNav, this.settingsNav];

  protected routeState = 0;

  protected onActivate(): void {
    this.routeState++;
  }

  logout(): void {
    this.authStore.logout();
    void this.router.navigate(['/auth/login']);
  }
}
