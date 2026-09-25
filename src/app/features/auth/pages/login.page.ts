import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { AuthStore } from '../../../core/stores/auth.store';

@Component({
  selector: 'app-login-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    CardModule,
    InputTextModule,
    PasswordModule,
    ButtonModule,
    MessageModule,
  ],
  styles: [`
    :host {
      width: 100%;
      max-width: 400px;
      padding: 1rem;
      animation: cardIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes cardIn {
      from { opacity: 0; transform: translateY(16px) scale(0.98); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      margin-bottom: 1.25rem;

      label { font-size: 0.9rem; font-weight: 500; }

      p-inputtext, p-password { width: 100%; }

      :host ::ng-deep input { width: 100%; }
    }

    .forgot-link {
      align-self: flex-end;
      font-size: 0.825rem;
      margin-top: 0.15rem;
    }

    .footer-link {
      margin-top: 1rem;
      text-align: center;
      font-size: 0.9rem;
      color: var(--p-text-muted-color);
    }
  `],
  template: `
    <p-card header="Iniciar sesión en Synap">
      <form [formGroup]="form" (ngSubmit)="submit()">

        <div class="field">
          <label for="email">Email</label>
          <input
            pInputText
            id="email"
            type="email"
            formControlName="email"
            autocomplete="email"
            placeholder="tu@ejemplo.com"
          />
        </div>

        <div class="field">
          <label for="password">Contraseña</label>
          <p-password
            inputId="password"
            formControlName="password"
            [feedback]="false"
            [toggleMask]="true"
            autocomplete="current-password"
            placeholder="Tu contraseña"
            styleClass="w-full"
          />
          <a class="forgot-link" routerLink="/auth/forgot-password">¿Olvidaste tu contraseña?</a>
        </div>

        @if (authStore.error()) {
          <p-message severity="error" styleClass="w-full">{{ authStore.error() }}</p-message>
        }

        <p-button
          type="submit"
          [label]="authStore.loading() ? 'Iniciando sesión…' : 'Iniciar sesión'"
          icon="pi pi-sign-in"
          [loading]="authStore.loading()"
          [disabled]="form.invalid"
          styleClass="w-full"
        />
      </form>

      <div class="footer-link">
        ¿No tienes cuenta? <a routerLink="/auth/register">Regístrate</a>
      </div>
    </p-card>
  `,
})
export class LoginPage {
  protected readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly form = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  async submit(): Promise<void> {
    if (this.form.invalid) return;

    try {
      await this.authStore.login(this.form.getRawValue());
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/app';
      await this.router.navigateByUrl(returnUrl);
    } catch {
      // Error surfaced via authStore.error()
    }
  }
}
