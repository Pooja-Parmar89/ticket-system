import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { errorMessage } from '../core/util';

const PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,64}$/;

@Component({
  selector: 'app-forgot-password',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="auth-wrap">
      <div class="auth-card">
        <h1>Reset password</h1>
        @if (error()) { <div class="alert alert-error">{{ error() }}</div> }
        @if (info()) { <div class="alert alert-success">{{ info() }}</div> }

        @if (step() === 'email') {
          <p class="muted">Enter your email and we will send you an OTP</p>
          <form [formGroup]="emailForm" (ngSubmit)="sendOtp()">
            <div class="field">
              <label for="email">Email</label>
              <input id="email" type="email" formControlName="email" />
              @if (emailForm.controls.email.touched && emailForm.controls.email.invalid) { <div class="field-error">Enter a valid email</div> }
            </div>
            <button class="btn btn-block" type="submit" [disabled]="loading()">Send OTP</button>
          </form>
        } @else {
          <form [formGroup]="resetForm" (ngSubmit)="reset()">
            <div class="field">
              <label for="otp">OTP</label>
              <input id="otp" formControlName="otp" maxlength="6" inputmode="numeric" />
              @if (resetForm.controls.otp.touched && resetForm.controls.otp.invalid) { <div class="field-error">Enter the 6 digit OTP</div> }
            </div>
            <div class="field">
              <label for="np">New password</label>
              <input id="np" type="password" formControlName="newPassword" autocomplete="new-password" />
              @if (resetForm.controls.newPassword.touched && resetForm.controls.newPassword.invalid) {
                <div class="field-error">8-64 characters with upper case, lower case and a digit</div>
              }
            </div>
            <button class="btn btn-block" type="submit" [disabled]="loading()">Change password</button>
          </form>
        }
        <div class="links"><a routerLink="/login">Back to login</a></div>
      </div>
    </div>
  `,
})
export class ForgotPassword {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly step = signal<'email' | 'reset'>('email');
  readonly loading = signal(false);
  readonly error = signal('');
  readonly info = signal('');

  readonly emailForm = this.fb.nonNullable.group({ email: ['', [Validators.required, Validators.email]] });
  readonly resetForm = this.fb.nonNullable.group({
    otp: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    newPassword: ['', [Validators.required, Validators.pattern(PASSWORD)]],
  });

  sendOtp(): void {
    if (this.emailForm.invalid) {
      this.emailForm.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.auth.forgotPassword(this.emailForm.getRawValue().email).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.info.set(res.message);
        this.step.set('reset');
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }

  reset(): void {
    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set('');
    const { otp, newPassword } = this.resetForm.getRawValue();
    this.auth.resetPassword(this.emailForm.getRawValue().email, otp, newPassword).subscribe({
      next: () => void this.router.navigate(['/login']),
      error: (err) => {
        this.loading.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }
}
