import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { AuditLog } from '../core/models';
import { errorMessage } from '../core/util';
import { LabelPipe } from '../shared/label.pipe';
import { Pager } from '../shared/pager';

@Component({
  selector: 'app-audit-logs',
  imports: [ReactiveFormsModule, DatePipe, LabelPipe, Pager],
  template: `
    <div class="page-head"><div><h1>Audit logs</h1><span class="muted">Who did what, when and from which IP address</span></div></div>

    <form class="card row" [formGroup]="filters" (ngSubmit)="apply()">
      <div class="field">
        <label for="a">Action</label>
        <select id="a" formControlName="action">
          <option value="">All</option>
          @for (a of actions; track a) { <option [value]="a">{{ a | label }}</option> }
        </select>
      </div>
      <div class="field">
        <label for="e">Entity</label>
        <select id="e" formControlName="entityType">
          <option value="">All</option>
          <option value="TICKET">TICKET</option>
          <option value="USER">USER</option>
          <option value="REPORT">REPORT</option>
        </select>
      </div>
      <div class="field"><label for="u">User email</label><input id="u" formControlName="userEmail" /></div>
      <button class="btn" type="submit">Search</button>
    </form>

    @if (error()) { <div class="alert alert-error">{{ error() }}</div> }

    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Entity</th><th>Details</th><th>IP</th></tr></thead>
          <tbody>
            @for (l of logs(); track l.id) {
              <tr>
                <td class="muted" style="white-space: nowrap">{{ l.createdAt | date: 'dd MMM yyyy, HH:mm:ss' }}</td>
                <td>{{ l.userEmail ?? '-' }}</td>
                <td><span class="badge role-badge">{{ l.action | label }}</span></td>
                <td>{{ l.entityType }}{{ l.entityId ? ' #' + l.entityId : '' }}</td>
                <td>{{ l.details }}</td>
                <td class="muted">{{ l.ipAddress ?? '-' }}</td>
              </tr>
            } @empty { <tr><td colspan="6" class="muted">No audit records.</td></tr> }
          </tbody>
        </table>
      </div>
      <app-pager [page]="page()" [totalPages]="totalPages()" [totalElements]="total()" (pageChange)="goTo($event)" />
    </div>
  `,
})
export class AuditLogs implements OnInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);

  readonly actions = [
    'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGIN_BLOCKED', 'USER_REGISTERED', 'EMAIL_VERIFIED',
    'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET', 'USER_CREATED', 'USER_ENABLED', 'USER_DISABLED',
    'TICKET_CREATED', 'TICKET_ASSIGNED', 'TICKET_REASSIGNED', 'TICKET_STATUS_CHANGED',
    'COMMENT_ADDED', 'ATTACHMENT_ADDED', 'ATTACHMENT_DOWNLOADED', 'REPORT_EXPORTED',
  ];
  readonly filters = this.fb.nonNullable.group({ action: '', entityType: '', userEmail: '' });
  readonly logs = signal<AuditLog[]>([]);
  readonly page = signal(0);
  readonly totalPages = signal(0);
  readonly total = signal(0);
  readonly error = signal('');

  ngOnInit(): void {
    this.load();
  }

  apply(): void {
    this.page.set(0);
    this.load();
  }

  goTo(page: number): void {
    this.page.set(page);
    this.load();
  }

  private load(): void {
    this.error.set('');
    this.api.auditLogs({ ...this.filters.getRawValue(), page: this.page(), size: 20 }).subscribe({
      next: (res) => {
        this.logs.set(res.content);
        this.totalPages.set(res.totalPages);
        this.total.set(res.totalElements);
      },
      error: (err) => this.error.set(errorMessage(err)),
    });
  }
}
