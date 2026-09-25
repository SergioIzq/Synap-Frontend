import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';

/** specs/web-experience "Unknown routes". Standalone, outside the app shell. */
@Component({
  selector: 'app-not-found-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [RouterLink, ButtonModule],
  styles: [`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      min-height: 100dvh;
      padding: 1.5rem;
      background: var(--synap-auth-bg);
    }

    .code {
      margin: 0;
      font-size: clamp(4rem, 18vw, 7rem);
      font-weight: 800;
      letter-spacing: -0.05em;
      line-height: 1;
      color: var(--p-primary-color);
    }

    h1 { margin: 0.75rem 0 0.5rem; font-size: 1.35rem; color: var(--p-text-color); }
    p { margin: 0 0 1.75rem; color: var(--p-text-muted-color); }
  `],
  template: `
    <main class="empty-block" style="padding: 0">
      <p class="code">404</p>
      <h1>Esta página no existe</h1>
      <p>Puede que el enlace esté mal escrito o que la página se haya movido.</p>
      <p-button label="Volver a tus notas" icon="pi pi-arrow-left" routerLink="/app/notes" />
    </main>
  `,
})
export class NotFoundPage {}
