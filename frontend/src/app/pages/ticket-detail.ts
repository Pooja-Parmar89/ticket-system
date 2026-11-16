import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { Attachment, AuditLog, Ticket, TicketComment, TicketStatus, User } from '../core/models';
import { errorMessage, formatSize, saveBlob } from '../core/util';
import { LabelPipe } from '../shared/label.pipe';

const MAX_FILE_BYTES = 5 * 1024 * 1024;

@Component({
  selector: 'app-ticket-detail',
  imports: [ReactiveFormsModule, RouterLink, DatePipe, DecimalPipe, LabelPipe],
  template: `
    <a routerLink="/tickets" class="muted">&larr; Back to tickets</a>

    @if (error()) { <div class="alert alert-error" style="margin-top: 10px">{{ error() }}</div> }
    @if (info()) { <div class="alert alert-success" style="margin-top: 10px">{{ info() }}</div> }

    @if (ticket(); as t) {
      <div class="page-head" style="margin-top: 12px">
        <div>
          <h1>{{ t.ticketNo }} &middot; {{ t.title }}</h1>
          <span [class]="'badge p-' + t.priority">{{ t.priority }}</span>
          <span [class]="'badge s-' + t.status" style="margin-left: 6px">{{ t.status | label }}</span>
        </div>
        @if (nextStatus(); as next) {
          <button class="btn" [class.btn-success]="next === 'RESOLVED'" type="button" [disabled]="busy()" (click)="move(next)">
            {{ next === 'IN_PROGRESS' ? 'Start work' : 'Mark as resolved' }}
          </button>
        }
      </div>

      <div class="detail-grid">
        <div>
          <div class="card">
            <h2>Description</h2>
            <div class="desc">{{ t.description }}</div>
          </div>

          <div class="card">
            <h2>Comments ({{ comments().length }})</h2>
            @for (c of comments(); track c.id) {
              <div class="comment">
                <span class="who">{{ c.userName }}</span>
                <span class="badge role-badge" style="margin-left: 6px">{{ c.userRole }}</span>
                <span class="muted small" style="margin-left: 6px">{{ c.createdAt | date: 'dd MMM yyyy, HH:mm' }}</span>
                <div class="desc">{{ c.comment }}</div>
              </div>
            } @empty {
              <p class="muted">No comments yet.</p>
            }
            <div class="field" style="margin-top: 12px">
              <textarea [formControl]="commentCtrl" placeholder="Write a comment..." style="min-height: 70px"></textarea>
            </div>
            <button class="btn" type="button" [disabled]="commentCtrl.invalid || busy()" (click)="addComment()">Add comment</button>
          </div>

          <div class="card">
            <h2>Attachments ({{ attachments().length }})</h2>
            @for (a of attachments(); track a.id) {
              <div class="comment row" style="justify-content: space-between">
                <div>
                  <b>{{ a.originalName }}</b>
                  <div class="muted small">{{ size(a.sizeBytes) }} &middot; {{ a.uploadedBy }} &middot; {{ a.createdAt | date: 'dd MMM yyyy, HH:mm' }}</div>
                </div>
                <button class="btn btn-light btn-sm" type="button" (click)="download(a)">Download</button>
              </div>
            } @empty {
              <p class="muted">No attachments.</p>
            }
            <div class="field" style="margin-top: 12px">
              <input #fileInput type="file" (change)="upload(fileInput)" />
              <div class="muted small">pdf, png, jpg, txt, doc, docx, xls, xlsx &middot; max 5 MB &middot; 5 files per ticket</div>
            </div>
          </div>
        </div>

        <div>
          <div class="card">
            <h2>Details</h2>
            <dl class="meta">
              <dt>Raised by</dt><dd>{{ t.createdByName }}</dd>
              <dt>Assigned to</dt><dd>{{ t.assignedToName ?? 'Not assigned yet' }}</dd>
              <dt>Created</dt><dd>{{ t.createdAt | date: 'dd MMM yyyy, HH:mm' }}</dd>
              <dt>Assigned</dt><dd>{{ t.assignedAt ? (t.assignedAt | date: 'dd MMM yyyy, HH:mm') : '-' }}</dd>
              <dt>Resolved</dt><dd>{{ t.resolvedAt ? (t.resolvedAt | date: 'dd MMM yyyy, HH:mm') : '-' }}</dd>
              <dt>Target (SLA)</dt><dd>{{ t.slaHours }} hours</dd>
              <dt>Resolution time</dt>
              <dd>
                @if (t.resolutionHours !== null) {
                  {{ t.resolutionHours | number: '1.0-2' }} hours
                } @else { - }
                @if (t.slaBreached) { <span class="badge bad" style="margin-left: 6px">SLA missed</span> }
                @else if (t.resolutionHours !== null) { <span class="badge ok" style="margin-left: 6px">Within SLA</span> }
              </dd>
            </dl>
          </div>

          @if (canAssign()) {
            <div class="card">
              <h2>{{ t.assignedToId ? 'Re-assign ticket' : 'Assign ticket' }}</h2>
              <div class="field">
                <select [formControl]="assignCtrl">
                  <option [ngValue]="null">Select employee</option>
                  @for (e of employees(); track e.id) { <option [ngValue]="e.id">{{ e.fullName }}</option> }
                </select>
              </div>
              <button class="btn btn-block" type="button" [disabled]="assignCtrl.value === null || busy()" (click)="assign()">Assign</button>
            </div>
          }

          <div class="card">
            <h2>History (audit log)</h2>
            <ul class="timeline">
              @for (h of history(); track h.id) {
                <li>
                  <b>{{ h.action | label }}</b>
                  <div>{{ h.details }}</div>
                  <div class="muted small">{{ h.userEmail ?? 'system' }} &middot; {{ h.createdAt | date: 'dd MMM, HH:mm' }}</div>
                </li>
              }
            </ul>
          </div>
        </div>
      </div>
    }
  `,
})
export class TicketDetail implements OnInit {
  /** :id from the URL (bound by withComponentInputBinding()) */
  readonly id = input.required<string>();

  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  readonly size = formatSize;
  readonly ticket = signal<Ticket | null>(null);
  readonly comments = signal<TicketComment[]>([]);
  readonly attachments = signal<Attachment[]>([]);
  readonly history = signal<AuditLog[]>([]);
  readonly employees = signal<User[]>([]);
  readonly error = signal('');
  readonly info = signal('');
  readonly busy = signal(false);

  readonly commentCtrl = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(2000)] });
  readonly assignCtrl = new FormControl<number | null>(null);

  readonly canAssign = computed(() => this.auth.role() === 'ADMIN' && this.ticket()?.status !== 'RESOLVED');

  /** The next workflow step, shown only to the assigned employee or an admin. */
  readonly nextStatus = computed<TicketStatus | null>(() => {
    const t = this.ticket();
    const user = this.auth.user();
    if (!t || !user || user.role === 'USER') return null;
    if (user.role === 'EMPLOYEE' && t.assignedToId !== user.id) return null;
    if (t.status === 'ASSIGNED') return 'IN_PROGRESS';
    if (t.status === 'IN_PROGRESS') return 'RESOLVED';
    return null;
  });

  private get ticketId(): number {
    return Number(this.id());
  }

  ngOnInit(): void {
    this.reload();
    if (this.auth.role() === 'ADMIN') {
      this.api.employees().subscribe({ next: (list) => this.employees.set(list) });
    }
  }

  move(status: TicketStatus): void {
    const t = this.ticket();
    if (!t) return;
    this.run(this.api.changeStatus(t.id, status, t.version), 'Status updated');
  }

  assign(): void {
    const t = this.ticket();
    const employeeId = this.assignCtrl.value;
    if (!t || employeeId === null) return;
    this.run(this.api.assignTicket(t.id, employeeId, t.version), 'Ticket assigned');
  }

  addComment(): void {
    if (this.commentCtrl.invalid) return;
    this.busy.set(true);
    this.api.addComment(this.ticketId, this.commentCtrl.value).subscribe({
      next: () => {
        this.commentCtrl.reset('');
        this.busy.set(false);
        this.reloadSide();
      },
      error: (err) => this.fail(err),
    });
  }

  upload(input: HTMLInputElement): void {
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      this.error.set('File is larger than 5 MB');
      input.value = '';
      return;
    }
    this.api.uploadAttachment(this.ticketId, file).subscribe({
      next: () => {
        input.value = '';
        this.error.set('');
        this.reloadSide();
      },
      error: (err) => {
        input.value = '';
        this.fail(err);
      },
    });
  }

  download(a: Attachment): void {
    this.api.downloadAttachment(a.id).subscribe({
      next: (blob) => saveBlob(blob, a.originalName),
      error: () => this.error.set('Could not download the file'),
    });
  }

  // ------------------------------------------------------------------ helpers
  /** Runs assign / status calls. A 409 means somebody else changed the ticket first -> reload. */
  private run(call: ReturnType<ApiService['assignTicket']>, success: string): void {
    this.busy.set(true);
    this.error.set('');
    this.info.set('');
    call.subscribe({
      next: (t) => {
        this.ticket.set(t);
        this.assignCtrl.reset(null);
        this.busy.set(false);
        this.info.set(success);
        this.reloadSide();
      },
      error: (err) => {
        this.fail(err);
        if (err?.status === 409) this.reload();
      },
    });
  }

  private fail(err: unknown): void {
    this.busy.set(false);
    this.info.set('');
    this.error.set(errorMessage(err));
  }

  private reload(): void {
    this.api.ticket(this.ticketId).subscribe({
      next: (t) => this.ticket.set(t),
      error: (err) => this.fail(err),
    });
    this.reloadSide();
  }

  private reloadSide(): void {
    this.api.comments(this.ticketId).subscribe({ next: (c) => this.comments.set(c) });
    this.api.attachments(this.ticketId).subscribe({ next: (a) => this.attachments.set(a) });
    this.api.history(this.ticketId).subscribe({ next: (h) => this.history.set(h) });
  }
}
