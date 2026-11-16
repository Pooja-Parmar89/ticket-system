# Complaint & Ticket Management System

Full-stack project: **Java 21 + Spring Boot 3.5 + MySQL** backend and **Angular 21** frontend.

Organizations struggle to track complaints, assign support staff and monitor resolution time. This app solves that.

## Features

| Feature | Details |
|---|---|
| Complaints | Users submit tickets with title, description, priority (LOW / MEDIUM / HIGH / CRITICAL) |
| Assignment | Admin assigns (or re-assigns) a ticket to an employee |
| Workflow | OPEN -> ASSIGNED -> IN_PROGRESS -> RESOLVED (no skipping, enforced in the database) |
| Comments + attachments | Any person on the ticket can comment and upload files (type + 5 MB limit) |
| Email notifications | Ticket created / assigned / status changed / new comment (async) |
| Resolution time reports | Summary, by priority, by employee, resolved list, **CSV download**, SLA met / missed |
| Security | Spring Security + JWT, roles ADMIN / EMPLOYEE / USER, row-level access rules |
| OTP | Email OTP on registration and on forgot-password (hashed, expiry, attempt limit) |
| Audit log | Login, register, ticket changes, comments, downloads, reports (user, IP, time) |
| Database objects | Tables, **stored procedures and functions** are used by the application |

## Folder structure

```
ticket-system/
  database/   01_schema.sql, 02_routines.sql   (MySQL: tables, functions, stored procedures)
  backend/    Spring Boot (pom.xml, src/main/resources/application.properties)
  frontend/   Angular 21 (package.json)
  .gitignore
```

## 1. Database (MySQL 8)

1. Open MySQL Workbench (or any MySQL client).
2. Run `database/01_schema.sql`
3. Run `database/02_routines.sql`  (Workbench handles the `DELIMITER $$` lines; run the whole file)

Created: database `ticket_system`, tables `users, otp_tokens, tickets, ticket_comments, ticket_attachments, audit_logs`.

| Stored function / procedure | Used for |
|---|---|
| `fn_priority_sla_hours` | SLA hours per priority (Critical 4, High 24, Medium 72, Low 120) |
| `fn_resolution_hours` | Resolution time of a ticket |
| `fn_is_sla_breached` | SLA met / missed |
| `sp_write_audit_log` | Every audit row |
| `sp_create_ticket` | Creates ticket + ticket number (TKT-2026-00001) + audit |
| `sp_assign_ticket` | Assignment with `SELECT ... FOR UPDATE` and version check |
| `sp_change_ticket_status` | Workflow rules + version check + resolved_at |
| `sp_report_summary / by_priority / by_employee / resolved_tickets` | All reports |

## 2. Backend (IntelliJ IDEA)

1. Open the `backend` folder in IntelliJ (File > Open > select `backend/pom.xml` > "Open as Project"). Use **JDK 21**.
2. Wait for Maven to download dependencies.
3. Edit `src/main/resources/application.properties`: set `spring.datasource.username` and `spring.datasource.password`.
4. Run `TicketSystemApplication`. Backend: http://localhost:8080
5. Swagger UI (try the APIs): http://localhost:8080/swagger-ui.html

Or in a terminal: `cd backend` then `mvn spring-boot:run`

### Demo accounts (created automatically on the first start, password `Admin@123`)

| Role | Email |
|---|---|
| ADMIN | admin@ticketsystem.com |
| EMPLOYEE | employee1@ticketsystem.com, employee2@ticketsystem.com |
| USER | user@ticketsystem.com |

### Emails and OTP

`app.mail.enabled=false` (default): emails are **printed in the IntelliJ console**, so you can read the OTP there.
For real emails set `app.mail.enabled=true` and fill the Gmail SMTP values (Gmail needs an App Password).

## 3. Frontend (VS Code)

```
cd frontend
npm install
npm start          # http://localhost:4200
```
Backend URL is in `frontend/src/app/core/config.ts`.

Tested with: Angular CLI 21.2.3, Node 24.14.0, npm 11.9.0.

## API overview

| Method | URL | Who |
|---|---|---|
| POST | /api/auth/register, /verify-otp, /resend-otp, /login, /forgot-password, /reset-password | public |
| POST | /api/tickets | USER, ADMIN |
| GET | /api/tickets?status=&priority=&search=&page=&size= | all (each role sees only its own tickets) |
| GET | /api/tickets/{id}, /comments, /attachments, /history | people with access to the ticket |
| PUT | /api/tickets/{id}/assign | ADMIN |
| PUT | /api/tickets/{id}/status | assigned EMPLOYEE, ADMIN |
| POST | /api/tickets/{id}/comments, /attachments | people with access |
| GET | /api/attachments/{id}/download | people with access |
| GET | /api/reports/summary, /by-priority, /by-employee, /resolution-time, /resolution-time/export | ADMIN |
| GET/POST/PATCH | /api/admin/users, /api/admin/audit-logs | ADMIN |

## Interview talking points (be ready to explain these)

1. **JWT + Spring Security**: stateless; `JwtAuthFilter` reads the token, reloads the user from DB each request (a disabled user is blocked at once); `@PreAuthorize` for roles.
2. **Row-level access**: USER sees own tickets, EMPLOYEE sees assigned tickets, ADMIN sees all (JPA `Specification` + `loadAccessible`).
3. **Concurrency / optimistic locking**: every ticket has a `version`. The client sends the version it saw; the stored procedure locks the row (`FOR UPDATE`), compares versions and raises SQLSTATE 45001, which becomes HTTP 409.
4. **Stored procedures**: business rules (workflow, assignee must be an active employee) live in the DB transaction; Java maps SQLSTATE 45000/45001/45002 to 400/409/404 in `TicketProcedures`.
5. **OTP**: 6 digits from `SecureRandom`, stored as BCrypt hash, 5 minute expiry, max 5 attempts, 30 second resend gap. `noRollbackFor` keeps the failed-attempt counter saved.
6. **Global exception handling**: one `@RestControllerAdvice` returns clean JSON errors.
7. **N+1 problem**: `@EntityGraph` on the ticket page query.
8. **Indexes**: status+priority, created_by, assigned_to, resolved_at, audit (entity, user, time).
9. **File upload safety**: extension whitelist, 5 MB limit, random stored name (no path traversal), same access rule as the ticket, `nosniff` header.
10. **Async email**: `@Async` so SMTP delay does not slow the API.
11. **CSV export**: UTF-8 BOM for Excel, formula-injection protection.
12. **Angular**: standalone components, signals, Reactive Forms, route guards, HTTP interceptor (adds JWT, logs out on 401), lazy-loaded routes.

## Resume bullets (use only what you have run and understood)

- Built a full-stack complaint management system with Angular 21 and Spring Boot 3.5 (Java 21) on MySQL.
- Implemented JWT authentication, role-based authorization (Admin / Employee / User) and email OTP verification.
- Designed ticket workflow with MySQL stored procedures, row locking and optimistic versioning to avoid conflicting updates.
- Added audit logging (user, action, IP), comments, secure file attachments and async email notifications.
- Built resolution-time and SLA reports (by priority and employee) with CSV export.
