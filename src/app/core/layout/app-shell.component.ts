import { ChangeDetectionStrategy, Component, HostListener, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { AuthStore } from '../stores/auth.store';
import { routeAnimations } from '../animations/route.animations';
import { SynapLogoComponent } from '../../shared/components/synap-logo.component';

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
  imports: [SynapLogoComponent, RouterOutlet, RouterLink, RouterLinkActive, ButtonModule],
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

    <aside class="sidebar">
      <div class="brand">
        <app-synap-logo />
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
        <app-synap-logo />
        <span>Synap</span>
      </div>
    </header>

    <main class="content">
      <div class="route-wrapper" [@routeAnimation]="routeKey()">
        <router-outlet />
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

  /**
   * Animation state = the current path, updated on NavigationEnd (outside change detection).
   * Reading it from the outlet during the check - or bumping a counter in (activate) - changed
   * the bound value mid-check on first load (NG0100 in dev mode). Starts at the navigation in
   * progress so the first page doesn't animate.
   */
  protected readonly routeKey = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => pathOf(event.urlAfterRedirects)),
    ),
    { initialValue: pathOf(this.router.getCurrentNavigation()?.finalUrl?.toString() ?? this.router.url) },
  );

  /**
   * "n" opens the note composer from any page (specs/web-experience "Keyboard shortcut to
   * create a note") - never while the user is typing in a field.
   */
  @HostListener('document:keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'n' || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;

    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return;

    event.preventDefault();
    void this.router.navigate(['/app/notes'], { queryParams: { compose: 1 } });
  }

  logout(): void {
    this.authStore.logout();
    void this.router.navigate(['/auth/login']);
  }
}

function pathOf(url: string): string {
  return url.split(/[?#]/)[0];
}
