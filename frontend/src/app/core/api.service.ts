import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_URL } from './config';
import {
  Attachment, AuditLog, Dashboard, EmployeeReport, Page, Priority, PriorityReport,
  ReportSummary, ResolvedTicketReport, Role, Ticket, TicketComment, TicketStatus, User,
} from './models';

export interface TicketFilter {
  status?: string;
  priority?: string;
  search?: string;
  page: number;
  size: number;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  // ------------------------------------------------------------------ tickets
  tickets(filter: TicketFilter) {
    let params = new HttpParams().set('page', filter.page).set('size', filter.size);
    if (filter.status) params = params.set('status', filter.status);
    if (filter.priority) params = params.set('priority', filter.priority);
    if (filter.search?.trim()) params = params.set('search', filter.search.trim());
    return this.http.get<Page<Ticket>>(`${API_URL}/tickets`, { params });
  }

  ticket(id: number) {
    return this.http.get<Ticket>(`${API_URL}/tickets/${id}`);
  }

  createTicket(body: { title: string; description: string; priority: Priority }) {
    return this.http.post<Ticket>(`${API_URL}/tickets`, body);
  }

  assignTicket(id: number, employeeId: number, version: number) {
    return this.http.put<Ticket>(`${API_URL}/tickets/${id}/assign`, { employeeId, version });
  }

  changeStatus(id: number, status: TicketStatus, version: number) {
    return this.http.put<Ticket>(`${API_URL}/tickets/${id}/status`, { status, version });
  }

  history(id: number) {
    return this.http.get<AuditLog[]>(`${API_URL}/tickets/${id}/history`);
  }

  dashboard() {
    return this.http.get<Dashboard>(`${API_URL}/dashboard`);
  }

  // ------------------------------------------------------------------ comments & attachments
  comments(ticketId: number) {
    return this.http.get<TicketComment[]>(`${API_URL}/tickets/${ticketId}/comments`);
  }

  addComment(ticketId: number, comment: string) {
    return this.http.post<TicketComment>(`${API_URL}/tickets/${ticketId}/comments`, { comment });
  }

  attachments(ticketId: number) {
    return this.http.get<Attachment[]>(`${API_URL}/tickets/${ticketId}/attachments`);
  }

  uploadAttachment(ticketId: number, file: File) {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<Attachment>(`${API_URL}/tickets/${ticketId}/attachments`, form);
  }

  downloadAttachment(attachmentId: number) {
    return this.http.get(`${API_URL}/attachments/${attachmentId}/download`, { responseType: 'blob' });
  }

  // ------------------------------------------------------------------ users
  employees() {
    return this.http.get<User[]>(`${API_URL}/users/employees`);
  }

  users() {
    return this.http.get<User[]>(`${API_URL}/admin/users`);
  }

  createUser(body: { fullName: string; email: string; password: string; role: Role }) {
    return this.http.post<User>(`${API_URL}/admin/users`, body);
  }

  setActive(id: number, active: boolean) {
    return this.http.patch<User>(`${API_URL}/admin/users/${id}/active`, { active });
  }

  // ------------------------------------------------------------------ reports & audit
  reportSummary(from: string, to: string) {
    return this.http.get<ReportSummary>(`${API_URL}/reports/summary`, { params: this.range(from, to) });
  }

  reportByPriority(from: string, to: string) {
    return this.http.get<PriorityReport[]>(`${API_URL}/reports/by-priority`, { params: this.range(from, to) });
  }

  reportByEmployee(from: string, to: string) {
    return this.http.get<EmployeeReport[]>(`${API_URL}/reports/by-employee`, { params: this.range(from, to) });
  }

  reportResolved(from: string, to: string) {
    return this.http.get<ResolvedTicketReport[]>(`${API_URL}/reports/resolution-time`, { params: this.range(from, to) });
  }

  reportCsv(from: string, to: string) {
    return this.http.get(`${API_URL}/reports/resolution-time/export`, {
      params: this.range(from, to),
      responseType: 'blob',
    });
  }

  auditLogs(filter: { action: string; entityType: string; userEmail: string; page: number; size: number }) {
    let params = new HttpParams().set('page', filter.page).set('size', filter.size);
    if (filter.action) params = params.set('action', filter.action);
    if (filter.entityType) params = params.set('entityType', filter.entityType);
    if (filter.userEmail.trim()) params = params.set('userEmail', filter.userEmail.trim());
    return this.http.get<Page<AuditLog>>(`${API_URL}/admin/audit-logs`, { params });
  }

  private range(from: string, to: string): HttpParams {
    let params = new HttpParams();
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    return params;
  }
}
