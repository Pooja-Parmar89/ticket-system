import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { Role, User } from '../core/models';
import { errorMessage } from '../core/util';

const PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,64}$/;

@Component({
  selector: 'app-admin-users',
  imports: [ReactiveFormsModule, DatePipe],
  template: `
    <div class="page-head"><div><h1>Users</h1><span class="muted">Create support employees and manage accounts</span></div></div>

    @if (error()) { <div class="alert alert-error">{{ error() }}</div> }
    @if (info()) { <div class="alert alert-success">{{ info() }}</div> }

    <form class="card" [formGroup]="form" (ngSubmit)="create()">
      <h2>Create user</h2>
      <div class="row">
        <div class="field"><label for="n">Full name</label><input id="n" formControlName="fullName" /></div>
        <div class="field"><label for="e">Email</label><input id="e" type="email" formControlName="email" /></div>
        <div class="field"><label for="p">Password</label><input id="p" type="password" formControlName="password" autocomplete="new-password" /></div>
        <div class="field">
          <label for="r">Role</label>
          <select id="r" formControlName="role">
            <option value="EMPLOYEE">EMPLOYEE</option>
            <option value="USER">USER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
        </div>
        <button class="btn" type="submit" [disabled]="form.invalid">Create</button>
      </div>
      @if (form.controls.password.dirty && form.controls.password.invalid) {
        <div class="field-error">Password: 8-64 characters with upper case, lower case and a digit</div>
      }
    </form>

    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Verified</th><th>Status</th><th>Created</th><th></th></tr></thead>
          <tbody>
            @for (u of users(); track u.id) {
              <tr>
                <td><b>{{ u.fullName }}</b></td>
                <td>{{ u.email }}</td>
                <td><span class="badge role-badge">{{ u.role }}</span></td>
                <td><span [class]="'badge ' + (u.emailVerified ? 'ok' : 'bad')">{{ u.emailVerified ? 'YES' : 'NO' }}</span></td>
                <td><span [class]="'badge ' + (u.active ? 'ok' : 'bad')">{{ u.active ? 'ACTIVE' : 'DISABLED' }}</span></td>
                <td class="muted">{{ u.createdAt | date: 'dd MMM yyyy' }}</td>
                <td>
                  @if (u.id !== auth.user()?.id) {
                    <button class="btn btn-sm" [class.btn-danger]="u.active" type="button" (click)="toggle(u)">
                      {{ u.active ? 'Disable' : 'Enable' }}
                    </button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class AdminUsers implements OnInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  readonly auth = inject(AuthService);

  readonly users = signal<User[]>([]);
  readonly error = signal('');
  readonly info = signal('');

  readonly form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.pattern(PASSWORD)]],
    role: ['EMPLOYEE' as Role, Validators.required],
  });

  ngOnInit(): void {
    this.load();
  }

  create(): void {
    if (this.form.invalid) return;
    this.error.set('');
    this.api.createUser(this.form.getRawValue()).subscribe({
      next: (u) => {
        this.info.set(`${u.role} account created for ${u.email}`);
        this.form.reset({ fullName: '', email: '', password: '', role: 'EMPLOYEE' });
        this.load();
      },
      error: (err) => {
        this.info.set('');
        this.error.set(errorMessage(err));
      },
    });
  }

  toggle(user: User): void {
    this.error.set('');
    this.api.setActive(user.id, !user.active).subscribe({
      next: () => this.load(),
      error: (err) => this.error.set(errorMessage(err)),
    });
  }

  private load(): void {
    this.api.users().subscribe({
      next: (list) => this.users.set(list),
      error: (err) => this.error.set(errorMessage(err)),
    });
  }
}
