import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { AuthStore } from '../../../core/stores/auth.store';

@Component({
  selector: 'app-register-page',
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

      :host ::ng-deep input { width: 100%; }
    }

    .footer-link {
      margin-top: 1rem;
      text-align: center;
      font-size: 0.9rem;
      color: var(--p-text-muted-color);
    }
  `],
  template: `
    <p-card header="Crear cuenta">
      @if (registered()) {
        <p-message severity="success" styleClass="w-full">¡Cuenta creada!</p-message>
        <div class="footer-link" style="margin-top: 1rem">
          <a routerLink="/auth/login">Iniciar sesión para continuar →</a>
        </div>
      } @else {
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
              [toggleMask]="true"
              autocomplete="new-password"
              placeholder="Al menos 8 caracteres"
              styleClass="w-full"
            [fluid]="true"
            />
          </div>

          @if (authStore.error()) {
            <p-message severity="error" styleClass="w-full">{{ authStore.error() }}</p-message>
          }

          <p-button
            type="submit"
            [label]="authStore.loading() ? 'Creando cuenta…' : 'Crear cuenta'"
            icon="pi pi-user-plus"
            [loading]="authStore.loading()"
            [disabled]="form.invalid"
            styleClass="w-full"
          />
        </form>

        <div class="footer-link">
          ¿Ya tienes cuenta? <a routerLink="/auth/login">Iniciar sesión</a>
        </div>
      }
    </p-card>
  `,
})
export class RegisterPage {
  protected readonly authStore = inject(AuthStore);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly registered = signal(false);

  protected readonly form = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  async submit(): Promise<void> {
    if (this.form.invalid) return;

    try {
      await this.authStore.register(this.form.getRawValue());
      this.registered.set(true);
    } catch {
      // Error surfaced via authStore.error()
    }
  }
}
