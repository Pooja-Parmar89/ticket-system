import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="layout">
      <aside class="sidebar">
        <div class="brand">&#127915; Ticket Desk</div>
        <a routerLink="/dashboard" routerLinkActive="active">Dashboard</a>
        <a routerLink="/tickets" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">{{ ticketsLabel() }}</a>
        @if (canCreate()) {
          <a routerLink="/tickets/new" routerLinkActive="active">New Complaint</a>
        }
        @if (auth.role() === 'ADMIN') {
          <div class="section">Administration</div>
          <a routerLink="/admin/users" routerLinkActive="active">Users</a>
          <a routerLink="/admin/reports" routerLinkActive="active">Reports</a>
          <a routerLink="/admin/audit-logs" routerLinkActive="active">Audit Logs</a>
        }
      </aside>
      <div class="main">
        <header class="topbar">
          <span>{{ auth.user()?.fullName }}</span>
          <span class="badge role-badge">{{ auth.role() }}</span>
          <button class="btn btn-light btn-sm" type="button" (click)="auth.logout()">Logout</button>
        </header>
        <main class="content"><router-outlet /></main>
      </div>
    </div>
  `,
})
export class Shell {
  readonly auth = inject(AuthService);

  readonly canCreate = computed(() => this.auth.role() === 'USER' || this.auth.role() === 'ADMIN');
  readonly ticketsLabel = computed(() => {
    switch (this.auth.role()) {
      case 'ADMIN':
        return 'All Tickets';
      case 'EMPLOYEE':
        return 'Assigned to Me';
      default:
        return 'My Tickets';
    }
  });
}
