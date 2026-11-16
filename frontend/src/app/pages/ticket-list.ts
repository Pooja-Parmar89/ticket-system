import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { PRIORITIES, STATUSES, Ticket } from '../core/models';
import { errorMessage } from '../core/util';
import { LabelPipe } from '../shared/label.pipe';
import { Pager } from '../shared/pager';

@Component({
  selector: 'app-ticket-list',
  imports: [ReactiveFormsModule, RouterLink, DatePipe, LabelPipe, Pager],
  template: `
    <div class="page-head">
      <div>
        <h1>{{ auth.role() === 'ADMIN' ? 'All tickets' : auth.role() === 'EMPLOYEE' ? 'Tickets assigned to me' : 'My tickets' }}</h1>
        <span class="muted">Search and filter. Click a row to open the ticket.</span>
      </div>
      @if (auth.role() !== 'EMPLOYEE') {
        <a class="btn" routerLink="/tickets/new">+ New Complaint</a>
      }
    </div>

    <form class="card row" [formGroup]="filters" (ngSubmit)="apply()">
      <div class="field" style="flex: 2">
        <label for="q">Search (ticket no or title)</label>
        <input id="q" formControlName="search" placeholder="e.g. TKT-2026 or printer" />
      </div>
      <div class="field">
        <label for="st">Status</label>
        <select id="st" formControlName="status">
          <option value="">All</option>
          @for (s of statuses; track s) { <option [value]="s">{{ s | label }}</option> }
        </select>
      </div>
      <div class="field">
        <label for="pr">Priority</label>
        <select id="pr" formControlName="priority">
          <option value="">All</option>
          @for (p of priorities; track p) { <option [value]="p">{{ p }}</option> }
        </select>
      </div>
      <button class="btn" type="submit">Search</button>
      <button class="btn btn-light" type="button" (click)="reset()">Clear</button>
    </form>

    @if (error()) { <div class="alert alert-error">{{ error() }}</div> }

    <div class="card">
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Ticket</th><th>Title</th><th>Priority</th><th>Status</th><th>Raised by</th><th>Assigned to</th><th>Created</th></tr>
          </thead>
          <tbody>
            @for (t of tickets(); track t.id) {
              <tr class="clickable" [routerLink]="['/tickets', t.id]">
                <td><b>{{ t.ticketNo }}</b></td>
                <td>{{ t.title }}</td>
                <td><span [class]="'badge p-' + t.priority">{{ t.priority }}</span></td>
                <td><span [class]="'badge s-' + t.status">{{ t.status | label }}</span></td>
                <td>{{ t.createdByName }}</td>
                <td>{{ t.assignedToName ?? '-' }}</td>
                <td class="muted">{{ t.createdAt | date: 'dd MMM yyyy, HH:mm' }}</td>
              </tr>
            } @empty {
              <tr><td colspan="7" class="muted">{{ loading() ? 'Loading...' : 'No tickets found.' }}</td></tr>
            }
          </tbody>
        </table>
      </div>
      <app-pager [page]="page()" [totalPages]="totalPages()" [totalElements]="total()" (pageChange)="goTo($event)" />
    </div>
  `,
})
export class TicketList implements OnInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);

  readonly statuses = STATUSES;
  readonly priorities = PRIORITIES;
  readonly filters = this.fb.nonNullable.group({ search: '', status: '', priority: '' });

  readonly tickets = signal<Ticket[]>([]);
  readonly page = signal(0);
  readonly totalPages = signal(0);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly error = signal('');

  ngOnInit(): void {
    const status = this.route.snapshot.queryParamMap.get('status');
    if (status) {
      this.filters.patchValue({ status });
    }
    this.load();
  }

  apply(): void {
    this.page.set(0);
    this.load();
  }

  reset(): void {
    this.filters.reset({ search: '', status: '', priority: '' });
    void this.router.navigate([], { queryParams: {} });
    this.apply();
  }

  goTo(page: number): void {
    this.page.set(page);
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.tickets({ ...this.filters.getRawValue(), page: this.page(), size: 10 }).subscribe({
      next: (res) => {
        this.tickets.set(res.content);
        this.totalPages.set(res.totalPages);
        this.total.set(res.totalElements);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }
}
