import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { EmployeeReport, PriorityReport, ReportSummary, ResolvedTicketReport } from '../core/models';
import { errorMessage, saveBlob } from '../core/util';

@Component({
  selector: 'app-reports',
  imports: [ReactiveFormsModule, DatePipe, DecimalPipe, RouterLink],
  template: `
    <div class="page-head"><div><h1>Resolution time reports</h1><span class="muted">Created from MySQL stored procedures</span></div></div>

    <form class="card row" [formGroup]="range" (ngSubmit)="load()">
      <div class="field"><label for="f">From</label><input id="f" type="date" formControlName="from" /></div>
      <div class="field"><label for="t">To</label><input id="t" type="date" formControlName="to" /></div>
      <button class="btn" type="submit">Apply</button>
      <button class="btn btn-light" type="button" (click)="clear()">Clear</button>
      <button class="btn btn-light" type="button" (click)="exportCsv()">Download CSV</button>
    </form>

    @if (error()) { <div class="alert alert-error">{{ error() }}</div> }

    @if (summary(); as s) {
      <div class="grid grid-4">
        <div class="stat"><div class="num">{{ s.totalTickets }}</div><div class="lbl">Tickets</div></div>
        <div class="stat"><div class="num">{{ s.resolvedCount }}</div><div class="lbl">Resolved</div></div>
        <div class="stat"><div class="num">{{ (s.avgResolutionHours | number: '1.0-2') ?? '-' }}</div><div class="lbl">Avg resolution (hours)</div></div>
        <div class="stat"><div class="num">{{ s.slaBreachedCount }}</div><div class="lbl">SLA missed</div></div>
      </div>
    }

    <div class="grid grid-2" style="margin-top: 18px">
      <div class="card">
        <h2>By priority</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Priority</th><th>Tickets</th><th>Resolved</th><th>Avg hours</th><th>SLA (h)</th></tr></thead>
            <tbody>
              @for (p of byPriority(); track p.priority) {
                <tr>
                  <td><span [class]="'badge p-' + p.priority">{{ p.priority }}</span></td>
                  <td>{{ p.totalTickets }}</td>
                  <td>{{ p.resolvedCount }}</td>
                  <td [class.muted]="p.avgResolutionHours === null">{{ (p.avgResolutionHours | number: '1.0-2') ?? '-' }}</td>
                  <td>{{ p.slaHours }}</td>
                </tr>
              } @empty { <tr><td colspan="5" class="muted">No data.</td></tr> }
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <h2>By employee</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Employee</th><th>Assigned</th><th>Resolved</th><th>Pending</th><th>Avg hours</th></tr></thead>
            <tbody>
              @for (e of byEmployee(); track e.employeeId) {
                <tr>
                  <td><b>{{ e.employeeName }}</b></td>
                  <td>{{ e.assignedTotal }}</td>
                  <td>{{ e.resolvedCount }}</td>
                  <td>{{ e.pendingCount }}</td>
                  <td [class.muted]="e.avgResolutionHours === null">{{ (e.avgResolutionHours | number: '1.0-2') ?? '-' }}</td>
                </tr>
              } @empty { <tr><td colspan="5" class="muted">No employees.</td></tr> }
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>Resolved tickets</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Ticket</th><th>Title</th><th>Priority</th><th>Employee</th><th>Created</th><th>Resolved</th><th>Hours</th><th>SLA</th></tr></thead>
          <tbody>
            @for (r of resolved(); track r.ticketId) {
              <tr>
                <td><a [routerLink]="['/tickets', r.ticketId]"><b>{{ r.ticketNo }}</b></a></td>
                <td>{{ r.title }}</td>
                <td><span [class]="'badge p-' + r.priority">{{ r.priority }}</span></td>
                <td>{{ r.assignedToName ?? '-' }}</td>
                <td class="muted">{{ r.createdAt | date: 'dd MMM, HH:mm' }}</td>
                <td class="muted">{{ r.resolvedAt | date: 'dd MMM, HH:mm' }}</td>
                <td>{{ (r.resolutionHours | number: '1.0-2') ?? '-' }}</td>
                <td><span [class]="'badge ' + (r.slaBreached ? 'bad' : 'ok')">{{ r.slaBreached ? 'MISSED' : 'MET' }} ({{ r.slaHours }}h)</span></td>
              </tr>
            } @empty { <tr><td colspan="8" class="muted">No resolved tickets in this period.</td></tr> }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class Reports implements OnInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);

  readonly range = this.fb.nonNullable.group({ from: '', to: '' });
  readonly summary = signal<ReportSummary | null>(null);
  readonly byPriority = signal<PriorityReport[]>([]);
  readonly byEmployee = signal<EmployeeReport[]>([]);
  readonly resolved = signal<ResolvedTicketReport[]>([]);
  readonly error = signal('');

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const { from, to } = this.range.getRawValue();
    this.error.set('');
    const fail = (err: unknown) => this.error.set(errorMessage(err));
    this.api.reportSummary(from, to).subscribe({ next: (r) => this.summary.set(r), error: fail });
    this.api.reportByPriority(from, to).subscribe({ next: (r) => this.byPriority.set(r), error: fail });
    this.api.reportByEmployee(from, to).subscribe({ next: (r) => this.byEmployee.set(r), error: fail });
    this.api.reportResolved(from, to).subscribe({ next: (r) => this.resolved.set(r), error: fail });
  }

  clear(): void {
    this.range.reset({ from: '', to: '' });
    this.load();
  }

  exportCsv(): void {
    const { from, to } = this.range.getRawValue();
    this.api.reportCsv(from, to).subscribe({
      next: (blob) => saveBlob(blob, 'resolution-time-report.csv'),
      error: () => this.error.set('Could not download the report'),
    });
  }
}
