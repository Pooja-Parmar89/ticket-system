import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, of, switchMap } from 'rxjs';
import { ApiService } from '../core/api.service';
import { PRIORITIES } from '../core/models';
import { errorMessage, formatSize } from '../core/util';

const MAX_FILE_BYTES = 5 * 1024 * 1024;

@Component({
  selector: 'app-ticket-form',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="page-head">
      <div><h1>New complaint</h1><span class="muted">Describe the problem. A support employee will be assigned by the admin.</span></div>
    </div>

    <form class="card" [formGroup]="form" (ngSubmit)="submit()" style="max-width: 720px">
      @if (error()) { <div class="alert alert-error">{{ error() }}</div> }

      <div class="field">
        <label for="title">Title</label>
        <input id="title" formControlName="title" maxlength="200" />
        @if (form.controls.title.touched && form.controls.title.invalid) { <div class="field-error">Title must be 5 to 200 characters</div> }
      </div>
      <div class="field">
        <label for="priority">Priority</label>
        <select id="priority" formControlName="priority">
          @for (p of priorities; track p) { <option [value]="p">{{ p }}</option> }
        </select>
      </div>
      <div class="field">
        <label for="desc">Description</label>
        <textarea id="desc" formControlName="description" maxlength="5000"></textarea>
        @if (form.controls.description.touched && form.controls.description.invalid) { <div class="field-error">Description must be 10 to 5000 characters</div> }
      </div>
      <div class="field">
        <label for="files">Attachments (optional, max 5 MB each)</label>
        <input id="files" type="file" multiple (change)="pick($event)" />
        @for (f of files(); track f.name) { <div class="muted small">{{ f.name }} ({{ size(f.size) }})</div> }
      </div>

      <div class="row">
        <button class="btn" type="submit" [disabled]="loading()">{{ loading() ? 'Submitting...' : 'Submit complaint' }}</button>
        <a class="btn btn-light" routerLink="/tickets">Cancel</a>
      </div>
    </form>
  `,
})
export class TicketForm {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  readonly priorities = PRIORITIES;
  readonly size = formatSize;
  readonly files = signal<File[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(200)]],
    description: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(5000)]],
    priority: ['MEDIUM' as (typeof PRIORITIES)[number], Validators.required],
  });

  pick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const chosen = Array.from(input.files ?? []);
    const tooBig = chosen.find((f) => f.size > MAX_FILE_BYTES);
    if (tooBig) {
      this.error.set(`${tooBig.name} is larger than 5 MB`);
      input.value = '';
      this.files.set([]);
      return;
    }
    if (chosen.length > 5) {
      this.error.set('You can attach at most 5 files');
      input.value = '';
      this.files.set([]);
      return;
    }
    this.error.set('');
    this.files.set(chosen);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set('');
    const files = this.files();

    this.api
      .createTicket(this.form.getRawValue())
      .pipe(
        switchMap((ticket) =>
          files.length === 0
            ? of(ticket)
            : forkJoin(files.map((f) => this.api.uploadAttachment(ticket.id, f).pipe(catchError(() => of(null))))).pipe(
                switchMap(() => of(ticket)),
              ),
        ),
      )
      .subscribe({
        next: (ticket) => void this.router.navigate(['/tickets', ticket.id]),
        error: (err) => {
          this.loading.set(false);
          this.error.set(errorMessage(err));
        },
      });
  }
}
