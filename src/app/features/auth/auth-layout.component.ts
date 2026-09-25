import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SynapLogoComponent } from '../../shared/components/synap-logo.component';

/** Shared frame for login, register and password recovery: brand on top, the form below. */
@Component({
  selector: 'app-auth-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [RouterOutlet, SynapLogoComponent],
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1.25rem;
      min-height: 100vh;
      min-height: 100dvh;
      padding: calc(1.5rem + env(safe-area-inset-top)) 0 calc(1.5rem + env(safe-area-inset-bottom));
      background: var(--synap-auth-bg);
    }

    .brand {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.6rem;
      text-align: center;
      padding: 0 1.5rem;
      animation: brandIn 0.35s ease-out;
    }

    @keyframes brandIn { from { opacity: 0; transform: translateY(-8px); } }

    .badge {
      display: grid;
      place-items: center;
      width: 64px;
      height: 64px;
      border-radius: 18px;
      background: var(--synap-brand-gradient);
      box-shadow: var(--synap-brand-glow);
    }

    h1 { margin: 0; font-size: 1.75rem; font-weight: 800; letter-spacing: -0.03em; color: var(--p-text-color); }
    p { margin: 0; max-width: 340px; font-size: 0.95rem; line-height: 1.45; color: var(--p-text-muted-color); }
  `],
  template: `
    <header class="brand">
      <div class="badge"><app-synap-logo [size]="38" /></div>
      <h1>Synap</h1>
      <p>Tu segundo cerebro: captura notas, código y enlaces, búscalos y pregúntales.</p>
    </header>
    <router-outlet />
  `,
})
export class AuthLayoutComponent {}
