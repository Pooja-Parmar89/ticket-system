import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { errorMessage } from '../core/util';

const PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,64}$/;

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="auth-wrap">
      <div class="auth-card">
        @if (step() === 'form') {
          <form [formGroup]="form" (ngSubmit)="register()">
            <h1>Create account</h1>
            <p class="muted">We will email an OTP to verify your address</p>
            @if (error()) { <div class="alert alert-error">{{ error() }}</div> }

            <div class="field">
              <label for="name">Full name</label>
              <input id="name" formControlName="fullName" />
              @if (form.controls.fullName.touched && form.controls.fullName.invalid) { <div class="field-error">Name is required</div> }
            </div>
            <div class="field">
              <label for="email">Email</label>
              <input id="email" type="email" formControlName="email" />
              @if (form.controls.email.touched && form.controls.email.invalid) { <div class="field-error">Enter a valid email</div> }
            </div>
            <div class="field">
              <label for="password">Password</label>
              <input id="password" type="password" formControlName="password" autocomplete="new-password" />
              @if (form.controls.password.touched && form.controls.password.invalid) {
                <div class="field-error">8-64 characters with upper case, lower case and a digit</div>
              }
            </div>
            <div class="field">
              <label for="confirm">Confirm password</label>
              <input id="confirm" type="password" formControlName="confirm" autocomplete="new-password" />
              @if (form.controls.confirm.touched && form.value.confirm !== form.value.password) {
                <div class="field-error">Passwords do not match</div>
              }
            </div>
            <button class="btn btn-block" type="submit" [disabled]="loading()">{{ loading() ? 'Please wait...' : 'Register' }}</button>
            <div class="links"><a routerLink="/login">Already have an account?</a></div>
          </form>
        } @else {
          <form [formGroup]="otpForm" (ngSubmit)="verify()">
            <h1>Verify email</h1>
            <p class="muted">Enter the 6 digit OTP sent to <b>{{ email() }}</b></p>
            @if (error()) { <div class="alert alert-error">{{ error() }}</div> }
            @if (info()) { <div class="alert alert-success">{{ info() }}</div> }

            <div class="field">
              <label for="otp">OTP</label>
              <input id="otp" formControlName="otp" maxlength="6" inputmode="numeric" autocomplete="one-time-code" />
              @if (otpForm.controls.otp.touched && otpForm.controls.otp.invalid) { <div class="field-error">Enter the 6 digit OTP</div> }
            </div>
            <button class="btn btn-block" type="submit" [disabled]="loading()">Verify</button>
            <div class="links">
              <button class="btn btn-light btn-sm" type="button" [disabled]="cooldown() > 0" (click)="resend()">
                {{ cooldown() > 0 ? 'Resend in ' + cooldown() + 's' : 'Resend OTP' }}
              </button>
              <a routerLink="/login">Back to login</a>
            </div>
          </form>
        }
      </div>
    </div>
  `,
})
export class Register {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly step = signal<'form' | 'otp'>('form');
  readonly email = signal('');
  readonly loading = signal(false);
  readonly error = signal('');
  readonly info = signal('');
  readonly cooldown = signal(0);

  readonly form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.pattern(PASSWORD)]],
    confirm: ['', Validators.required],
  });
  readonly otpForm = this.fb.nonNullable.group({
    otp: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });

  constructor() {
    // coming from the login page ("Verify your email") -> go straight to the OTP step
    const email = this.route.snapshot.queryParamMap.get('email');
    if (email) {
      this.email.set(email);
      this.step.set('otp');
      this.info.set('Enter the OTP, or press Resend OTP to get a new one');
    }
    const timer = setInterval(() => this.cooldown.update((c) => (c > 0 ? c - 1 : 0)), 1000);
    this.destroyRef.onDestroy(() => clearInterval(timer));
  }

  register(): void {
    if (this.form.invalid || this.form.value.password !== this.form.value.confirm) {
      this.form.markAllAsTouched();
      return;
    }
    const { fullName, email, password } = this.form.getRawValue();
    this.loading.set(true);
    this.error.set('');
    this.auth.register(fullName, email, password).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.email.set(email);
        this.info.set(res.message);
        this.cooldown.set(30);
        this.step.set('otp');
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }

  verify(): void {
    if (this.otpForm.invalid) {
      this.otpForm.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.auth.verifyOtp(this.email(), this.otpForm.getRawValue().otp).subscribe({
      next: () => void this.router.navigate(['/login']),
      error: (err) => {
        this.loading.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }

  resend(): void {
    this.error.set('');
    this.auth.resendOtp(this.email()).subscribe({
      next: (res) => {
        this.info.set(res.message);
        this.cooldown.set(30);
      },
      error: (err) => this.error.set(errorMessage(err)),
    });
  }
}
