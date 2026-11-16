export type Role = 'ADMIN' | 'EMPLOYEE' | 'USER';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TicketStatus = 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED';

export const PRIORITIES: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
export const STATUSES: TicketStatus[] = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED'];

export interface User {
  id: number;
  fullName: string;
  email: string;
  role: Role;
  active: boolean;
  emailVerified: boolean;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  tokenType: string;
  expiresInSeconds: number;
  user: User;
}

export interface Message {
  message: string;
}

export interface Ticket {
  id: number;
  ticketNo: string;
  title: string;
  description: string;
  priority: Priority;
  status: TicketStatus;
  createdById: number;
  createdByName: string;
  assignedToId: number | null;
  assignedToName: string | null;
  createdAt: string;
  updatedAt: string;
  assignedAt: string | null;
  resolvedAt: string | null;
  resolutionHours: number | null;
  slaHours: number;
  slaBreached: boolean;
  version: number;
}

export interface TicketComment {
  id: number;
  userId: number;
  userName: string;
  userRole: Role;
  comment: string;
  createdAt: string;
}

export interface Attachment {
  id: number;
  originalName: string;
  contentType: string | null;
  sizeBytes: number;
  uploadedBy: string;
  createdAt: string;
}

export interface AuditLog {
  id: number;
  userId: number | null;
  userEmail: string | null;
  action: string;
  entityType: string;
  entityId: number | null;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface Page<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface Dashboard {
  total: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
}

export interface ReportSummary {
  totalTickets: number;
  openCount: number;
  assignedCount: number;
  inProgressCount: number;
  resolvedCount: number;
  avgResolutionHours: number | null;
  slaBreachedCount: number;
}

export interface PriorityReport {
  priority: Priority;
  totalTickets: number;
  resolvedCount: number;
  avgResolutionHours: number | null;
  slaHours: number;
}

export interface EmployeeReport {
  employeeId: number;
  employeeName: string;
  assignedTotal: number;
  resolvedCount: number;
  pendingCount: number;
  avgResolutionHours: number | null;
}

export interface ResolvedTicketReport {
  ticketId: number;
  ticketNo: string;
  title: string;
  priority: Priority;
  assignedToName: string | null;
  createdAt: string;
  resolvedAt: string;
  resolutionHours: number | null;
  slaHours: number;
  slaBreached: boolean;
}
