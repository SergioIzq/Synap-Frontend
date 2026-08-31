import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthStore } from '../../../core/stores/auth.store';

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <main class="auth-page">
      <h1>Create your Synap account</h1>

      @if (registered()) {
        <p>Account created. <a routerLink="/auth/login">Log in</a> to continue.</p>
      } @else {
        <form [formGroup]="form" (ngSubmit)="submit()">
          <label>
            Email
            <input type="email" formControlName="email" autocomplete="email" />
          </label>

          <label>
            Password
            <input type="password" formControlName="password" autocomplete="new-password" />
          </label>

          @if (authStore.error()) {
            <p class="error" role="alert">{{ authStore.error() }}</p>
          }

          <button type="submit" [disabled]="form.invalid || authStore.loading()">
            {{ authStore.loading() ? 'Creating account...' : 'Create account' }}
          </button>
        </form>

        <p>Already have an account? <a routerLink="/auth/login">Log in</a></p>
      }
    </main>
  `,
})
export class RegisterPage {
  protected readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly registered = signal(false);

  protected readonly form = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  async submit(): Promise<void> {
    if (this.form.invalid) {
      return;
    }

    try {
      await this.authStore.register(this.form.getRawValue());
      this.registered.set(true);
    } catch {
      // Error is already surfaced via authStore.error().
    }
  }
}
