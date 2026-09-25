import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { AuthService } from '../../../core/services/api/auth.service';
import { apiErrorMessage } from '../../../core/utils/http-errors';

/**
 * specs/identity "Password recovery by email" - step 1. The confirmation is the same whether
 * or not the email has an account, mirroring the API.
 */
@Component({
  selector: 'app-forgot-password-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ReactiveFormsModule, RouterLink, ButtonModule, CardModule, InputTextModule, MessageModule],
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

    .intro { margin: 0 0 1.25rem; color: var(--p-text-muted-color); font-size: 0.925rem; line-height: 1.5; }

    .field {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      margin-bottom: 1.25rem;

      label { font-size: 0.9rem; font-weight: 500; }
      input { width: 100%; }
    }

    .footer-link { margin-top: 1rem; text-align: center; font-size: 0.9rem; color: var(--p-text-muted-color); }
  `],
  template: `
    <p-card header="Recuperar contraseña">
      @if (sent()) {
        <p-message severity="success" styleClass="w-full">
          Si existe una cuenta con ese email, te hemos enviado un enlace para elegir una contraseña nueva.
          Revisa también la carpeta de spam. El enlace caduca en 1 hora.
        </p-message>
      } @else {
        <p class="intro">Escribe el email de tu cuenta y te enviaremos un enlace para restablecer la contraseña.</p>
        <form [formGroup]="form" (ngSubmit)="submit()">
          <div class="field">
            <label for="email">Email</label>
            <input pInputText id="email" type="email" formControlName="email" autocomplete="email" placeholder="tu@ejemplo.com" />
          </div>

          @if (error()) {
            <p-message severity="error" styleClass="w-full" style="display: block; margin-bottom: 1rem">{{ error() }}</p-message>
          }

          <p-button type="submit" label="Enviar enlace" icon="pi pi-envelope" [loading]="sending()" [disabled]="form.invalid" styleClass="w-full" />
        </form>
      }

      <div class="footer-link"><a routerLink="/auth/login">Volver a iniciar sesión</a></div>
    </p-card>
  `,
})
export class ForgotPasswordPage {
  private readonly authService = inject(AuthService);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly form = this.formBuilder.nonNullable.group({ email: ['', [Validators.required, Validators.email]] });
  protected readonly sending = signal(false);
  protected readonly sent = signal(false);
  protected readonly error = signal<string | null>(null);

  async submit(): Promise<void> {
    if (this.form.invalid) return;

    this.sending.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(this.authService.forgotPassword(this.form.getRawValue().email.trim()));
      this.sent.set(true);
    } catch (err) {
      // Only rate limiting or an outage can land here - never "unknown email".
      this.error.set(apiErrorMessage(err, 'No se pudo enviar el enlace. Inténtalo de nuevo en un momento.'));
    } finally {
      this.sending.set(false);
    }
  }
}
