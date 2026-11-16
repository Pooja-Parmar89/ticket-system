import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { errorMessage } from '../core/util';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="auth-wrap">
      <form class="auth-card" [formGroup]="form" (ngSubmit)="submit()">
        <h1>Welcome back</h1>
        <p class="muted">Login to the Complaint &amp; Ticket system</p>

        @if (error()) {
          <div class="alert alert-error">{{ error() }}
            @if (needsVerify()) { <br /><a [routerLink]="['/register']" [queryParams]="{ email: form.value.email }">Verify your email with OTP</a> }
          </div>
        }

        <div class="field">
          <label for="email">Email</label>
          <input id="email" type="email" formControlName="email" autocomplete="username" />
          @if (form.controls.email.touched && form.controls.email.invalid) {
            <div class="field-error">Enter a valid email</div>
          }
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input id="password" type="password" formControlName="password" autocomplete="current-password" />
          @if (form.controls.password.touched && form.controls.password.invalid) {
            <div class="field-error">Password is required</div>
          }
        </div>
        <button class="btn btn-block" type="submit" [disabled]="loading()">{{ loading() ? 'Please wait...' : 'Login' }}</button>

        <div class="links">
          <a routerLink="/forgot-password">Forgot password?</a>
          <a routerLink="/register">Create account</a>
        </div>
        <div class="hint">
          Demo logins (password <b>Admin&#64;123</b>):<br />
          admin&#64;ticketsystem.com &middot; employee1&#64;ticketsystem.com &middot; user&#64;ticketsystem.com
        </div>
      </form>
    </div>
  `,
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
  readonly loading = signal(false);
  readonly error = signal('');
  readonly needsVerify = signal(false);

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.needsVerify.set(false);
    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password).subscribe({
      next: () => void this.router.navigate(['/dashboard']),
      error: (err) => {
        this.loading.set(false);
        this.error.set(errorMessage(err));
        this.needsVerify.set(err?.status === 403);
      },
    });
  }
}
