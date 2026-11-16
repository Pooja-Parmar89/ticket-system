import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/guards';
import { Shell } from './layout/shell';

export const routes: Routes = [
  { path: 'login', canActivate: [guestGuard], loadComponent: () => import('./pages/login').then((m) => m.Login) },
  { path: 'register', canActivate: [guestGuard], loadComponent: () => import('./pages/register').then((m) => m.Register) },
  {
    path: 'forgot-password',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/forgot-password').then((m) => m.ForgotPassword),
  },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', loadComponent: () => import('./pages/dashboard').then((m) => m.Dashboard) },
      { path: 'tickets', loadComponent: () => import('./pages/ticket-list').then((m) => m.TicketList) },
      {
        path: 'tickets/new',
        canActivate: [roleGuard('USER', 'ADMIN')],
        loadComponent: () => import('./pages/ticket-form').then((m) => m.TicketForm),
      },
      { path: 'tickets/:id', loadComponent: () => import('./pages/ticket-detail').then((m) => m.TicketDetail) },
      {
        path: 'admin/users',
        canActivate: [roleGuard('ADMIN')],
        loadComponent: () => import('./pages/admin-users').then((m) => m.AdminUsers),
      },
      {
        path: 'admin/reports',
        canActivate: [roleGuard('ADMIN')],
        loadComponent: () => import('./pages/reports').then((m) => m.Reports),
      },
      {
        path: 'admin/audit-logs',
        canActivate: [roleGuard('ADMIN')],
        loadComponent: () => import('./pages/audit-logs').then((m) => m.AuditLogs),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
