import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { API_URL } from './config';
import { AuthResponse, Message, Role, User } from './models';

const TOKEN_KEY = 'ts_token';
const USER_KEY = 'ts_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly currentUser = signal<User | null>(this.loadUser());
  readonly user = this.currentUser.asReadonly();
  readonly role = computed<Role | null>(() => this.currentUser()?.role ?? null);

  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  /** True only when a user is stored AND the JWT has not expired. */
  isLoggedIn(): boolean {
    const token = this.token;
    if (!token || !this.currentUser()) {
      return false;
    }
    if (this.isExpired(token)) {
      this.clear();
      return false;
    }
    return true;
  }

  login(email: string, password: string) {
    return this.http.post<AuthResponse>(`${API_URL}/auth/login`, { email, password }).pipe(
      tap((res) => {
        localStorage.setItem(TOKEN_KEY, res.token);
        localStorage.setItem(USER_KEY, JSON.stringify(res.user));
        this.currentUser.set(res.user);
      }),
    );
  }

  register(fullName: string, email: string, password: string) {
    return this.http.post<Message>(`${API_URL}/auth/register`, { fullName, email, password });
  }

  verifyOtp(email: string, otp: string) {
    return this.http.post<Message>(`${API_URL}/auth/verify-otp`, { email, otp });
  }

  resendOtp(email: string) {
    return this.http.post<Message>(`${API_URL}/auth/resend-otp`, { email });
  }

  forgotPassword(email: string) {
    return this.http.post<Message>(`${API_URL}/auth/forgot-password`, { email });
  }

  resetPassword(email: string, otp: string, newPassword: string) {
    return this.http.post<Message>(`${API_URL}/auth/reset-password`, { email, otp, newPassword });
  }

  logout(): void {
    this.clear();
    void this.router.navigate(['/login']);
  }

  private clear(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.currentUser.set(null);
  }

  private loadUser(): User | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  }

  private isExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return typeof payload.exp === 'number' && payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }
}
