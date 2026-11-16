package com.pooja.ticketsystem.service;

import com.pooja.ticketsystem.dto.Dtos.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.sql.Date;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.sql.Types;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** Every report is produced by a MySQL stored procedure (see database/02_routines.sql). */
@Service
public class ReportService {

    private final JdbcTemplate jdbc;

    public ReportService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public ReportSummary summary(LocalDate from, LocalDate to) {
        return query("CALL sp_report_summary(?, ?)", from, to, (rs, i) -> new ReportSummary(
                rs.getLong("total_tickets"), rs.getLong("open_count"), rs.getLong("assigned_count"),
                rs.getLong("in_progress_count"), rs.getLong("resolved_count"),
                decimal(rs, "avg_resolution_hours"), rs.getLong("sla_breached_count"))).get(0);
    }

    public List<PriorityReport> byPriority(LocalDate from, LocalDate to) {
        return query("CALL sp_report_by_priority(?, ?)", from, to, (rs, i) -> new PriorityReport(
                rs.getString("priority"), rs.getLong("total_tickets"), rs.getLong("resolved_count"),
                decimal(rs, "avg_resolution_hours"), rs.getInt("sla_hours")));
    }

    public List<EmployeeReport> byEmployee(LocalDate from, LocalDate to) {
        return query("CALL sp_report_by_employee(?, ?)", from, to, (rs, i) -> new EmployeeReport(
                rs.getLong("employee_id"), rs.getString("employee_name"), rs.getLong("assigned_total"),
                rs.getLong("resolved_count"), rs.getLong("pending_count"), decimal(rs, "avg_resolution_hours")));
    }

    public List<ResolvedTicketReport> resolvedTickets(LocalDate from, LocalDate to) {
        return query("CALL sp_report_resolved_tickets(?, ?)", from, to, (rs, i) -> new ResolvedTicketReport(
                rs.getLong("ticket_id"), rs.getString("ticket_no"), rs.getString("title"), rs.getString("priority"),
                rs.getString("assigned_to_name"), dateTime(rs, "created_at"), dateTime(rs, "resolved_at"),
                decimal(rs, "resolution_hours"), rs.getInt("sla_hours"), rs.getInt("sla_breached") == 1));
    }

    /** CSV (Excel opens it) of all resolved tickets with their resolution time. */
    public byte[] resolvedTicketsCsv(LocalDate from, LocalDate to) {
        StringBuilder sb = new StringBuilder("﻿");   // BOM so Excel reads UTF-8 correctly
        sb.append("Ticket No,Title,Priority,Assigned To,Created At,Resolved At,Resolution Hours,SLA Hours,SLA Breached\n");
        for (ResolvedTicketReport r : resolvedTickets(from, to)) {
            sb.append(csv(r.ticketNo())).append(',')
                    .append(csv(r.title())).append(',')
                    .append(csv(r.priority())).append(',')
                    .append(csv(r.assignedToName())).append(',')
                    .append(csv(String.valueOf(r.createdAt()))).append(',')
                    .append(csv(String.valueOf(r.resolvedAt()))).append(',')
                    .append(r.resolutionHours() == null ? "" : r.resolutionHours()).append(',')
                    .append(r.slaHours()).append(',')
                    .append(r.slaBreached() ? "Yes" : "No").append('\n');
        }
        return sb.toString().getBytes(StandardCharsets.UTF_8);
    }

    // ------------------------------------------------------------------ helpers
    private <T> List<T> query(String sql, LocalDate from, LocalDate to,
                              org.springframework.jdbc.core.RowMapper<T> mapper) {
        return jdbc.query(sql, ps -> {
            ps.setObject(1, from == null ? null : Date.valueOf(from), Types.DATE);
            ps.setObject(2, to == null ? null : Date.valueOf(to), Types.DATE);
        }, mapper);
    }

    private static Double decimal(ResultSet rs, String column) throws SQLException {
        double value = rs.getDouble(column);
        return rs.wasNull() ? null : value;
    }

    private static LocalDateTime dateTime(ResultSet rs, String column) throws SQLException {
        Timestamp ts = rs.getTimestamp(column);
        return ts == null ? null : ts.toLocalDateTime();
    }

    /** Quotes a CSV cell and blocks Excel formula injection (cells that start with = + - @). */
    private static String csv(String value) {
        if (value == null) {
            return "";
        }
        String safe = value;
        if (!safe.isEmpty() && "=+-@".indexOf(safe.charAt(0)) >= 0) {
            safe = "'" + safe;
        }
        return "\"" + safe.replace("\"", "\"\"") + "\"";
    }
}
