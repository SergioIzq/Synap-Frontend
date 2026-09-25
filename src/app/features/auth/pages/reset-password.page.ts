import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { PasswordModule } from 'primeng/password';
import { AuthService } from '../../../core/services/api/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthStore } from '../../../core/stores/auth.store';
import { apiErrorMessage } from '../../../core/utils/http-errors';

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const { password, repeat } = group.getRawValue();
  return repeat && password !== repeat ? { mismatch: true } : null;
}

/** specs/identity "Password recovery by email" - step 2, reached from the emailed link. */
@Component({
  selector: 'app-reset-password-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ReactiveFormsModule, RouterLink, ButtonModule, CardModule, MessageModule, PasswordModule],
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
    .fields { display: grid; gap: 0.75rem; margin-bottom: 1rem; }
    .footer-link { margin-top: 1rem; text-align: center; font-size: 0.9rem; color: var(--p-text-muted-color); }
  `],
  template: `
    <p-card header="Elegir contraseña nueva">
      @if (!token) {
        <p-message severity="error" styleClass="w-full">
          Falta el código del enlace. Abre el enlace completo del email o solicita uno nuevo.
        </p-message>
        <div class="footer-link"><a routerLink="/auth/forgot-password">Solicitar un enlace nuevo</a></div>
      } @else {
        <p class="intro">Al cambiarla se cerrará la sesión en todos tus dispositivos.</p>
        <form [formGroup]="form" (ngSubmit)="submit()">
          <div class="fields">
            <p-password formControlName="password" [feedback]="false" [toggleMask]="true" [fluid]="true"
              placeholder="Nueva contraseña (mín. 8 caracteres)" autocomplete="new-password" ariaLabel="Nueva contraseña" />
            <p-password formControlName="repeat" [feedback]="false" [toggleMask]="true" [fluid]="true"
              placeholder="Repite la contraseña" autocomplete="new-password" ariaLabel="Repite la contraseña" />
          </div>

          @if (form.hasError('mismatch')) {
            <p-message severity="warn" size="small" styleClass="w-full" style="display: block; margin-bottom: 1rem">Las contraseñas no coinciden.</p-message>
          } @else if (form.controls.password.dirty && form.controls.password.invalid) {
            <p-message severity="warn" size="small" styleClass="w-full" style="display: block; margin-bottom: 1rem">La contraseña debe tener entre 8 y 128 caracteres.</p-message>
          }
          @if (error()) {
            <p-message severity="error" styleClass="w-full" style="display: block; margin-bottom: 1rem">{{ error() }}</p-message>
          }

          <p-button type="submit" label="Guardar contraseña" icon="pi pi-lock" [loading]="saving()" [disabled]="form.invalid" styleClass="w-full" />
        </form>
        @if (linkInvalid()) {
          <div class="footer-link"><a routerLink="/auth/forgot-password">Solicitar un enlace nuevo</a></div>
        }
      }
    </p-card>
  `,
})
export class ResetPasswordPage {
  private readonly authService = inject(AuthService);
  private readonly authStore = inject(AuthStore);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get('token');

  protected readonly form = this.formBuilder.nonNullable.group(
    {
      password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]],
      repeat: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly linkInvalid = signal(false);

  async submit(): Promise<void> {
    if (!this.token || this.form.invalid) return;

    this.saving.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(this.authService.resetPassword(this.token, this.form.getRawValue().password));
      // Any session in this browser is dead now (security stamp rotated) - drop it too.
      this.authStore.logout();
      await this.router.navigate(['/auth/login']);
      this.notifications.success('Contraseña actualizada', 'Ya puedes iniciar sesión con la nueva.');
    } catch (err) {
      const message = apiErrorMessage(err, 'No se pudo cambiar la contraseña.');
      this.error.set(message);
      this.linkInvalid.set(message.includes('enlace'));
    } finally {
      this.saving.set(false);
    }
  }
}
