package com.pooja.ticketsystem.controller;

import com.pooja.ticketsystem.dto.Dtos.*;
import com.pooja.ticketsystem.security.UserPrincipal;
import com.pooja.ticketsystem.service.AuditService;
import com.pooja.ticketsystem.service.ReportService;
import com.pooja.ticketsystem.service.UserService;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

/** Users, reports and audit logs. */
@RestController
@RequestMapping("/api")
public class AdminController {

    private final UserService userService;
    private final ReportService reportService;
    private final AuditService auditService;

    public AdminController(UserService userService, ReportService reportService, AuditService auditService) {
        this.userService = userService;
        this.reportService = reportService;
        this.auditService = auditService;
    }

    // ---------------------------------------------------------------- users
    @GetMapping("/users/me")
    public UserResponse me(@AuthenticationPrincipal UserPrincipal me) {
        return userService.me(me);
    }

    @GetMapping("/users/employees")
    @PreAuthorize("hasRole('ADMIN')")
    public List<UserResponse> employees() {
        return userService.activeEmployees();
    }

    @GetMapping("/admin/users")
    @PreAuthorize("hasRole('ADMIN')")
    public List<UserResponse> users() {
        return userService.all();
    }

    @PostMapping("/admin/users")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMIN')")
    public UserResponse createUser(@Valid @RequestBody CreateUserRequest request) {
        return userService.create(request);
    }

    @PatchMapping("/admin/users/{id}/active")
    @PreAuthorize("hasRole('ADMIN')")
    public UserResponse setActive(@PathVariable Long id, @Valid @RequestBody ActiveRequest request,
                                  @AuthenticationPrincipal UserPrincipal me) {
        return userService.setActive(id, request.active(), me);
    }

    // ---------------------------------------------------------------- reports
    @GetMapping("/reports/summary")
    @PreAuthorize("hasRole('ADMIN')")
    public ReportSummary summary(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                 @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return reportService.summary(from, to);
    }

    @GetMapping("/reports/by-priority")
    @PreAuthorize("hasRole('ADMIN')")
    public List<PriorityReport> byPriority(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                           @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return reportService.byPriority(from, to);
    }

    @GetMapping("/reports/by-employee")
    @PreAuthorize("hasRole('ADMIN')")
    public List<EmployeeReport> byEmployee(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                           @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return reportService.byEmployee(from, to);
    }

    @GetMapping("/reports/resolution-time")
    @PreAuthorize("hasRole('ADMIN')")
    public List<ResolvedTicketReport> resolution(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                                 @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return reportService.resolvedTickets(from, to);
    }

    @GetMapping("/reports/resolution-time/export")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<byte[]> exportCsv(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        auditService.log("REPORT_EXPORTED", "REPORT", null, "Resolution time CSV " + from + " to " + to);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename("resolution-time-report.csv").build().toString())
                .body(reportService.resolvedTicketsCsv(from, to));
    }

    // ---------------------------------------------------------------- audit logs
    @GetMapping("/admin/audit-logs")
    @PreAuthorize("hasRole('ADMIN')")
    public PageResponse<AuditLogResponse> auditLogs(@RequestParam(required = false) String action,
                                                    @RequestParam(required = false) String entityType,
                                                    @RequestParam(required = false) String userEmail,
                                                    @RequestParam(defaultValue = "0") int page,
                                                    @RequestParam(defaultValue = "20") int size) {
        return auditService.search(action, entityType, userEmail, page, size);
    }
}
