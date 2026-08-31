import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { AuthStore } from '../../../core/stores/auth.store';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <main class="auth-page">
      <h1>Log in to Synap</h1>

      <form [formGroup]="form" (ngSubmit)="submit()">
        <label>
          Email
          <input type="email" formControlName="email" autocomplete="email" />
        </label>

        <label>
          Password
          <input type="password" formControlName="password" autocomplete="current-password" />
        </label>

        @if (authStore.error()) {
          <p class="error" role="alert">{{ authStore.error() }}</p>
        }

        <button type="submit" [disabled]="form.invalid || authStore.loading()">
          {{ authStore.loading() ? 'Logging in...' : 'Log in' }}
        </button>
      </form>

      <p>No account yet? <a routerLink="/auth/register">Register</a></p>
    </main>
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
    if (this.form.invalid) {
      return;
    }

    try {
      await this.authStore.login(this.form.getRawValue());
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/';
      await this.router.navigateByUrl(returnUrl);
    } catch {
      // Error is already surfaced via authStore.error().
    }
  }
}
