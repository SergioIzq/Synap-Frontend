import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { MessageModule } from 'primeng/message';
import { PasswordModule } from 'primeng/password';
import { AccountService } from '../../../core/services/api/account.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthStore } from '../../../core/stores/auth.store';
import { apiErrorMessage } from '../../../core/utils/http-errors';

/** Same bounds as the backend's PasswordPolicy. */
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const { newPassword, repeatPassword } = group.getRawValue();
  return repeatPassword && newPassword !== repeatPassword ? { mismatch: true } : null;
}

/**
 * Settings > Cuenta: email, logout, change password and the danger zone (backend-hardening
 * tasks 6.4/6.5, specs/identity "Change password" and "Delete account").
 */
@Component({
  selector: 'app-account-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ReactiveFormsModule, ButtonModule, DialogModule, MessageModule, PasswordModule],
  styles: [`
    .row {
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.25rem 1rem;
      font-size: 0.925rem;
      margin-bottom: 1.25rem;

      .muted { color: var(--p-text-muted-color); }
      .email { overflow-wrap: anywhere; }
    }

    h4 { margin: 1.75rem 0 0.75rem; font-size: 0.95rem; }

    .password-form {
      display: grid;
      gap: 0.75rem;
      max-width: 420px;
    }

    .danger {
      margin-top: 1.75rem;
      padding: 1rem;
      border: 1px solid color-mix(in srgb, var(--p-red-500) 40%, transparent);
      border-radius: var(--p-border-radius, 6px);

      h4 { margin: 0 0 0.35rem; color: var(--p-red-500); }
      p { margin: 0 0 0.9rem; font-size: 0.875rem; color: var(--p-text-muted-color); line-height: 1.5; }
    }

    .dialog-body p { margin: 0 0 1rem; line-height: 1.5; }
    .dialog-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1.25rem; }
  `],
  template: `
    <div class="row">
      <span class="muted">Correo electrónico</span>
      <span class="email">{{ email() }}</span>
    </div>
    <p-button label="Cerrar sesión" icon="pi pi-sign-out" severity="secondary" [outlined]="true" (onClick)="logout()" />

    <h4>Cambiar contraseña</h4>
    <!-- Re-created after a successful change: p-password keeps showing typed text after a form
         reset(), because its bound value ('') never changed from Angular's point of view. -->
    @for (key of [passwordFormKey()]; track key) {
    <form class="password-form" [formGroup]="passwordForm" (ngSubmit)="changePassword()">
      <p-password formControlName="currentPassword" [feedback]="false" [toggleMask]="true" placeholder="Contraseña actual"
        autocomplete="current-password" [fluid]="true" ariaLabel="Contraseña actual" />
      <p-password formControlName="newPassword" [feedback]="false" [toggleMask]="true" placeholder="Nueva contraseña (mín. 8 caracteres)"
        autocomplete="new-password" [fluid]="true" ariaLabel="Nueva contraseña" />
      <p-password formControlName="repeatPassword" [feedback]="false" [toggleMask]="true" placeholder="Repite la nueva contraseña"
        autocomplete="new-password" [fluid]="true" ariaLabel="Repite la nueva contraseña" />

      @if (passwordForm.hasError('mismatch')) {
        <p-message severity="warn" size="small">Las contraseñas nuevas no coinciden.</p-message>
      } @else if (passwordForm.controls.newPassword.dirty && passwordForm.controls.newPassword.invalid) {
        <p-message severity="warn" size="small">La contraseña debe tener entre 8 y 128 caracteres.</p-message>
      }
      @if (passwordError()) {
        <p-message severity="error" size="small">{{ passwordError() }}</p-message>
      }

      <div>
        <p-button type="submit" label="Cambiar contraseña" icon="pi pi-lock" [disabled]="passwordForm.invalid" [loading]="changingPassword()" />
      </div>
    </form>
    }

    <div class="danger">
      <h4>Eliminar cuenta</h4>
      <p>Borra para siempre tu cuenta, todas tus notas, etiquetas, tu API key de Groq y el token del Atajo de iOS. No se puede deshacer.</p>
      <p-button label="Eliminar cuenta" icon="pi pi-trash" severity="danger" [outlined]="true" (onClick)="openDeleteDialog()" />
    </div>

    <p-dialog
      header="Eliminar cuenta"
      [modal]="true"
      [(visible)]="deleteDialogVisible"
      [style]="{ width: 'min(440px, calc(100vw - 2rem))' }"
      [draggable]="false"
    >
      <form class="dialog-body" [formGroup]="deleteForm" (ngSubmit)="deleteAccount()">
        <p>Esta acción es <strong>irreversible</strong>. Escribe tu contraseña para confirmar.</p>
        <p-password formControlName="password" [feedback]="false" [toggleMask]="true" placeholder="Tu contraseña"
          autocomplete="current-password" [fluid]="true" ariaLabel="Contraseña para confirmar" />
        @if (deleteError()) {
          <p-message severity="error" size="small" style="margin-top: 0.75rem; display: block">{{ deleteError() }}</p-message>
        }
        <div class="dialog-actions">
          <p-button type="button" label="Cancelar" severity="secondary" [text]="true" (onClick)="deleteDialogVisible = false" />
          <p-button type="submit" label="Eliminar definitivamente" icon="pi pi-trash" severity="danger"
            [disabled]="deleteForm.invalid" [loading]="deleting()" />
        </div>
      </form>
    </p-dialog>
  `,
})
export class AccountSettingsComponent {
  readonly email = input.required<string>();

  private readonly accountService = inject(AccountService);
  private readonly authStore = inject(AuthStore);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly passwordForm = this.formBuilder.nonNullable.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(PASSWORD_MIN), Validators.maxLength(PASSWORD_MAX)]],
      repeatPassword: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );
  protected readonly passwordFormKey = signal(0);
  protected readonly changingPassword = signal(false);
  protected readonly passwordError = signal<string | null>(null);

  protected readonly deleteForm = this.formBuilder.nonNullable.group({ password: ['', Validators.required] });
  protected deleteDialogVisible = false;
  protected readonly deleting = signal(false);
  protected readonly deleteError = signal<string | null>(null);

  protected logout(): void {
    this.authStore.logout();
    void this.router.navigate(['/auth/login']);
  }

  async changePassword(): Promise<void> {
    if (this.passwordForm.invalid) return;

    const { currentPassword, newPassword } = this.passwordForm.getRawValue();
    this.passwordError.set(null);
    this.changingPassword.set(true);
    try {
      await firstValueFrom(this.accountService.changePassword(currentPassword, newPassword));
      this.passwordForm.reset();
      this.passwordFormKey.update((key) => key + 1);
      this.notifications.success('Contraseña actualizada');
    } catch (err) {
      this.passwordError.set(apiErrorMessage(err, 'No se pudo cambiar la contraseña.'));
    } finally {
      this.changingPassword.set(false);
    }
  }

  protected openDeleteDialog(): void {
    this.deleteForm.reset();
    this.deleteError.set(null);
    this.deleteDialogVisible = true;
  }

  async deleteAccount(): Promise<void> {
    if (this.deleteForm.invalid) return;
    const { password } = this.deleteForm.getRawValue();

    this.deleteError.set(null);
    this.deleting.set(true);
    try {
      await firstValueFrom(this.accountService.deleteAccount(password));
      this.deleteDialogVisible = false;
      this.authStore.logout();
      await this.router.navigate(['/auth/login']);
      this.notifications.success('Cuenta eliminada', 'Tus datos se han borrado.');
    } catch (err) {
      this.deleteError.set(apiErrorMessage(err, 'No se pudo eliminar la cuenta.'));
    } finally {
      this.deleting.set(false);
    }
  }
}
