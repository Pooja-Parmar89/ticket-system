import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { Dashboard as DashboardData, PRIORITIES, STATUSES, Ticket } from '../core/models';
import { errorMessage } from '../core/util';
import { LabelPipe } from '../shared/label.pipe';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, DatePipe, LabelPipe],
  template: `
    <div class="page-head">
      <div>
        <h1>Hello, {{ auth.user()?.fullName }}</h1>
        <span class="muted">Here is the current ticket overview</span>
      </div>
      @if (auth.role() !== 'EMPLOYEE') {
        <a class="btn" routerLink="/tickets/new">+ New Complaint</a>
      }
    </div>

    @if (error()) { <div class="alert alert-error">{{ error() }}</div> }

    @if (data(); as d) {
      <div class="grid grid-4">
        <a class="stat" routerLink="/tickets"><div class="num">{{ d.total }}</div><div class="lbl">Total tickets</div></a>
        @for (s of statuses; track s) {
          <a class="stat" routerLink="/tickets" [queryParams]="{ status: s }">
            <div class="num">{{ d.byStatus[s] }}</div>
            <div class="lbl"><span [class]="'badge s-' + s">{{ s | label }}</span></div>
          </a>
        }
      </div>

      <div class="grid grid-2" style="margin-top: 18px">
        <div class="card">
          <h2>By priority</h2>
          @for (p of priorities; track p) {
            <div style="margin-bottom: 10px">
              <div class="row" style="justify-content: space-between; margin-bottom: 4px">
                <span [class]="'badge p-' + p">{{ p }}</span><b>{{ d.byPriority[p] }}</b>
              </div>
              <div class="bar"><span [style.width.%]="percent(d.byPriority[p], d.total)"></span></div>
            </div>
          }
        </div>

        <div class="card">
          <h2>Latest tickets</h2>
          @if (recent().length === 0) {
            <p class="muted">No tickets yet.</p>
          }
          <div class="table-wrap">
            <table>
              <tbody>
                @for (t of recent(); track t.id) {
                  <tr class="clickable" [routerLink]="['/tickets', t.id]">
                    <td><b>{{ t.ticketNo }}</b><div class="muted small">{{ t.title }}</div></td>
                    <td><span [class]="'badge s-' + t.status">{{ t.status | label }}</span></td>
                    <td class="muted small">{{ t.createdAt | date: 'dd MMM, HH:mm' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    }
  `,
})
export class Dashboard implements OnInit {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);

  readonly statuses = STATUSES;
  readonly priorities = PRIORITIES;
  readonly data = signal<DashboardData | null>(null);
  readonly recent = signal<Ticket[]>([]);
  readonly error = signal('');

  ngOnInit(): void {
    this.api.dashboard().subscribe({
      next: (d) => this.data.set(d),
      error: (e) => this.error.set(errorMessage(e)),
    });
    this.api.tickets({ page: 0, size: 6 }).subscribe({
      next: (p) => this.recent.set(p.content),
      error: (e) => this.error.set(errorMessage(e)),
    });
  }

  percent(value: number, total: number): number {
    return total === 0 ? 0 : Math.round((value / total) * 100);
  }
}
